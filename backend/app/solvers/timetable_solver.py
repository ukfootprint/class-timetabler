"""Timetable solver using Google OR-Tools CP-SAT."""

import time
from collections import defaultdict
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from app.models import (
    Assignment,
    TimeSlot,
    TimetableInput,
    TimetableOutput,
)


@dataclass
class SolverConfig:
    """Configuration for the timetable solver."""

    max_time_seconds: float = 60.0
    num_workers: int = 8

    # Soft constraint weights (higher = more important)
    # Set to 0 to disable a soft constraint
    weight_teacher_gaps: int = 10  # Penalize gaps in teacher schedules
    weight_room_consistency: int = 5  # Prefer same room for same teacher
    weight_subject_spread: int = 8  # Spread subjects across the week
    weight_daily_balance: int = 3  # Balance lessons per day for teachers


@dataclass
class SoftConstraintStats:
    """Statistics about soft constraint penalties."""

    teacher_gap_penalties: dict = field(default_factory=dict)
    room_consistency_penalties: dict = field(default_factory=dict)
    subject_spread_penalties: dict = field(default_factory=dict)
    total_penalty: int = 0


class TimetableSolver:
    """CP-SAT based timetable solver with soft constraint optimization."""

    def __init__(self, data: TimetableInput, config: SolverConfig | None = None):
        self.data = data
        self.config = config or SolverConfig()

        # Build lookup maps for efficient access
        self._teachers = {t.id: t for t in data.teachers}
        self._rooms = {r.id: r for r in data.rooms}
        self._subjects = {s.id: s for s in data.subjects}
        self._lessons = {l.id: l for l in data.lessons}
        self._student_groups = {sg.id: sg for sg in data.student_groups}

        # Time structure: 5 days, 6 periods each
        self._days = range(5)
        self._periods = range(1, 7)
        self._num_periods_per_day = 6

        # Build teacher unavailability set for fast lookup
        self._teacher_unavailable: dict[str, set[tuple[int, int]]] = {}
        for teacher in data.teachers:
            self._teacher_unavailable[teacher.id] = {
                (slot.day, slot.period) for slot in teacher.unavailable
            }

        # Find valid rooms for each lesson based on subject requirements
        self._valid_rooms = self._compute_valid_rooms()

        # Group lessons by teacher for optimization
        self._teacher_lessons: dict[str, list[str]] = defaultdict(list)
        for lesson in data.lessons:
            self._teacher_lessons[lesson.teacher_id].append(lesson.id)

        # Group lessons by student group
        self._group_lessons: dict[str, list[str]] = defaultdict(list)
        for lesson in data.lessons:
            self._group_lessons[lesson.student_group_id].append(lesson.id)

    def _compute_valid_rooms(self) -> dict[str, list[str]]:
        """Compute which rooms are valid for each lesson based on subject requirements."""
        valid_rooms: dict[str, list[str]] = {}

        for lesson in self.data.lessons:
            subject = self._subjects[lesson.subject_id]
            required_type = subject.requires_room_type

            if required_type is None:
                valid_rooms[lesson.id] = [r.id for r in self.data.rooms]
            else:
                valid_rooms[lesson.id] = [
                    r.id for r in self.data.rooms if r.room_type == required_type
                ]

        return valid_rooms

    def solve(self) -> TimetableOutput:
        """Solve the timetabling problem and return assignments."""
        start_time = time.time()

        model = cp_model.CpModel()
        penalty_vars: list = []  # Collect all penalty variables for objective

        # Create decision variables
        lesson_vars: dict[str, list[dict]] = {}

        for lesson in self.data.lessons:
            lesson_vars[lesson.id] = []
            valid_room_ids = self._valid_rooms[lesson.id]

            if not valid_room_ids:
                return TimetableOutput(
                    assignments=[],
                    is_feasible=False,
                    message=f"No valid rooms for lesson {lesson.id} (subject: {lesson.subject_id})",
                )

            for instance_idx in range(lesson.periods_per_week):
                day_var = model.NewIntVar(0, 4, f"day_{lesson.id}_{instance_idx}")
                period_var = model.NewIntVar(1, 6, f"period_{lesson.id}_{instance_idx}")
                room_idx_var = model.NewIntVar(
                    0, len(valid_room_ids) - 1, f"room_idx_{lesson.id}_{instance_idx}"
                )

                lesson_vars[lesson.id].append({
                    "day": day_var,
                    "period": period_var,
                    "room_idx": room_idx_var,
                    "valid_rooms": valid_room_ids,
                })

        # Create slot identifier variables (slot_id = day * 6 + (period - 1))
        slot_vars: dict[str, list] = {}
        for lesson_id, instances in lesson_vars.items():
            slot_vars[lesson_id] = []
            for inst in instances:
                slot_var = model.NewIntVar(0, 29, f"slot_{lesson_id}_{len(slot_vars[lesson_id])}")
                model.Add(slot_var == inst["day"] * 6 + (inst["period"] - 1))
                slot_vars[lesson_id].append(slot_var)

        # Create global room index variables for each instance
        room_global_vars: dict[str, list] = {}
        for lesson_id, instances in lesson_vars.items():
            room_global_vars[lesson_id] = []
            for i, inst in enumerate(instances):
                valid_rooms = inst["valid_rooms"]
                room_global_idx = model.NewIntVar(
                    0, len(self.data.rooms) - 1, f"room_global_{lesson_id}_{i}"
                )
                global_indices = [
                    list(self._rooms.keys()).index(rid) for rid in valid_rooms
                ]
                model.AddElement(inst["room_idx"], global_indices, room_global_idx)
                room_global_vars[lesson_id].append(room_global_idx)

        # =====================================================================
        # HARD CONSTRAINTS
        # =====================================================================

        # HC1: No teacher teaches two classes at the same time
        self._add_teacher_conflict_constraints(model, lesson_vars, slot_vars)

        # HC2: No room has two classes at the same time
        self._add_room_conflict_constraints(model, lesson_vars, slot_vars, room_global_vars)

        # HC3: No student group has two classes at the same time
        self._add_student_group_constraints(model, slot_vars)

        # HC4: Teachers can't be scheduled when unavailable
        self._add_availability_constraints(model, lesson_vars)

        # HC5: Double period lessons must be consecutive
        self._add_double_period_constraints(model, lesson_vars)

        # =====================================================================
        # SOFT CONSTRAINTS (Optimization objectives)
        # =====================================================================

        # SC1: Minimize gaps in teacher schedules
        if self.config.weight_teacher_gaps > 0:
            gap_penalties = self._add_teacher_gap_penalties(model, lesson_vars, slot_vars)
            penalty_vars.extend(gap_penalties)

        # SC2: Room consistency (same teacher uses same room)
        if self.config.weight_room_consistency > 0:
            room_penalties = self._add_room_consistency_penalties(model, lesson_vars, room_global_vars)
            penalty_vars.extend(room_penalties)

        # SC3: Spread subjects across the week
        if self.config.weight_subject_spread > 0:
            spread_penalties = self._add_subject_spread_penalties(model, lesson_vars)
            penalty_vars.extend(spread_penalties)

        # SC4: Balance daily load for teachers
        if self.config.weight_daily_balance > 0:
            balance_penalties = self._add_daily_balance_penalties(model, lesson_vars)
            penalty_vars.extend(balance_penalties)

        # Set objective: minimize total penalties
        if penalty_vars:
            model.Minimize(sum(penalty_vars))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.config.max_time_seconds
        solver.parameters.num_workers = self.config.num_workers

        status = solver.Solve(model)
        solve_time = time.time() - start_time

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            assignments = self._extract_assignments(solver, lesson_vars)
            objective_value = solver.ObjectiveValue() if penalty_vars else 0

            return TimetableOutput(
                assignments=assignments,
                is_feasible=True,
                solve_time_seconds=solve_time,
                message=f"Found {'optimal' if status == cp_model.OPTIMAL else 'feasible'} solution (penalty: {objective_value:.0f})",
            )
        else:
            return TimetableOutput(
                assignments=[],
                is_feasible=False,
                solve_time_seconds=solve_time,
                message=f"No solution found. Status: {solver.StatusName(status)}",
            )

    def _add_teacher_conflict_constraints(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
        slot_vars: dict[str, list],
    ) -> None:
        """HC1: No teacher teaches two classes at the same time."""
        for teacher_id, lesson_ids in self._teacher_lessons.items():
            all_slots = []
            for lid in lesson_ids:
                all_slots.extend(slot_vars[lid])

            if len(all_slots) > 1:
                model.AddAllDifferent(all_slots)

    def _add_room_conflict_constraints(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
        slot_vars: dict[str, list],
        room_global_vars: dict[str, list],
    ) -> None:
        """HC2: No room has two classes at the same time."""
        all_slot_room_vars = []
        num_rooms = len(self.data.rooms)

        for lesson_id in lesson_vars:
            for i, slot_var in enumerate(slot_vars[lesson_id]):
                room_global_idx = room_global_vars[lesson_id][i]

                slot_room_var = model.NewIntVar(
                    0, 29 * num_rooms + num_rooms - 1,
                    f"slot_room_{lesson_id}_{i}"
                )
                model.Add(slot_room_var == slot_var * num_rooms + room_global_idx)
                all_slot_room_vars.append(slot_room_var)

        if len(all_slot_room_vars) > 1:
            model.AddAllDifferent(all_slot_room_vars)

    def _add_student_group_constraints(
        self,
        model: cp_model.CpModel,
        slot_vars: dict[str, list],
    ) -> None:
        """HC3: No student group has two classes at the same time."""
        for group_id, lesson_ids in self._group_lessons.items():
            all_slots = []
            for lid in lesson_ids:
                all_slots.extend(slot_vars[lid])

            if len(all_slots) > 1:
                model.AddAllDifferent(all_slots)

    def _add_availability_constraints(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
    ) -> None:
        """HC4: Teachers can't be scheduled when unavailable."""
        for lesson in self.data.lessons:
            unavailable = self._teacher_unavailable.get(lesson.teacher_id, set())
            if not unavailable:
                continue

            for idx, inst in enumerate(lesson_vars[lesson.id]):
                day_var = inst["day"]
                period_var = inst["period"]

                for unavail_day, unavail_period in unavailable:
                    is_unavail_day = model.NewBoolVar(f"unavail_d_{lesson.id}_{idx}_{unavail_day}")
                    is_unavail_period = model.NewBoolVar(f"unavail_p_{lesson.id}_{idx}_{unavail_period}")

                    model.Add(day_var == unavail_day).OnlyEnforceIf(is_unavail_day)
                    model.Add(day_var != unavail_day).OnlyEnforceIf(is_unavail_day.Not())
                    model.Add(period_var == unavail_period).OnlyEnforceIf(is_unavail_period)
                    model.Add(period_var != unavail_period).OnlyEnforceIf(is_unavail_period.Not())

                    model.AddBoolOr([is_unavail_day.Not(), is_unavail_period.Not()])

    def _add_double_period_constraints(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
    ) -> None:
        """HC5: Double period lessons must be consecutive."""
        for lesson in self.data.lessons:
            if not lesson.requires_double_period:
                continue

            instances = lesson_vars[lesson.id]
            for i in range(0, len(instances) - 1, 2):
                inst1 = instances[i]
                inst2 = instances[i + 1]

                model.Add(inst1["day"] == inst2["day"])
                model.Add(inst2["period"] == inst1["period"] + 1)
                model.Add(inst1["room_idx"] == inst2["room_idx"])
                model.Add(inst1["period"] <= 5)

    def _add_teacher_gap_penalties(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
        slot_vars: dict[str, list],
    ) -> list:
        """SC1: Penalize gaps in teacher schedules."""
        penalty_vars = []
        weight = self.config.weight_teacher_gaps

        for teacher_id, lesson_ids in self._teacher_lessons.items():
            # For each day, we want to minimize gaps between lessons
            # A gap occurs when there's a free period between two teaching periods

            for day in range(5):
                # Collect all period variables for this teacher on this day
                day_period_vars = []

                for lid in lesson_ids:
                    for idx, inst in enumerate(lesson_vars[lid]):
                        # Create a boolean: is this instance on this day?
                        is_this_day = model.NewBoolVar(f"gap_day_{teacher_id}_{lid}_{idx}_{day}")
                        model.Add(inst["day"] == day).OnlyEnforceIf(is_this_day)
                        model.Add(inst["day"] != day).OnlyEnforceIf(is_this_day.Not())

                        # Period value if on this day, 0 otherwise (for tracking)
                        day_period_vars.append((inst["period"], is_this_day, lid, idx))

                if len(day_period_vars) < 2:
                    continue

                # Create indicator variables for each period being used
                period_used = {}
                for p in range(1, 7):
                    period_used[p] = model.NewBoolVar(f"pused_{teacher_id}_{day}_{p}")

                    # period_used[p] = OR of (is_this_day AND period == p) for all instances
                    period_matches = []
                    for period_var, is_day, lid, idx in day_period_vars:
                        match = model.NewBoolVar(f"pmatch_{teacher_id}_{day}_{p}_{lid}_{idx}")
                        is_period_p = model.NewBoolVar(f"isp_{teacher_id}_{day}_{p}_{lid}_{idx}")

                        model.Add(period_var == p).OnlyEnforceIf(is_period_p)
                        model.Add(period_var != p).OnlyEnforceIf(is_period_p.Not())

                        # match = is_day AND is_period_p
                        model.AddBoolAnd([is_day, is_period_p]).OnlyEnforceIf(match)
                        model.AddBoolOr([is_day.Not(), is_period_p.Not()]).OnlyEnforceIf(match.Not())

                        period_matches.append(match)

                    # period_used[p] is true if any match is true
                    model.AddMaxEquality(period_used[p], period_matches)

                # A gap at period p means: not used at p, but used before and after
                for p in range(2, 6):  # Gaps can only be in periods 2-5
                    # Check if there's a lesson before period p
                    has_before = model.NewBoolVar(f"has_before_{teacher_id}_{day}_{p}")
                    before_periods = [period_used[q] for q in range(1, p)]
                    model.AddMaxEquality(has_before, before_periods)

                    # Check if there's a lesson after period p
                    has_after = model.NewBoolVar(f"has_after_{teacher_id}_{day}_{p}")
                    after_periods = [period_used[q] for q in range(p + 1, 7)]
                    model.AddMaxEquality(has_after, after_periods)

                    # Gap exists if: not used AND has_before AND has_after
                    is_gap = model.NewBoolVar(f"gap_{teacher_id}_{day}_{p}")
                    model.AddBoolAnd([period_used[p].Not(), has_before, has_after]).OnlyEnforceIf(is_gap)
                    model.AddBoolOr([period_used[p], has_before.Not(), has_after.Not()]).OnlyEnforceIf(is_gap.Not())

                    # Add weighted penalty for this gap
                    gap_penalty = model.NewIntVar(0, weight, f"gap_pen_{teacher_id}_{day}_{p}")
                    model.Add(gap_penalty == weight).OnlyEnforceIf(is_gap)
                    model.Add(gap_penalty == 0).OnlyEnforceIf(is_gap.Not())
                    penalty_vars.append(gap_penalty)

        return penalty_vars

    def _add_room_consistency_penalties(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
        room_global_vars: dict[str, list],
    ) -> list:
        """SC2: Penalize when same teacher uses different rooms."""
        penalty_vars = []
        weight = self.config.weight_room_consistency

        for teacher_id, lesson_ids in self._teacher_lessons.items():
            # Collect all room assignments for this teacher
            all_rooms = []
            for lid in lesson_ids:
                all_rooms.extend(room_global_vars[lid])

            if len(all_rooms) < 2:
                continue

            # For each pair of room assignments, penalize if different
            # To avoid O(n²), we compare each room to the "preferred" room (first one)
            preferred_room = all_rooms[0]

            for room_var in all_rooms[1:]:
                is_different = model.NewBoolVar(f"room_diff_{teacher_id}_{id(room_var)}")
                model.Add(room_var != preferred_room).OnlyEnforceIf(is_different)
                model.Add(room_var == preferred_room).OnlyEnforceIf(is_different.Not())

                penalty = model.NewIntVar(0, weight, f"room_pen_{teacher_id}_{id(room_var)}")
                model.Add(penalty == weight).OnlyEnforceIf(is_different)
                model.Add(penalty == 0).OnlyEnforceIf(is_different.Not())
                penalty_vars.append(penalty)

        return penalty_vars

    def _add_subject_spread_penalties(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
    ) -> list:
        """SC3: Penalize multiple lessons of same subject on same day for a group."""
        penalty_vars = []
        weight = self.config.weight_subject_spread

        # Group lessons by (student_group, subject)
        group_subject_lessons: dict[tuple[str, str], list[str]] = defaultdict(list)
        for lesson in self.data.lessons:
            key = (lesson.student_group_id, lesson.subject_id)
            group_subject_lessons[key].append(lesson.id)

        for (group_id, subject_id), lesson_ids in group_subject_lessons.items():
            # Collect all day variables for these lessons
            all_day_vars = []
            for lid in lesson_ids:
                for inst in lesson_vars[lid]:
                    all_day_vars.append(inst["day"])

            if len(all_day_vars) < 2:
                continue

            # Penalize when two lessons are on the same day
            for i, day1 in enumerate(all_day_vars):
                for day2 in all_day_vars[i + 1:]:
                    same_day = model.NewBoolVar(f"same_day_{group_id}_{subject_id}_{i}")
                    model.Add(day1 == day2).OnlyEnforceIf(same_day)
                    model.Add(day1 != day2).OnlyEnforceIf(same_day.Not())

                    penalty = model.NewIntVar(0, weight, f"spread_pen_{group_id}_{subject_id}_{i}")
                    model.Add(penalty == weight).OnlyEnforceIf(same_day)
                    model.Add(penalty == 0).OnlyEnforceIf(same_day.Not())
                    penalty_vars.append(penalty)

        return penalty_vars

    def _add_daily_balance_penalties(
        self,
        model: cp_model.CpModel,
        lesson_vars: dict[str, list[dict]],
    ) -> list:
        """SC4: Penalize unbalanced daily teaching loads."""
        penalty_vars = []
        weight = self.config.weight_daily_balance

        for teacher_id, lesson_ids in self._teacher_lessons.items():
            total_periods = sum(
                self._lessons[lid].periods_per_week for lid in lesson_ids
            )

            if total_periods < 5:  # Too few to balance meaningfully
                continue

            # Count lessons per day
            day_counts = []
            for day in range(5):
                day_count = model.NewIntVar(0, 10, f"day_count_{teacher_id}_{day}")

                # Sum up boolean indicators for each instance being on this day
                indicators = []
                for lid in lesson_ids:
                    for idx, inst in enumerate(lesson_vars[lid]):
                        is_this_day = model.NewBoolVar(f"bal_day_{teacher_id}_{lid}_{idx}_{day}")
                        model.Add(inst["day"] == day).OnlyEnforceIf(is_this_day)
                        model.Add(inst["day"] != day).OnlyEnforceIf(is_this_day.Not())
                        indicators.append(is_this_day)

                model.Add(day_count == sum(indicators))
                day_counts.append(day_count)

            # Penalize deviation from ideal (total / 5)
            ideal = total_periods // 5
            for day, day_count in enumerate(day_counts):
                # Deviation = |day_count - ideal|
                deviation = model.NewIntVar(0, 10, f"dev_{teacher_id}_{day}")
                diff = model.NewIntVar(-10, 10, f"diff_{teacher_id}_{day}")
                model.Add(diff == day_count - ideal)
                model.AddAbsEquality(deviation, diff)

                # Only penalize if deviation > 1 (allow some flexibility)
                excess = model.NewIntVar(0, 10, f"excess_{teacher_id}_{day}")
                model.AddMaxEquality(excess, [deviation - 1, model.NewConstant(0)])

                penalty = model.NewIntVar(0, weight * 10, f"bal_pen_{teacher_id}_{day}")
                model.Add(penalty == excess * weight)
                penalty_vars.append(penalty)

        return penalty_vars

    def _extract_assignments(
        self,
        solver: cp_model.CpSolver,
        lesson_vars: dict[str, list[dict]],
    ) -> list[Assignment]:
        """Extract the solution as a list of Assignment objects."""
        assignments = []

        for lesson_id, instances in lesson_vars.items():
            for inst in instances:
                day = solver.Value(inst["day"])
                period = solver.Value(inst["period"])
                room_idx = solver.Value(inst["room_idx"])
                room_id = inst["valid_rooms"][room_idx]

                assignments.append(
                    Assignment(
                        lesson_id=lesson_id,
                        time_slot=TimeSlot(day=day, period=period),
                        room_id=room_id,
                    )
                )

        return assignments


def solve_timetable(
    data: TimetableInput,
    max_time_seconds: float = 60.0,
    config: SolverConfig | None = None,
) -> TimetableOutput:
    """Convenience function to solve a timetabling problem."""
    if config is None:
        config = SolverConfig(max_time_seconds=max_time_seconds)
    else:
        config.max_time_seconds = max_time_seconds

    solver = TimetableSolver(data, config)
    return solver.solve()
