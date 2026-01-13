export { default as TimetableGrid } from './TimetableGrid'
export type { TimetableData, LessonSlot, PendingMove } from './TimetableGrid'
export { createEmptyTimetable } from './TimetableGrid'

export { default as Sidebar } from './Sidebar'
export type { ViewType, ViewSelection, Teacher, Room, StudentGroup } from './Sidebar'

export { default as MasterView } from './MasterView'

export { default as ConfirmMoveDialog } from './ConfirmMoveDialog'
export type { MoveDetails } from './ConfirmMoveDialog'

export { default as ConflictDialog } from './ConflictDialog'
export type { ConflictDetails, ConflictInfo } from './ConflictDialog'

export { default as RoomSelectionDialog } from './RoomSelectionDialog'
export type { RoomOption, RoomSelectionDetails } from './RoomSelectionDialog'

export {
  ErrorBoundary,
  ErrorMessage,
  LoadingSpinner,
  ConnectionError,
  Toast,
  parseApiError,
  parseSolverError,
} from './ErrorHandling'
export type { ApiError } from './ErrorHandling'

export {
  TeacherIcon,
  RoomIcon,
  GroupIcon,
  ClockIcon,
  CalendarIcon,
  GridIcon,
  BookIcon,
  SchoolIcon,
  getSubjectIcon,
} from './Icons'
