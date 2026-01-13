"""API routes module."""

from fastapi import APIRouter

from app.models import (
    CurrentAssignment,
    MoveCheckRequest,
    MoveCheckResponse,
    MoveLessonRequest,
    MoveLessonResponse,
    SlotConflict,
    SlotValidation,
)

router = APIRouter()


@router.get("/")
async def root():
    """API root endpoint."""
    return {"message": "School Timetabler API"}


@router.get("/health")
async def health_check():
    """Health check endpoint for frontend connectivity testing."""
    return {"status": "healthy", "service": "timetabler-api"}


@router.post("/check-move", response_model=MoveCheckResponse)
async def check_move(request: MoveCheckRequest) -> MoveCheckResponse:
    """
    Check if a lesson can be moved to various target slots.

    Returns validation for all 30 slots (5 days × 6 periods), indicating
    which moves are valid and what conflicts exist for invalid moves.
    """
    # Find the lesson being moved
    source_assignment = None
    for assignment in request.current_assignments:
        if (
            assignment.lesson_id == request.lesson_id
            and assignment.day == request.source_day
            and assignment.period == request.source_period
        ):
            source_assignment = assignment
            break

    if not source_assignment:
        # Return all slots as invalid if source not found
        return MoveCheckResponse(
            lesson_id=request.lesson_id,
            source_day=request.source_day,
            source_period=request.source_period,
            slots=[
                SlotValidation(
                    day=day,
                    period=period,
                    valid=False,
                    conflicts=[SlotConflict(
                        conflict_type="error",
                        message="Source lesson not found in current assignments"
                    )]
                )
                for day in range(5)
                for period in range(1, 7)
            ]
        )

    # Build lookup map for teacher unavailability
    teacher_unavailability_map: dict[str, set[tuple[int, int]]] = {}
    for ta in request.teacher_availability:
        slots = set()
        for slot in ta.unavailable_slots:
            slots.add((slot.day, slot.period))
        teacher_unavailability_map[ta.teacher_code] = slots

    # Check each possible target slot
    slot_validations = []

    for target_day in range(5):
        for target_period in range(1, 7):
            conflicts = check_slot_conflicts(
                source_assignment=source_assignment,
                target_day=target_day,
                target_period=target_period,
                all_assignments=request.current_assignments,
                teacher_unavailability=teacher_unavailability_map,
            )

            slot_validations.append(SlotValidation(
                day=target_day,
                period=target_period,
                valid=len(conflicts) == 0,
                conflicts=conflicts,
            ))

    return MoveCheckResponse(
        lesson_id=request.lesson_id,
        source_day=request.source_day,
        source_period=request.source_period,
        slots=slot_validations,
    )


DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']


def check_slot_conflicts(
    source_assignment: CurrentAssignment,
    target_day: int,
    target_period: int,
    all_assignments: list[CurrentAssignment],
    teacher_unavailability: dict[str, set[tuple[int, int]]] | None = None,
) -> list[SlotConflict]:
    """
    Check for conflicts when moving a lesson to a target slot.

    Returns a list of conflicts (empty if the move is valid).
    """
    conflicts: list[SlotConflict] = []

    # Can't move to the same slot
    if target_day == source_assignment.day and target_period == source_assignment.period:
        conflicts.append(SlotConflict(
            conflict_type="same_slot",
            message="Cannot move to the same slot"
        ))
        return conflicts

    # Check teacher unavailability
    if teacher_unavailability:
        unavailable_slots = teacher_unavailability.get(source_assignment.teacher_code, set())
        if (target_day, target_period) in unavailable_slots:
            day_name = DAYS[target_day]
            conflicts.append(SlotConflict(
                conflict_type="teacher_unavailable",
                message=f"{source_assignment.teacher_name} is not available on {day_name} Period {target_period}"
            ))

    # Note: Room type validation is not performed during moves because
    # the room assignment stays the same - only the time slot changes.
    # Room type requirements would be enforced when initially assigning
    # a lesson to a room, not when moving between time slots.

    # Check each existing assignment for conflicts at the target slot
    for assignment in all_assignments:
        # Skip the lesson being moved
        if (
            assignment.day == source_assignment.day
            and assignment.period == source_assignment.period
            and assignment.lesson_id == source_assignment.lesson_id
        ):
            continue

        # Only check assignments in the target slot
        if assignment.day != target_day or assignment.period != target_period:
            continue

        # Check for slot already occupied (by any lesson)
        conflicts.append(SlotConflict(
            conflict_type="occupied",
            message=f"Slot already has \"{assignment.subject}\" for {assignment.student_group}"
        ))

        # Check for teacher conflict
        if assignment.teacher_code == source_assignment.teacher_code:
            conflicts.append(SlotConflict(
                conflict_type="teacher",
                message=f"{source_assignment.teacher_name} is already teaching \"{assignment.subject}\" to {assignment.student_group} in this slot"
            ))

        # Check for room conflict
        if assignment.room == source_assignment.room:
            conflicts.append(SlotConflict(
                conflict_type="room",
                message=f"{source_assignment.room} is already booked for \"{assignment.subject}\" ({assignment.student_group})"
            ))

        # Check for student group conflict
        if assignment.student_group == source_assignment.student_group:
            conflicts.append(SlotConflict(
                conflict_type="student_group",
                message=f"{source_assignment.student_group} already has \"{assignment.subject}\" scheduled in this slot"
            ))

    # Deduplicate conflicts by type
    seen_types = set()
    unique_conflicts = []
    for conflict in conflicts:
        if conflict.conflict_type not in seen_types:
            seen_types.add(conflict.conflict_type)
            unique_conflicts.append(conflict)

    return unique_conflicts


@router.post("/move-lesson", response_model=MoveLessonResponse)
async def move_lesson(request: MoveLessonRequest) -> MoveLessonResponse:
    """
    Move a lesson from one slot to another.

    Validates the move and returns success/failure with the updated assignment.
    """
    # Find the lesson being moved
    source_assignment = None
    for assignment in request.current_assignments:
        if (
            assignment.lesson_id == request.lesson_id
            and assignment.day == request.source_day
            and assignment.period == request.source_period
        ):
            source_assignment = assignment
            break

    if not source_assignment:
        return MoveLessonResponse(
            success=False,
            message="Source lesson not found in current assignments",
            conflicts=[SlotConflict(
                conflict_type="error",
                message="Source lesson not found"
            )]
        )

    # Check for conflicts at the target slot
    conflicts = check_slot_conflicts(
        source_assignment=source_assignment,
        target_day=request.target_day,
        target_period=request.target_period,
        all_assignments=request.current_assignments,
    )

    if conflicts:
        return MoveLessonResponse(
            success=False,
            message=f"Cannot move lesson: {conflicts[0].message}",
            conflicts=conflicts
        )

    # Create the updated assignment (move to new slot)
    updated_assignment = CurrentAssignment(
        lesson_id=source_assignment.lesson_id,
        day=request.target_day,
        period=request.target_period,
        teacher_code=source_assignment.teacher_code,
        teacher_name=source_assignment.teacher_name,
        room=source_assignment.room,
        student_group=source_assignment.student_group,
        subject=source_assignment.subject,
    )

    source_day_name = DAYS[request.source_day]
    target_day_name = DAYS[request.target_day]

    return MoveLessonResponse(
        success=True,
        message=f"Successfully moved {source_assignment.student_group} {source_assignment.subject} from {source_day_name} P{request.source_period} to {target_day_name} P{request.target_period}",
        updated_assignment=updated_assignment,
    )
