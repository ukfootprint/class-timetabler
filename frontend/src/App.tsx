import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  TimetableGrid,
  Sidebar,
  MasterView,
  ConfirmMoveDialog,
  RoomSelectionDialog,
  ErrorBoundary,
  ErrorMessage,
  LoadingSpinner,
  ConnectionError,
  Toast,
  parseApiError,
  SchoolIcon,
  CalendarIcon,
} from './components'
import type {
  TimetableData,
  ViewSelection,
  Teacher,
  Room,
  StudentGroup,
  LessonSlot,
  PendingMove,
  ApiError,
  RoomOption,
  RoomSelectionDetails,
} from './components'
import { checkMove, moveLesson, timetableToAssignments as toApiAssignments } from './api/timetable'
import type { SlotValidation, TeacherAvailability } from './api/timetable'

// Deep clone helper for timetable data
function cloneTimetable(data: TimetableData): TimetableData {
  const clone: TimetableData = {}
  for (let day = 0; day < 5; day++) {
    clone[day] = {}
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period]
      clone[day][period] = lesson ? { ...lesson } : null
    }
  }
  return clone
}

// Sample entity data
const TEACHERS: Teacher[] = [
  { id: 'smi', name: 'Sarah Mitchell', code: 'SMI' },
  { id: 'eda', name: 'Emma Davies', code: 'EDA' },
  { id: 'rgr', name: 'Rachel Green', code: 'RGR' },
  { id: 'pdu', name: 'Philippe Dubois', code: 'PDU' },
  { id: 'lhu', name: 'Laura Hughes', code: 'LHU' },
  { id: 'jcl', name: 'Jennifer Clark', code: 'JCL' },
  { id: 'mjo', name: 'Marcus Johnson', code: 'MJO' },
  { id: 'dch', name: 'Daniel Chen', code: 'DCH' },
]

const ROOMS: Room[] = [
  { id: 'r101', name: 'Room 101', type: 'Standard' },
  { id: 'r102', name: 'Room 102', type: 'Standard' },
  { id: 'r103', name: 'Room 103', type: 'Standard' },
  { id: 'r104', name: 'Room 104', type: 'Standard' },
  { id: 'r201', name: 'Room 201', type: 'Standard' },
  { id: 'sci1', name: 'Science Lab 1', type: 'Science Lab' },
  { id: 'cmp1', name: 'Computer Suite 1', type: 'Computer Room' },
  { id: 'sph', name: 'Sports Hall', type: 'Sports Hall' },
]

const STUDENT_GROUPS: StudentGroup[] = [
  { id: '7a', name: 'Year 7A', yearGroup: 7 },
  { id: '7b', name: 'Year 7B', yearGroup: 7 },
  { id: '8a', name: 'Year 8A', yearGroup: 8 },
  { id: '8b', name: 'Year 8B', yearGroup: 8 },
  { id: '9a', name: 'Year 9A', yearGroup: 9 },
  { id: '9b', name: 'Year 9B', yearGroup: 9 },
]

// Teacher availability data (unavailable slots)
const TEACHER_AVAILABILITY: TeacherAvailability[] = [
  {
    teacher_code: 'SMI',
    teacher_name: 'Sarah Mitchell',
    unavailable_slots: [
      { day: 0, period: 4 }, // Monday P4 - meeting
      { day: 2, period: 5 }, // Wednesday P5 - part-time
      { day: 2, period: 6 }, // Wednesday P6 - part-time
      { day: 4, period: 5 }, // Friday P5 - early finish
      { day: 4, period: 6 }, // Friday P6 - early finish
    ],
  },
  {
    teacher_code: 'PDU',
    teacher_name: 'Philippe Dubois',
    unavailable_slots: [
      { day: 0, period: 1 }, // Monday P1 - late start
      { day: 0, period: 2 }, // Monday P2 - late start
      { day: 4, period: 1 }, // Friday P1 - late start
    ],
  },
  {
    teacher_code: 'MJO',
    teacher_name: 'Marcus Johnson',
    unavailable_slots: [
      { day: 2, period: 1 }, // Wednesday P1 - training
      { day: 2, period: 2 }, // Wednesday P2 - training
    ],
  },
]

// Subject to room type requirements
const SUBJECT_ROOM_REQUIREMENTS: Record<string, string | null> = {
  sci: 'Science Lab',
  cmp: 'Computer Room',
  pe: 'Sports Hall',
  eng: null,
  mat: null,
  his: null,
  geo: null,
  fre: null,
}

// Demo timetable data for Year 7A
const DEMO_TIMETABLE: TimetableData = {
  0: {
    1: { lessonId: 'l001', subject: 'English', subjectId: 'eng', teacher: 'Sarah Mitchell', teacherCode: 'SMI', room: 'Room 101', studentGroup: 'Year 7A' },
    2: { lessonId: 'l004', subject: 'Maths', subjectId: 'mat', teacher: 'Emma Davies', teacherCode: 'EDA', room: 'Room 102', studentGroup: 'Year 7A' },
    3: { lessonId: 'l007', subject: 'Science', subjectId: 'sci', teacher: 'Rachel Green', teacherCode: 'RGR', room: 'Science Lab 1', studentGroup: 'Year 7A' },
    4: null,
    5: { lessonId: 'l019', subject: 'PE', subjectId: 'pe', teacher: 'Marcus Johnson', teacherCode: 'MJO', room: 'Sports Hall', studentGroup: 'Year 7A' },
    6: { lessonId: 'l019', subject: 'PE', subjectId: 'pe', teacher: 'Marcus Johnson', teacherCode: 'MJO', room: 'Sports Hall', studentGroup: 'Year 7A' },
  },
  1: {
    1: { lessonId: 'l016', subject: 'French', subjectId: 'fre', teacher: 'Philippe Dubois', teacherCode: 'PDU', room: 'Room 103', studentGroup: 'Year 7A' },
    2: { lessonId: 'l010', subject: 'History', subjectId: 'his', teacher: 'Laura Hughes', teacherCode: 'LHU', room: 'Room 104', studentGroup: 'Year 7A' },
    3: { lessonId: 'l004', subject: 'Maths', subjectId: 'mat', teacher: 'Emma Davies', teacherCode: 'EDA', room: 'Room 102', studentGroup: 'Year 7A' },
    4: { lessonId: 'l022', subject: 'Computing', subjectId: 'cmp', teacher: 'Daniel Chen', teacherCode: 'DCH', room: 'Computer Suite 1', studentGroup: 'Year 7A' },
    5: { lessonId: 'l001', subject: 'English', subjectId: 'eng', teacher: 'Sarah Mitchell', teacherCode: 'SMI', room: 'Room 101', studentGroup: 'Year 7A' },
    6: null,
  },
  2: {
    1: { lessonId: 'l013', subject: 'Geography', subjectId: 'geo', teacher: 'Jennifer Clark', teacherCode: 'JCL', room: 'Room 201', studentGroup: 'Year 7A' },
    2: { lessonId: 'l007', subject: 'Science', subjectId: 'sci', teacher: 'Rachel Green', teacherCode: 'RGR', room: 'Science Lab 1', studentGroup: 'Year 7A' },
    3: { lessonId: 'l016', subject: 'French', subjectId: 'fre', teacher: 'Philippe Dubois', teacherCode: 'PDU', room: 'Room 103', studentGroup: 'Year 7A' },
    4: { lessonId: 'l004', subject: 'Maths', subjectId: 'mat', teacher: 'Emma Davies', teacherCode: 'EDA', room: 'Room 102', studentGroup: 'Year 7A' },
    5: { lessonId: 'l001', subject: 'English', subjectId: 'eng', teacher: 'Sarah Mitchell', teacherCode: 'SMI', room: 'Room 101', studentGroup: 'Year 7A' },
    6: { lessonId: 'l022', subject: 'Computing', subjectId: 'cmp', teacher: 'Daniel Chen', teacherCode: 'DCH', room: 'Computer Suite 1', studentGroup: 'Year 7A' },
  },
  3: {
    1: { lessonId: 'l007', subject: 'Science', subjectId: 'sci', teacher: 'Rachel Green', teacherCode: 'RGR', room: 'Science Lab 1', studentGroup: 'Year 7A' },
    2: { lessonId: 'l010', subject: 'History', subjectId: 'his', teacher: 'Laura Hughes', teacherCode: 'LHU', room: 'Room 104', studentGroup: 'Year 7A' },
    3: { lessonId: 'l001', subject: 'English', subjectId: 'eng', teacher: 'Sarah Mitchell', teacherCode: 'SMI', room: 'Room 101', studentGroup: 'Year 7A' },
    4: { lessonId: 'l016', subject: 'French', subjectId: 'fre', teacher: 'Philippe Dubois', teacherCode: 'PDU', room: 'Room 103', studentGroup: 'Year 7A' },
    5: { lessonId: 'l004', subject: 'Maths', subjectId: 'mat', teacher: 'Emma Davies', teacherCode: 'EDA', room: 'Room 102', studentGroup: 'Year 7A' },
    6: { lessonId: 'l013', subject: 'Geography', subjectId: 'geo', teacher: 'Jennifer Clark', teacherCode: 'JCL', room: 'Room 201', studentGroup: 'Year 7A' },
  },
  4: {
    1: { lessonId: 'l004', subject: 'Maths', subjectId: 'mat', teacher: 'Emma Davies', teacherCode: 'EDA', room: 'Room 102', studentGroup: 'Year 7A' },
    2: { lessonId: 'l001', subject: 'English', subjectId: 'eng', teacher: 'Sarah Mitchell', teacherCode: 'SMI', room: 'Room 101', studentGroup: 'Year 7A' },
    3: null,
    4: { lessonId: 'l007', subject: 'Science', subjectId: 'sci', teacher: 'Rachel Green', teacherCode: 'RGR', room: 'Science Lab 1', studentGroup: 'Year 7A' },
    5: { lessonId: 'l016', subject: 'French', subjectId: 'fre', teacher: 'Philippe Dubois', teacherCode: 'PDU', room: 'Room 103', studentGroup: 'Year 7A' },
    6: null,
  },
}

// Convert timetable data to flat assignments for MasterView
function timetableToAssignments(data: TimetableData) {
  const assignments: Array<{
    lessonId: string
    day: number
    period: number
    roomId: string
  }> = []

  for (let day = 0; day < 5; day++) {
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period]
      if (lesson) {
        const roomId = lesson.room.toLowerCase().replace(/\s+/g, '')
        assignments.push({
          lessonId: lesson.lessonId,
          day,
          period,
          roomId,
        })
      }
    }
  }

  return assignments
}

// Build lessons map from timetable
function buildLessonsMap(data: TimetableData) {
  const lessons = new Map<string, { subjectId: string; teacherId: string; studentGroupId: string }>()

  for (let day = 0; day < 5; day++) {
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period]
      if (lesson && !lessons.has(lesson.lessonId)) {
        lessons.set(lesson.lessonId, {
          subjectId: lesson.subjectId,
          teacherId: lesson.teacherCode.toLowerCase(),
          studentGroupId: lesson.studentGroup.toLowerCase().replace(/\s+/g, ''),
        })
      }
    }
  }

  return lessons
}

// Filter timetable data by teacher
function filterByTeacher(data: TimetableData, teacherCode: string): TimetableData {
  const filtered: TimetableData = {}
  for (let day = 0; day < 5; day++) {
    filtered[day] = {}
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period] as LessonSlot | null
      if (lesson && lesson.teacherCode === teacherCode) {
        filtered[day][period] = lesson
      } else {
        filtered[day][period] = null
      }
    }
  }
  return filtered
}

// Filter timetable data by room
function filterByRoom(data: TimetableData, roomName: string): TimetableData {
  const filtered: TimetableData = {}
  for (let day = 0; day < 5; day++) {
    filtered[day] = {}
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period] as LessonSlot | null
      if (lesson && lesson.room === roomName) {
        filtered[day][period] = lesson
      } else {
        filtered[day][period] = null
      }
    }
  }
  return filtered
}

// Filter timetable data by student group
function filterByGroup(data: TimetableData, groupName: string): TimetableData {
  const filtered: TimetableData = {}
  for (let day = 0; day < 5; day++) {
    filtered[day] = {}
    const periods = data[day]
    if (!periods) continue
    for (let period = 1; period <= 6; period++) {
      const lesson = periods[period] as LessonSlot | null
      if (lesson && lesson.studentGroup === groupName) {
        filtered[day][period] = lesson
      } else {
        filtered[day][period] = null
      }
    }
  }
  return filtered
}

// Check if backend is available
async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

function App() {
  const [currentView, setCurrentView] = useState<ViewSelection>({
    type: 'master',
    label: 'Master View',
  })

  // Stateful timetable data - can be modified via drag and drop
  const [timetableData, setTimetableData] = useState<TimetableData>(DEMO_TIMETABLE)

  // State for the move confirmation dialog
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  // State for room selection dialog
  const [showRoomSelection, setShowRoomSelection] = useState(false)
  const [roomSelectionDetails, setRoomSelectionDetails] = useState<RoomSelectionDetails | null>(null)
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([])

  // Connection and error state
  const [isConnected, setIsConnected] = useState<boolean | null>(null) // null = checking
  const [globalError, setGlobalError] = useState<ApiError | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const [isCheckingMove, setIsCheckingMove] = useState(false)

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(setIsConnected)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Retry connection
  const handleRetryConnection = useCallback(async () => {
    setIsConnected(null) // Show loading
    const connected = await checkBackendHealth()
    setIsConnected(connected)
  }, [])

  // Compute available rooms for a given time slot
  const computeAvailableRooms = useCallback(
    (targetDay: number, targetPeriod: number, subjectId: string): RoomOption[] => {
      const requiredRoomType = SUBJECT_ROOM_REQUIREMENTS[subjectId] || null

      // Build a map of which rooms are occupied at the target slot
      // We need to check ALL timetable data, not just the current filtered view
      const occupiedRooms = new Map<string, { studentGroup: string; subject: string }>()

      // Check all groups' timetables for this time slot
      // Since we have one master timetable, we just check the one slot
      // In a full implementation, we'd check all student groups' data
      const lessonAtSlot = timetableData[targetDay]?.[targetPeriod]
      if (lessonAtSlot) {
        occupiedRooms.set(lessonAtSlot.room, {
          studentGroup: lessonAtSlot.studentGroup,
          subject: lessonAtSlot.subject,
        })
      }

      return ROOMS.map((room) => {
        const occupyingLesson = occupiedRooms.get(room.name)
        const isOccupied = !!occupyingLesson

        // Check if room type matches subject requirement
        const isSuitable = !requiredRoomType || room.type === requiredRoomType

        return {
          id: room.id,
          name: room.name,
          type: room.type,
          isAvailable: !isOccupied,
          isSuitable,
          currentLesson: occupyingLesson
            ? `${occupyingLesson.studentGroup} - ${occupyingLesson.subject}`
            : undefined,
        }
      })
    },
    [timetableData]
  )

  // Handle request to move a lesson (show confirmation dialog)
  const handleRequestMove = useCallback((move: PendingMove) => {
    setPendingMove(move)
  }, [])

  // Handle confirming the move - show room selection dialog
  const handleConfirmMove = useCallback(() => {
    if (!pendingMove) return

    // Compute available rooms for the target slot
    const rooms = computeAvailableRooms(
      pendingMove.toDay,
      pendingMove.toPeriod,
      pendingMove.lesson.subjectId
    )

    // Get the required room type for this subject
    const requiredRoomType = SUBJECT_ROOM_REQUIREMENTS[pendingMove.lesson.subjectId] || null

    // Set up room selection details
    setRoomSelectionDetails({
      lessonId: pendingMove.lesson.lessonId,
      subject: pendingMove.lesson.subject,
      subjectId: pendingMove.lesson.subjectId,
      studentGroup: pendingMove.lesson.studentGroup,
      teacher: pendingMove.lesson.teacher,
      fromDay: pendingMove.fromDay,
      fromPeriod: pendingMove.fromPeriod,
      toDay: pendingMove.toDay,
      toPeriod: pendingMove.toPeriod,
      currentRoom: pendingMove.lesson.room,
      requiredRoomType,
    })
    setAvailableRooms(rooms)
    setShowRoomSelection(true)
    setPendingMove(null) // Close the confirm dialog
  }, [pendingMove, computeAvailableRooms])

  // Handle room selection and execute the move
  const handleRoomConfirm = useCallback(
    async (selectedRoom: string) => {
      if (!roomSelectionDetails) return

      setIsMoving(true)
      setGlobalError(null)

      try {
        // Convert current timetable state to API format
        const apiAssignments = toApiAssignments(timetableData)

        const response = await moveLesson({
          lesson_id: roomSelectionDetails.lessonId,
          source_day: roomSelectionDetails.fromDay,
          source_period: roomSelectionDetails.fromPeriod,
          target_day: roomSelectionDetails.toDay,
          target_period: roomSelectionDetails.toPeriod,
          current_assignments: apiAssignments,
        })

        if (response.success) {
          // Update the local timetable state with the new room
          setTimetableData((prev) => {
            const newData = cloneTimetable(prev)
            const lesson = newData[roomSelectionDetails.fromDay]?.[roomSelectionDetails.fromPeriod]
            if (lesson) {
              // Move the lesson with updated room
              newData[roomSelectionDetails.toDay][roomSelectionDetails.toPeriod] = {
                ...lesson,
                room: selectedRoom,
              }
              newData[roomSelectionDetails.fromDay][roomSelectionDetails.fromPeriod] = null
            }
            return newData
          })

          const roomChanged = selectedRoom !== roomSelectionDetails.currentRoom
          const message = roomChanged
            ? `Lesson moved to ${selectedRoom}`
            : 'Lesson moved successfully'
          setToast({ type: 'success', message })
        } else {
          console.error('Move failed:', response.message)
          setToast({ type: 'error', message: `Move failed: ${response.message}` })
        }
      } catch (error) {
        console.error('Error moving lesson:', error)
        const apiError = parseApiError(error)

        if (apiError.type === 'network') {
          setIsConnected(false)
        } else {
          setGlobalError(apiError)
        }
      } finally {
        setIsMoving(false)
        setShowRoomSelection(false)
        setRoomSelectionDetails(null)
      }
    },
    [roomSelectionDetails, timetableData]
  )

  // Handle canceling room selection
  const handleRoomCancel = useCallback(() => {
    setShowRoomSelection(false)
    setRoomSelectionDetails(null)
  }, [])

  // Handle canceling the move
  const handleCancelMove = useCallback(() => {
    setPendingMove(null)
  }, [])

  // Handle checking if a move is valid via backend API
  const handleCheckMove = useCallback(
    async (
      lessonId: string,
      sourceDay: number,
      sourcePeriod: number
    ): Promise<SlotValidation[]> => {
      setIsCheckingMove(true)
      setGlobalError(null)

      try {
        // Convert current timetable state to API format
        const apiAssignments = toApiAssignments(timetableData)

        const response = await checkMove({
          lesson_id: lessonId,
          source_day: sourceDay,
          source_period: sourcePeriod,
          current_assignments: apiAssignments,
          // Include teacher availability for validation
          teacher_availability: TEACHER_AVAILABILITY,
        })

        return response.slots
      } catch (error) {
        console.error('Error checking move:', error)
        const apiError = parseApiError(error)

        // Check if it's a connection error
        if (apiError.type === 'network') {
          setIsConnected(false)
        } else {
          setToast({ type: 'error', message: 'Failed to validate move. Please try again.' })
        }

        // Return empty array on error (will show all slots as neutral)
        return []
      } finally {
        setIsCheckingMove(false)
      }
    },
    [timetableData]
  )

  // Memoized data transformations
  const assignments = useMemo(() => timetableToAssignments(timetableData), [timetableData])
  const lessonsMap = useMemo(() => buildLessonsMap(timetableData), [timetableData])

  const teachersMap = useMemo(
    () => new Map(TEACHERS.map((t) => [t.id, { name: t.name, code: t.code }])),
    []
  )
  const roomsMap = useMemo(
    () => new Map(ROOMS.map((r) => [r.name.toLowerCase().replace(/\s+/g, ''), { name: r.name }])),
    []
  )
  const subjectsMap = useMemo(
    () =>
      new Map([
        ['eng', { name: 'English' }],
        ['mat', { name: 'Maths' }],
        ['sci', { name: 'Science' }],
        ['his', { name: 'History' }],
        ['geo', { name: 'Geography' }],
        ['fre', { name: 'French' }],
        ['pe', { name: 'PE' }],
        ['cmp', { name: 'Computing' }],
      ]),
    []
  )
  const studentGroupsMap = useMemo(
    () => new Map(STUDENT_GROUPS.map((g) => [g.id, { name: g.name }])),
    []
  )

  // Get filtered timetable based on current view
  const filteredTimetable = useMemo(() => {
    if (currentView.type === 'teacher' && currentView.id) {
      const teacher = TEACHERS.find((t) => t.id === currentView.id)
      if (teacher) {
        return filterByTeacher(timetableData, teacher.code)
      }
    }
    if (currentView.type === 'room' && currentView.id) {
      const room = ROOMS.find((r) => r.id === currentView.id)
      if (room) {
        return filterByRoom(timetableData, room.name)
      }
    }
    if (currentView.type === 'group' && currentView.id) {
      const group = STUDENT_GROUPS.find((g) => g.id === currentView.id)
      if (group) {
        return filterByGroup(timetableData, group.name)
      }
    }
    return timetableData
  }, [currentView, timetableData])

  // Handle clicking on teacher/room/group in MasterView
  const handleSelectFromMaster = (type: 'teacher' | 'room' | 'group', id: string) => {
    if (type === 'teacher') {
      const teacher = TEACHERS.find((t) => t.id === id || t.code.toLowerCase() === id)
      if (teacher) {
        setCurrentView({ type: 'teacher', id: teacher.id, label: teacher.name })
      }
    } else if (type === 'room') {
      const room = ROOMS.find((r) => r.id === id || r.name.toLowerCase().replace(/\s+/g, '') === id)
      if (room) {
        setCurrentView({ type: 'room', id: room.id, label: room.name })
      }
    } else if (type === 'group') {
      const group = STUDENT_GROUPS.find((g) => g.id === id)
      if (group) {
        setCurrentView({ type: 'group', id: group.id, label: group.name })
      }
    }
  }

  // Show loading while checking initial connection
  if (isConnected === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Connecting to server..." />
      </div>
    )
  }

  // Show connection error if backend is down
  if (isConnected === false) {
    return <ConnectionError onRetry={handleRetryConnection} />
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex">
        <Sidebar
          teachers={TEACHERS}
          rooms={ROOMS}
          studentGroups={STUDENT_GROUPS}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white shadow-lg">
            <div className="px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* School Branding */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <SchoolIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight">The School</h1>
                    <div className="flex items-center gap-2 text-indigo-200 text-xs sm:text-sm">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Timetable Management System</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                  {isCheckingMove && (
                    <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                      <LoadingSpinner size="sm" />
                      <span className="text-indigo-100">Validating...</span>
                    </div>
                  )}
                  <div className="hidden sm:flex items-center gap-2 text-xs text-indigo-200">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span>Connected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Current View Breadcrumb */}
            {currentView.type !== 'master' && (
              <div className="px-4 sm:px-6 pb-3">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setCurrentView({ type: 'master', label: 'Master View' })}
                    className="text-indigo-200 hover:text-white transition-colors"
                  >
                    Master View
                  </button>
                  <span className="text-indigo-300">/</span>
                  <span className="text-white font-medium">{currentView.label}</span>
                </div>
              </div>
            )}
          </header>

          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            {/* Global Error Display */}
            {globalError && (
              <div className="mb-6">
                <ErrorMessage
                  error={globalError}
                  onRetry={() => setGlobalError(null)}
                  onDismiss={() => setGlobalError(null)}
                />
              </div>
            )}

            {currentView.type === 'master' ? (
              <MasterView
                assignments={assignments}
                lessons={lessonsMap}
                teachers={teachersMap}
                rooms={roomsMap}
                subjects={subjectsMap}
                studentGroups={studentGroupsMap}
                onSelectView={handleSelectFromMaster}
              />
            ) : (
              <TimetableGrid
                data={filteredTimetable}
                title={`${currentView.label} - Weekly Timetable`}
                viewType={currentView.type === 'group' ? 'group' : currentView.type}
                onRequestMove={handleRequestMove}
                onCheckMove={handleCheckMove}
              />
            )}
          </main>
        </div>

        {/* Move Confirmation Dialog */}
        {pendingMove && (
          <ConfirmMoveDialog
            move={{
              lessonId: pendingMove.lesson.lessonId,
              subject: pendingMove.lesson.subject,
              studentGroup: pendingMove.lesson.studentGroup,
              fromDay: pendingMove.fromDay,
              fromPeriod: pendingMove.fromPeriod,
              toDay: pendingMove.toDay,
              toPeriod: pendingMove.toPeriod,
            }}
            isLoading={false}
            onConfirm={handleConfirmMove}
            onCancel={handleCancelMove}
          />
        )}

        {/* Room Selection Dialog */}
        {showRoomSelection && roomSelectionDetails && (
          <RoomSelectionDialog
            details={roomSelectionDetails}
            rooms={availableRooms}
            isLoading={isMoving}
            onConfirm={handleRoomConfirm}
            onCancel={handleRoomCancel}
          />
        )}

        {/* Toast Notifications */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
