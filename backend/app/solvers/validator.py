"""Validation and diagnostics for timetable feasibility."""

from collections import defaultdict
from dataclasses import dataclass, field

from app.models import TimetableInput, RoomType


@dataclass
class ConstraintIssue:
    """Represents a constraint violation or potential issue."""

    severity: str  # "ERROR" (impossible), "WARNING" (tight), "INFO"
    category: str
    message: str
    details: dict = field(default_factory=dict)


@dataclass
class ValidationReport:
    """Complete validation report for a timetabling problem."""

    is_feasible: bool
    issues: list[ConstraintIssue]
    summary: dict

    def print_report(self) -> None:
        """Print a formatted validation report."""
        print("=" * 70)
        print("TIMETABLE FEASIBILITY ANALYSIS")
        print("=" * 70)

        # Summary
        print(f"\nOVERALL: {'POTENTIALLY FEASIBLE' if self.is_feasible else 'INFEASIBLE'}")

        errors = [i for i in self.issues if i.severity == "ERROR"]
        warnings = [i for i in self.issues if i.severity == "WARNING"]
        infos = [i for i in self.issues if i.severity == "INFO"]

        print(f"  Errors: {len(errors)}, Warnings: {len(warnings)}, Info: {len(infos)}")

        # Errors first
        if errors:
            print("\n" + "=" * 70)
            print("ERRORS (these make the problem IMPOSSIBLE to solve)")
            print("=" * 70)
            for issue in errors:
                print(f"\n[{issue.category}]")
                print(f"  {issue.message}")
                if issue.details:
                    for key, value in issue.details.items():
                        print(f"    - {key}: {value}")

        # Warnings
        if warnings:
            print("\n" + "=" * 70)
            print("WARNINGS (tight constraints that may cause issues)")
            print("=" * 70)
            for issue in warnings:
                print(f"\n[{issue.category}]")
                print(f"  {issue.message}")
                if issue.details:
                    for key, value in issue.details.items():
                        print(f"    - {key}: {value}")

        # Info
        if infos:
            print("\n" + "=" * 70)
            print("INFO")
            print("=" * 70)
            for issue in infos:
                print(f"  [{issue.category}] {issue.message}")

        print("\n" + "=" * 70)


def validate_timetable_input(data: TimetableInput) -> ValidationReport:
    """Analyze timetable input for feasibility issues."""
    issues: list[ConstraintIssue] = []
    summary: dict = {}

    # Build lookup maps
    teachers = {t.id: t for t in data.teachers}
    subjects = {s.id: s for s in data.subjects}
    rooms = {r.id: r for r in data.rooms}
    student_groups = {sg.id: sg for sg in data.student_groups}

    total_slots = 30  # 5 days × 6 periods

    # =========================================================================
    # CHECK 1: Overall room capacity
    # =========================================================================
    total_periods = sum(l.periods_per_week for l in data.lessons)
    total_room_slots = total_slots * len(data.rooms)
    utilization = total_periods / total_room_slots * 100

    summary["total_periods"] = total_periods
    summary["total_room_slots"] = total_room_slots
    summary["utilization"] = utilization

    if total_periods > total_room_slots:
        issues.append(ConstraintIssue(
            severity="ERROR",
            category="ROOM CAPACITY",
            message=f"More lesson periods ({total_periods}) than available room-slots ({total_room_slots})",
            details={
                "periods_needed": total_periods,
                "slots_available": total_room_slots,
                "shortfall": total_periods - total_room_slots,
                "rooms_needed": f"At least {(total_periods // total_slots) + 1} rooms",
            }
        ))
    elif utilization > 90:
        issues.append(ConstraintIssue(
            severity="WARNING",
            category="ROOM CAPACITY",
            message=f"Room utilization is very high ({utilization:.1f}%)",
            details={"utilization": f"{utilization:.1f}%"}
        ))

    # =========================================================================
    # CHECK 2: Specialized room capacity
    # =========================================================================
    room_type_slots: dict[RoomType, int] = defaultdict(int)
    for room in data.rooms:
        room_type_slots[room.room_type] = room_type_slots.get(room.room_type, 0) + total_slots

    room_type_demand: dict[RoomType, int] = defaultdict(int)
    for lesson in data.lessons:
        subject = subjects[lesson.subject_id]
        if subject.requires_room_type:
            room_type_demand[subject.requires_room_type] += lesson.periods_per_week

    for room_type in set(room_type_demand.keys()) | set(room_type_slots.keys()):
        demand = room_type_demand.get(room_type, 0)
        supply = room_type_slots.get(room_type, 0)

        if demand > 0:
            if supply == 0:
                issues.append(ConstraintIssue(
                    severity="ERROR",
                    category="SPECIALIZED ROOMS",
                    message=f"No {room_type.value} available but {demand} periods require it",
                    details={"room_type": room_type.value, "periods_needed": demand}
                ))
            elif demand > supply:
                issues.append(ConstraintIssue(
                    severity="ERROR",
                    category="SPECIALIZED ROOMS",
                    message=f"{room_type.value}: {demand} periods needed but only {supply} slots available",
                    details={
                        "room_type": room_type.value,
                        "periods_needed": demand,
                        "slots_available": supply,
                        "shortfall": demand - supply,
                    }
                ))
            elif demand / supply > 0.9:
                issues.append(ConstraintIssue(
                    severity="WARNING",
                    category="SPECIALIZED ROOMS",
                    message=f"{room_type.value} utilization is high ({demand}/{supply} = {demand/supply*100:.1f}%)",
                    details={"room_type": room_type.value, "utilization": f"{demand/supply*100:.1f}%"}
                ))

    # =========================================================================
    # CHECK 3: Teacher workload vs availability
    # =========================================================================
    teacher_workload: dict[str, int] = defaultdict(int)
    teacher_lessons: dict[str, list] = defaultdict(list)

    for lesson in data.lessons:
        teacher_workload[lesson.teacher_id] += lesson.periods_per_week
        teacher_lessons[lesson.teacher_id].append(lesson)

    for teacher in data.teachers:
        workload = teacher_workload[teacher.id]
        available_slots = total_slots - len(teacher.unavailable)

        # Check against max hours
        if workload > teacher.max_hours_per_week:
            issues.append(ConstraintIssue(
                severity="ERROR",
                category="TEACHER OVERLOAD",
                message=f"{teacher.name} ({teacher.code}): assigned {workload} periods but max is {teacher.max_hours_per_week}",
                details={
                    "teacher": teacher.name,
                    "assigned_periods": workload,
                    "max_hours": teacher.max_hours_per_week,
                    "overload": workload - teacher.max_hours_per_week,
                }
            ))

        # Check against available slots
        if workload > available_slots:
            issues.append(ConstraintIssue(
                severity="ERROR",
                category="TEACHER AVAILABILITY",
                message=f"{teacher.name} ({teacher.code}): assigned {workload} periods but only {available_slots} slots available",
                details={
                    "teacher": teacher.name,
                    "assigned_periods": workload,
                    "available_slots": available_slots,
                    "unavailable_slots": len(teacher.unavailable),
                }
            ))
        elif available_slots > 0 and workload / available_slots > 0.9:
            issues.append(ConstraintIssue(
                severity="WARNING",
                category="TEACHER AVAILABILITY",
                message=f"{teacher.name} ({teacher.code}): {workload}/{available_slots} slots used ({workload/available_slots*100:.1f}%)",
                details={"teacher": teacher.name}
            ))

    # =========================================================================
    # CHECK 4: Student group schedule capacity
    # =========================================================================
    group_periods: dict[str, int] = defaultdict(int)
    for lesson in data.lessons:
        group_periods[lesson.student_group_id] += lesson.periods_per_week

    for sg in data.student_groups:
        periods = group_periods[sg.id]
        if periods > total_slots:
            issues.append(ConstraintIssue(
                severity="ERROR",
                category="STUDENT GROUP OVERLOAD",
                message=f"{sg.name}: {periods} periods scheduled but only {total_slots} slots in a week",
                details={
                    "group": sg.name,
                    "periods": periods,
                    "max_slots": total_slots,
                    "overload": periods - total_slots,
                }
            ))
        elif periods / total_slots > 0.9:
            issues.append(ConstraintIssue(
                severity="WARNING",
                category="STUDENT GROUP",
                message=f"{sg.name}: schedule is {periods/total_slots*100:.1f}% full ({periods}/{total_slots})",
            ))

    # =========================================================================
    # CHECK 5: Double period feasibility
    # =========================================================================
    double_period_lessons = [l for l in data.lessons if l.requires_double_period]
    if double_period_lessons:
        # Double periods can only start in periods 1-5 (not 6)
        max_double_slots_per_day = 5  # periods 1-2, 2-3, 3-4, 4-5, 5-6
        max_double_slots = max_double_slots_per_day * 5  # per week

        # Group by teacher and student group
        teacher_doubles: dict[str, int] = defaultdict(int)
        group_doubles: dict[str, int] = defaultdict(int)

        for lesson in double_period_lessons:
            # Each double period lesson uses periods_per_week / 2 double slots
            num_doubles = lesson.periods_per_week // 2
            teacher_doubles[lesson.teacher_id] += num_doubles
            group_doubles[lesson.student_group_id] += num_doubles

        issues.append(ConstraintIssue(
            severity="INFO",
            category="DOUBLE PERIODS",
            message=f"{len(double_period_lessons)} lessons require double periods",
        ))

    # =========================================================================
    # CHECK 6: Subject-teacher assignment validation
    # =========================================================================
    for lesson in data.lessons:
        teacher = teachers.get(lesson.teacher_id)
        if teacher and lesson.subject_id not in teacher.subject_ids:
            issues.append(ConstraintIssue(
                severity="WARNING",
                category="TEACHER-SUBJECT MISMATCH",
                message=f"Lesson {lesson.id}: {teacher.name} assigned to teach {lesson.subject_id} but it's not in their subjects",
                details={
                    "teacher": teacher.name,
                    "assigned_subject": lesson.subject_id,
                    "teacher_subjects": teacher.subject_ids,
                }
            ))

    # Determine overall feasibility
    has_errors = any(i.severity == "ERROR" for i in issues)

    return ValidationReport(
        is_feasible=not has_errors,
        issues=issues,
        summary=summary,
    )
