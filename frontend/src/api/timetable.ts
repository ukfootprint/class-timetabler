/**
 * API client for timetable operations
 */

export interface CurrentAssignment {
  lesson_id: string
  day: number
  period: number
  teacher_code: string
  teacher_name: string
  room: string
  student_group: string
  subject: string
}

export interface TimeSlot {
  day: number
  period: number
}

export interface TeacherAvailability {
  teacher_code: string
  teacher_name: string
  unavailable_slots: TimeSlot[]
}

export type RoomType = 'standard' | 'science_lab' | 'computer_room' | 'sports_hall' | 'art_room' | 'music_room'

export interface RoomInfo {
  name: string
  room_type: RoomType
}

export interface SubjectRoomRequirement {
  subject_id: string
  subject_name: string
  required_room_type: RoomType | null
}

export interface MoveCheckRequest {
  lesson_id: string
  source_day: number
  source_period: number
  current_assignments: CurrentAssignment[]
  teacher_availability?: TeacherAvailability[]
  rooms?: RoomInfo[]
  subject_requirements?: SubjectRoomRequirement[]
}

export interface SlotConflict {
  conflict_type: string
  message: string
}

export interface SlotValidation {
  day: number
  period: number
  valid: boolean
  conflicts: SlotConflict[]
}

export interface MoveCheckResponse {
  lesson_id: string
  source_day: number
  source_period: number
  slots: SlotValidation[]
}

export interface MoveLessonRequest {
  lesson_id: string
  source_day: number
  source_period: number
  target_day: number
  target_period: number
  current_assignments: CurrentAssignment[]
}

export interface MoveLessonResponse {
  success: boolean
  message: string
  updated_assignment: CurrentAssignment | null
  conflicts: SlotConflict[]
}

const API_BASE = '/api'

/**
 * Check if a lesson can be moved to various target slots.
 * Returns validation for all 30 slots (5 days × 6 periods).
 */
export async function checkMove(request: MoveCheckRequest): Promise<MoveCheckResponse> {
  const response = await fetch(`${API_BASE}/check-move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Move a lesson from one slot to another.
 * Returns success/failure and the updated assignment.
 */
export async function moveLesson(request: MoveLessonRequest): Promise<MoveLessonResponse> {
  const response = await fetch(`${API_BASE}/move-lesson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Convert frontend TimetableData to CurrentAssignment array for API calls
 */
export function timetableToAssignments(
  data: Record<number, Record<number, {
    lessonId: string
    subject: string
    subjectId: string
    teacher: string
    teacherCode: string
    room: string
    studentGroup: string
  } | null>>
): CurrentAssignment[] {
  const assignments: CurrentAssignment[] = []

  for (let day = 0; day < 5; day++) {
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period]
      if (lesson) {
        assignments.push({
          lesson_id: lesson.lessonId,
          day,
          period,
          teacher_code: lesson.teacherCode,
          teacher_name: lesson.teacher,
          room: lesson.room,
          student_group: lesson.studentGroup,
          subject: lesson.subject,
        })
      }
    }
  }

  return assignments
}
