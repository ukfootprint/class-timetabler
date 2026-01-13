"""Utility module for loading and analyzing school timetable data."""

import json
from collections import Counter
from pathlib import Path

from app.models import TimetableInput


def load_school_data(file_path: str | Path) -> TimetableInput:
    """Load school data from a JSON file and return validated Pydantic models."""
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {file_path}")

    with open(file_path) as f:
        data = json.load(f)

    return TimetableInput(**data)


def get_summary_statistics(data: TimetableInput) -> dict:
    """Generate summary statistics for the timetable data."""
    total_periods = sum(lesson.periods_per_week for lesson in data.lessons)
    double_period_lessons = sum(1 for lesson in data.lessons if lesson.requires_double_period)

    # Teacher workload
    teacher_periods = Counter()
    for lesson in data.lessons:
        teacher_periods[lesson.teacher_id] += lesson.periods_per_week

    # Room type counts
    room_types = Counter(room.room_type.value for room in data.rooms)

    # Student group sizes by year
    year_groups = {}
    for sg in data.student_groups:
        if sg.year_group not in year_groups:
            year_groups[sg.year_group] = {"classes": 0, "total_students": 0}
        year_groups[sg.year_group]["classes"] += 1
        year_groups[sg.year_group]["total_students"] += sg.size

    # Part-time teachers
    part_time_teachers = [t for t in data.teachers if t.unavailable]

    # Available slots per week (5 days × 6 periods)
    total_slots = 5 * 6

    return {
        "teachers": {
            "total": len(data.teachers),
            "full_time": len(data.teachers) - len(part_time_teachers),
            "part_time": len(part_time_teachers),
            "workload": {
                t.code: teacher_periods[t.id] for t in data.teachers
            },
        },
        "rooms": {
            "total": len(data.rooms),
            "by_type": dict(room_types),
        },
        "subjects": {
            "total": len(data.subjects),
            "names": [s.name for s in data.subjects],
        },
        "student_groups": {
            "total": len(data.student_groups),
            "by_year": year_groups,
            "total_students": sum(sg.size for sg in data.student_groups),
        },
        "lessons": {
            "total": len(data.lessons),
            "total_periods_per_week": total_periods,
            "requiring_double_period": double_period_lessons,
        },
        "scheduling": {
            "slots_per_week": total_slots,
            "room_utilization_estimate": f"{(total_periods / (total_slots * len(data.rooms))) * 100:.1f}%",
        },
    }


def print_summary(data: TimetableInput) -> None:
    """Print a formatted summary of the timetable data."""
    stats = get_summary_statistics(data)

    print("=" * 60)
    print("SCHOOL TIMETABLE DATA SUMMARY")
    print("=" * 60)

    print(f"\nTEACHERS: {stats['teachers']['total']}")
    print(f"  Full-time: {stats['teachers']['full_time']}")
    print(f"  Part-time: {stats['teachers']['part_time']}")

    print(f"\nROOMS: {stats['rooms']['total']}")
    for room_type, count in stats["rooms"]["by_type"].items():
        print(f"  {room_type}: {count}")

    print(f"\nSUBJECTS: {stats['subjects']['total']}")
    print(f"  {', '.join(stats['subjects']['names'])}")

    print(f"\nSTUDENT GROUPS: {stats['student_groups']['total']}")
    print(f"  Total students: {stats['student_groups']['total_students']}")
    for year, info in sorted(stats["student_groups"]["by_year"].items()):
        print(f"  Year {year}: {info['classes']} classes, {info['total_students']} students")

    print(f"\nLESSONS: {stats['lessons']['total']}")
    print(f"  Total periods per week: {stats['lessons']['total_periods_per_week']}")
    print(f"  Requiring double periods: {stats['lessons']['requiring_double_period']}")

    print(f"\nSCHEDULING METRICS:")
    print(f"  Time slots per week: {stats['scheduling']['slots_per_week']}")
    print(f"  Estimated room utilization: {stats['scheduling']['room_utilization_estimate']}")

    print("\nTEACHER WORKLOAD (periods/week):")
    workload = stats["teachers"]["workload"]
    for code, periods in sorted(workload.items(), key=lambda x: -x[1]):
        bar = "█" * (periods // 2)
        print(f"  {code}: {periods:2d} {bar}")

    print("=" * 60)


if __name__ == "__main__":
    # Quick test when run directly
    data = load_school_data("data/sample_school.json")
    print_summary(data)
