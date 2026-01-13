"""Test script for the timetable solver."""

from collections import defaultdict

from app.services import load_school_data
from app.solvers import solve_timetable, validate_timetable_input

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def main():
    print("=" * 70)
    print("TIMETABLE SOLVER TEST")
    print("=" * 70)

    # Load data
    print("\nLoading sample school data...")
    data = load_school_data("data/sample_school.json")
    print(f"  Loaded {len(data.lessons)} lessons, {len(data.teachers)} teachers, {len(data.rooms)} rooms")

    # Validate first
    print("\n" + "=" * 70)
    print("STEP 1: FEASIBILITY ANALYSIS")
    print("=" * 70)

    report = validate_timetable_input(data)
    report.print_report()

    if not report.is_feasible:
        print("\nSkipping solver - problem is infeasible. Fix the errors above first.")
        return

    # Solve
    print("\n" + "=" * 70)
    print("STEP 2: SOLVING")
    print("=" * 70)
    print("\nSolving timetable (max 60 seconds)...")
    result = solve_timetable(data, max_time_seconds=60.0)

    # Results
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)
    print(f"\n1. Valid timetable found: {result.is_feasible}")
    print(f"2. Solve time: {result.solve_time_seconds:.2f} seconds")
    print(f"   Message: {result.message}")

    if not result.is_feasible:
        print("\n   No solution found. This may be due to:")
        print("   - Room capacity exceeded (more lessons than room-slots)")
        print("   - Teacher unavailability conflicts")
        print("   - Specialized room shortages (labs, sports hall)")
        return

    print(f"\n3. Total assignments: {len(result.assignments)}")

    # Build lookup maps
    lessons = {l.id: l for l in data.lessons}
    teachers = {t.id: t for t in data.teachers}
    subjects = {s.id: s for s in data.subjects}
    rooms = {r.id: r for r in data.rooms}

    # Teacher schedule summary
    print("\n" + "=" * 70)
    print("TEACHER SCHEDULES (lessons per day)")
    print("=" * 70)

    teacher_schedule = defaultdict(lambda: defaultdict(list))
    for assignment in result.assignments:
        lesson = lessons[assignment.lesson_id]
        teacher_id = lesson.teacher_id
        day = assignment.time_slot.day
        period = assignment.time_slot.period
        subject = subjects[lesson.subject_id]
        room = rooms[assignment.room_id]

        teacher_schedule[teacher_id][day].append({
            "period": period,
            "subject": subject.name,
            "group": lesson.student_group_id.upper(),
            "room": room.name,
        })

    for teacher in data.teachers:
        schedule = teacher_schedule[teacher.id]
        total_periods = sum(len(day_lessons) for day_lessons in schedule.values())

        print(f"\n{teacher.name} ({teacher.code}) - {total_periods} periods/week")
        print("-" * 50)

        for day_idx in range(5):
            day_lessons = sorted(schedule[day_idx], key=lambda x: x["period"])
            if day_lessons:
                lessons_str = ", ".join(
                    f"P{l['period']}:{l['subject'][:3]}({l['group']})"
                    for l in day_lessons
                )
                print(f"  {DAY_NAMES[day_idx]:9s}: {lessons_str}")
            else:
                print(f"  {DAY_NAMES[day_idx]:9s}: --")

    # Room utilization summary
    print("\n" + "=" * 70)
    print("ROOM UTILIZATION")
    print("=" * 70)

    room_usage = defaultdict(int)
    for assignment in result.assignments:
        room_usage[assignment.room_id] += 1

    for room in data.rooms:
        usage = room_usage[room.id]
        bar = "█" * (usage // 2)
        print(f"  {room.name:20s}: {usage:2d}/30 periods ({usage/30*100:5.1f}%) {bar}")


if __name__ == "__main__":
    main()
