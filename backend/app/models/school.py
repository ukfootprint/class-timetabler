"""Pydantic models for the school timetabling domain."""

from enum import Enum
from pydantic import BaseModel, Field


class RoomType(str, Enum):
    """Types of rooms available in the school."""

    STANDARD = "standard"
    SCIENCE_LAB = "science_lab"
    COMPUTER_ROOM = "computer_room"
    SPORTS_HALL = "sports_hall"
    ART_ROOM = "art_room"
    MUSIC_ROOM = "music_room"
    LIBRARY = "library"


class TimeSlot(BaseModel):
    """Represents a specific period in the weekly timetable."""

    day: int = Field(..., ge=0, le=4, description="Day of week (0=Monday, 4=Friday)")
    period: int = Field(..., ge=1, le=6, description="Period number (1-6)")

    def __hash__(self) -> int:
        return hash((self.day, self.period))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, TimeSlot):
            return False
        return self.day == other.day and self.period == other.period


class Subject(BaseModel):
    """A subject that can be taught."""

    id: str
    name: str
    requires_room_type: RoomType | None = None


class Teacher(BaseModel):
    """A teacher who can teach one or more subjects."""

    id: str
    name: str
    code: str = Field(..., description="Teacher initials/code")
    subject_ids: list[str] = Field(default_factory=list, description="IDs of subjects this teacher can teach")
    max_hours_per_week: int = Field(default=25, ge=1, le=40)
    unavailable: list[TimeSlot] = Field(
        default_factory=list,
        description="Time slots when the teacher is NOT available",
    )


class Room(BaseModel):
    """A room where lessons can be held."""

    id: str
    name: str
    capacity: int = Field(..., ge=1, description="Maximum number of students")
    room_type: RoomType = RoomType.STANDARD


class StudentGroup(BaseModel):
    """A group of students (e.g., a class) that takes lessons together."""

    id: str
    name: str
    year_group: int = Field(..., ge=1, le=13, description="Year/grade level")
    size: int = Field(..., ge=1, description="Number of students in the group")


class Lesson(BaseModel):
    """A lesson that needs to be scheduled in the timetable."""

    id: str
    subject_id: str
    teacher_id: str
    student_group_id: str
    periods_per_week: int = Field(..., ge=1, le=10, description="Number of periods per week")
    requires_double_period: bool = Field(
        default=False,
        description="If true, lessons must be scheduled in consecutive periods",
    )


class Assignment(BaseModel):
    """An assignment of a lesson to a specific time slot and room."""

    lesson_id: str
    time_slot: TimeSlot
    room_id: str


class TimetableInput(BaseModel):
    """Complete input data for generating a timetable."""

    teachers: list[Teacher]
    rooms: list[Room]
    subjects: list[Subject]
    student_groups: list[StudentGroup]
    lessons: list[Lesson]


class TimetableOutput(BaseModel):
    """The generated timetable solution."""

    assignments: list[Assignment]
    is_feasible: bool = True
    solve_time_seconds: float | None = None
    message: str | None = None


# ============================================================================
# Move Check API Models
# ============================================================================


class CurrentAssignment(BaseModel):
    """A lesson currently assigned in the timetable (frontend representation)."""

    lesson_id: str
    day: int = Field(..., ge=0, le=4)
    period: int = Field(..., ge=1, le=6)
    teacher_code: str
    teacher_name: str
    room: str
    student_group: str
    subject: str


class TeacherAvailability(BaseModel):
    """Teacher availability information for validation."""

    teacher_code: str
    teacher_name: str
    unavailable_slots: list[TimeSlot] = Field(
        default_factory=list,
        description="Time slots when teacher is NOT available"
    )


class RoomInfo(BaseModel):
    """Room information including type for validation."""

    name: str
    room_type: RoomType = RoomType.STANDARD


class SubjectRoomRequirement(BaseModel):
    """Subject room type requirement."""

    subject_id: str
    subject_name: str
    required_room_type: RoomType | None = None


class MoveCheckRequest(BaseModel):
    """Request to check if a lesson can be moved to various target slots."""

    lesson_id: str = Field(..., description="ID of the lesson being moved")
    source_day: int = Field(..., ge=0, le=4, description="Current day of the lesson")
    source_period: int = Field(..., ge=1, le=6, description="Current period of the lesson")
    current_assignments: list[CurrentAssignment] = Field(
        ..., description="All current assignments in the timetable"
    )
    teacher_availability: list[TeacherAvailability] = Field(
        default_factory=list,
        description="Teacher availability information"
    )
    rooms: list[RoomInfo] = Field(
        default_factory=list,
        description="Room information including types"
    )
    subject_requirements: list[SubjectRoomRequirement] = Field(
        default_factory=list,
        description="Subject room type requirements"
    )


class SlotConflict(BaseModel):
    """A conflict preventing a lesson from being placed in a slot."""

    conflict_type: str = Field(..., description="Type: 'occupied', 'teacher', 'room', 'student_group'")
    message: str = Field(..., description="Human-readable conflict description")


class SlotValidation(BaseModel):
    """Validation result for a single target slot."""

    day: int
    period: int
    valid: bool
    conflicts: list[SlotConflict] = Field(default_factory=list)


class MoveCheckResponse(BaseModel):
    """Response containing validation for all possible target slots."""

    lesson_id: str
    source_day: int
    source_period: int
    slots: list[SlotValidation] = Field(
        ..., description="Validation for all 30 slots (5 days × 6 periods)"
    )


class MoveLessonRequest(BaseModel):
    """Request to move a lesson from one slot to another."""

    lesson_id: str = Field(..., description="ID of the lesson being moved")
    source_day: int = Field(..., ge=0, le=4, description="Current day of the lesson")
    source_period: int = Field(..., ge=1, le=6, description="Current period of the lesson")
    target_day: int = Field(..., ge=0, le=4, description="Target day for the lesson")
    target_period: int = Field(..., ge=1, le=6, description="Target period for the lesson")
    current_assignments: list[CurrentAssignment] = Field(
        ..., description="All current assignments in the timetable"
    )


class MoveLessonResponse(BaseModel):
    """Response after attempting to move a lesson."""

    success: bool = Field(..., description="Whether the move was successful")
    message: str = Field(..., description="Human-readable result message")
    updated_assignment: CurrentAssignment | None = Field(
        None, description="The updated assignment if successful"
    )
    conflicts: list[SlotConflict] = Field(
        default_factory=list, description="Conflicts if move failed"
    )
