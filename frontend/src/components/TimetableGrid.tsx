import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import type { SlotValidation, SlotConflict } from '../api/timetable'
import ConflictDialog from './ConflictDialog'
import type { ConflictDetails } from './ConflictDialog'
import { TeacherIcon, RoomIcon, GroupIcon, ClockIcon, getSubjectIcon } from './Icons'

export interface LessonSlot {
  lessonId: string
  subject: string
  subjectId: string
  teacher: string
  teacherCode: string
  room: string
  studentGroup: string
}

export interface TimetableData {
  [day: number]: {
    [period: number]: LessonSlot | null
  }
}

export interface PendingMove {
  lesson: LessonSlot
  fromDay: number
  fromPeriod: number
  toDay: number
  toPeriod: number
}

interface TimetableGridProps {
  data: TimetableData
  title?: string
  viewType?: 'teacher' | 'room' | 'group'
  onRequestMove?: (move: PendingMove) => void
  onCheckMove?: (
    lessonId: string,
    sourceDay: number,
    sourcePeriod: number
  ) => Promise<SlotValidation[]>
}

interface DragData {
  lesson: LessonSlot
  day: number
  period: number
}

interface DropValidation {
  isValid: boolean
  reason?: string
  conflicts?: SlotConflict[]
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const PERIODS = [1, 2, 3, 4, 5, 6]

// Enhanced color scheme with better visual hierarchy
const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  eng: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', accent: 'bg-blue-400' },
  mat: { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900', accent: 'bg-rose-400' },
  sci: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', accent: 'bg-emerald-400' },
  his: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', accent: 'bg-amber-400' },
  geo: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', accent: 'bg-orange-400' },
  fre: { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-900', accent: 'bg-violet-400' },
  pe: { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-900', accent: 'bg-pink-400' },
  cmp: { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-900', accent: 'bg-cyan-400' },
}

const DEFAULT_COLOR = { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-900', accent: 'bg-gray-400' }

function getSubjectColors(subjectId: string) {
  return SUBJECT_COLORS[subjectId.toLowerCase()] || DEFAULT_COLOR
}

// Draggable Lesson Card Component
interface DraggableLessonCardProps {
  lesson: LessonSlot
  day: number
  period: number
  onClick: () => void
}

function DraggableLessonCard({ lesson, day, period, onClick }: DraggableLessonCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${day}-${period}`,
    data: { lesson, day, period } as DragData,
  })

  const colors = getSubjectColors(lesson.subjectId)

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group w-full h-full rounded-lg border-l-4 text-left transition-all duration-200 ${colors.bg} ${colors.border} ${colors.text} ${
        isDragging
          ? 'opacity-50 cursor-grabbing shadow-lg scale-105'
          : 'cursor-grab hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
      }`}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Subject with icon */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="opacity-70">{getSubjectIcon(lesson.subjectId)}</span>
          <span className="font-semibold text-sm truncate">{lesson.subject}</span>
        </div>

        {/* Teacher and Room */}
        <div className="flex items-center justify-between text-xs opacity-75 mt-auto">
          <span className="flex items-center gap-1">
            <TeacherIcon className="w-3 h-3" />
            <span className="hidden sm:inline">{lesson.teacherCode}</span>
            <span className="sm:hidden">{lesson.teacherCode}</span>
          </span>
          <span className="flex items-center gap-1">
            <RoomIcon className="w-3 h-3" />
            <span className="hidden lg:inline">{lesson.room}</span>
            <span className="lg:hidden">{lesson.room.replace('Room ', 'R')}</span>
          </span>
        </div>

        {/* Student group - hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1 text-xs opacity-60 mt-1">
          <GroupIcon className="w-3 h-3" />
          <span className="truncate">{lesson.studentGroup}</span>
        </div>
      </div>
    </button>
  )
}

// Static Lesson Card (for overlay during drag)
function LessonCardOverlay({ lesson }: { lesson: LessonSlot }) {
  const colors = getSubjectColors(lesson.subjectId)

  return (
    <div
      className={`w-36 rounded-lg border-l-4 shadow-2xl ${colors.bg} ${colors.border} ${colors.text} cursor-grabbing ring-2 ring-indigo-500/30`}
    >
      <div className="p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="opacity-70">{getSubjectIcon(lesson.subjectId)}</span>
          <span className="font-semibold text-sm truncate">{lesson.subject}</span>
        </div>
        <div className="flex items-center justify-between text-xs opacity-75">
          <span className="flex items-center gap-1">
            <TeacherIcon className="w-3 h-3" />
            {lesson.teacherCode}
          </span>
          <span className="flex items-center gap-1">
            <RoomIcon className="w-3 h-3" />
            {lesson.room.replace('Room ', 'R')}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs opacity-60 mt-1">
          <GroupIcon className="w-3 h-3" />
          <span className="truncate">{lesson.studentGroup}</span>
        </div>
      </div>
    </div>
  )
}

// Droppable Cell Component
interface DroppableCellProps {
  day: number
  period: number
  lesson: LessonSlot | null
  validation: DropValidation | null
  isOver: boolean
  isDragging: boolean
  isLoading: boolean
  onLessonClick: (lesson: LessonSlot, day: number, period: number) => void
}

function DroppableCell({
  day,
  period,
  lesson,
  validation,
  isOver,
  isDragging,
  isLoading,
  onLessonClick,
}: DroppableCellProps) {
  const { setNodeRef } = useDroppable({
    id: `cell-${day}-${period}`,
    data: { day, period },
  })

  // Determine cell styling based on drag state
  let cellBgClass = 'bg-white'
  let cellRingClass = ''

  if (isDragging) {
    if (isLoading) {
      cellBgClass = 'bg-slate-100 animate-pulse'
    } else if (validation) {
      if (validation.isValid) {
        cellBgClass = isOver ? 'bg-emerald-100' : 'bg-emerald-50/50'
        cellRingClass = isOver ? 'ring-2 ring-emerald-500 ring-inset' : ''
      } else {
        cellBgClass = isOver ? 'bg-rose-100' : 'bg-rose-50/30'
        cellRingClass = isOver ? 'ring-2 ring-rose-500 ring-inset' : ''
      }
    }
  }

  return (
    <td
      ref={setNodeRef}
      className={`p-1 border-b border-slate-200 h-20 sm:h-24 align-top transition-all duration-200 ${cellBgClass} ${cellRingClass}`}
    >
      {lesson ? (
        <DraggableLessonCard
          lesson={lesson}
          day={day}
          period={period}
          onClick={() => onLessonClick(lesson, day, period)}
        />
      ) : (
        <div
          className={`w-full h-full rounded-lg border-2 border-dashed transition-all duration-200 ${
            isDragging && !isLoading && validation?.isValid
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        />
      )}
    </td>
  )
}

// Lesson Detail Modal
interface LessonModalProps {
  lesson: LessonSlot
  day: number
  period: number
  onClose: () => void
}

function LessonModal({ lesson, day, period, onClose }: LessonModalProps) {
  const colors = getSubjectColors(lesson.subjectId)

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with subject color */}
        <div className={`${colors.bg} ${colors.text} px-6 py-4 border-b-4 ${colors.border}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${colors.accent} flex items-center justify-center text-white`}>
                {getSubjectIcon(lesson.subjectId)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{lesson.subject}</h2>
                <p className="text-sm opacity-75">{lesson.studentGroup}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-current opacity-50 hover:opacity-100 transition-opacity p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Schedule</p>
              <p className="font-semibold text-slate-900">{DAYS[day]}, Period {period}</p>
              <p className="text-sm text-slate-500">{getPeriodTime(period)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <TeacherIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Teacher</p>
              <p className="font-semibold text-slate-900">{lesson.teacher}</p>
              <p className="text-sm text-slate-500">{lesson.teacherCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <RoomIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Room</p>
              <p className="font-semibold text-slate-900">{lesson.room}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-400 font-mono">{lesson.lessonId}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Error Toast Component
interface ErrorToastProps {
  message: string
  onClose: () => void
}

function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up max-w-md">
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:text-red-200">
        &times;
      </button>
    </div>
  )
}

export default function TimetableGrid({
  data,
  title = 'Timetable',
  onRequestMove,
  onCheckMove,
}: TimetableGridProps) {
  const [selectedLesson, setSelectedLesson] = useState<{
    lesson: LessonSlot
    day: number
    period: number
  } | null>(null)

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [overCell, setOverCell] = useState<{ day: number; period: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingValidation, setIsLoadingValidation] = useState(false)

  // Store API validation response
  const [apiValidations, setApiValidations] = useState<Record<string, DropValidation> | null>(null)

  // Store conflict details for dialog
  const [conflictDetails, setConflictDetails] = useState<ConflictDetails | null>(null)

  // Configure pointer sensor with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  )

  // Get validation for a specific cell
  const getValidation = useCallback(
    (day: number, period: number): DropValidation | null => {
      if (!activeDrag) return null

      // If we have API validations, use them
      if (apiValidations) {
        const key = `${day}-${period}`
        return apiValidations[key] || null
      }

      // Fallback: no validation available yet
      return null
    },
    [activeDrag, apiValidations]
  )

  const handleDragStart = async (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData
    setActiveDrag(dragData)
    setErrorMessage(null)
    setApiValidations(null)

    // Call API to check valid moves if callback provided
    if (onCheckMove) {
      setIsLoadingValidation(true)
      try {
        const slots = await onCheckMove(
          dragData.lesson.lessonId,
          dragData.day,
          dragData.period
        )

        // Convert API response to validation map (store all conflicts)
        const validations: Record<string, DropValidation> = {}
        for (const slot of slots) {
          const key = `${slot.day}-${slot.period}`
          validations[key] = {
            isValid: slot.valid,
            reason: slot.conflicts.length > 0 ? slot.conflicts[0].message : undefined,
            conflicts: slot.conflicts,
          }
        }
        setApiValidations(validations)
      } catch (error) {
        console.error('Failed to check move validity:', error)
        // On error, we'll fall back to no validation (all cells neutral)
      } finally {
        setIsLoadingValidation(false)
      }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      const overData = event.over.data.current as { day: number; period: number } | undefined
      if (overData) {
        setOverCell({ day: overData.day, period: overData.period })
      }
    } else {
      setOverCell(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event

    if (over && activeDrag && apiValidations) {
      const overData = over.data.current as { day: number; period: number } | undefined
      if (overData) {
        const key = `${overData.day}-${overData.period}`
        const validation = apiValidations[key]

        if (validation?.isValid) {
          // Call the onRequestMove callback to show confirmation dialog
          if (onRequestMove) {
            onRequestMove({
              lesson: activeDrag.lesson,
              fromDay: activeDrag.day,
              fromPeriod: activeDrag.period,
              toDay: overData.day,
              toPeriod: overData.period,
            })
          }
        } else if (validation && validation.conflicts && validation.conflicts.length > 0) {
          // Show conflict dialog with all details
          setConflictDetails({
            lessonSubject: activeDrag.lesson.subject,
            lessonGroup: activeDrag.lesson.studentGroup,
            targetDay: overData.day,
            targetPeriod: overData.period,
            conflicts: validation.conflicts.map((c) => ({
              type: c.conflict_type,
              message: c.message,
            })),
          })
        } else if (validation) {
          // Fallback to error message if no detailed conflicts
          setErrorMessage(validation.reason || 'Cannot move lesson here')
          setTimeout(() => setErrorMessage(null), 4000)
        }
      }
    }

    setActiveDrag(null)
    setOverCell(null)
    setApiValidations(null)
    setIsLoadingValidation(false)
  }

  const handleDragCancel = () => {
    setActiveDrag(null)
    setOverCell(null)
    setApiValidations(null)
    setIsLoadingValidation(false)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        {/* Grid Header */}
        {title && (
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {onRequestMove && (
              <span className="text-xs text-slate-300 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Drag lessons to reschedule
              </span>
            )}
          </div>
        )}

        {/* Responsive Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="w-16 sm:w-20 p-2 border-b border-r border-slate-200 text-slate-500 font-medium text-xs sm:text-sm">
                  <ClockIcon className="w-4 h-4 mx-auto text-slate-400" />
                </th>
                {DAYS.map((day, i) => (
                  <th
                    key={day}
                    className="p-2 border-b border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{DAYS_SHORT[i]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period} className="group">
                  <td className="p-1 sm:p-2 border-r border-b border-slate-200 text-center bg-slate-50 group-hover:bg-slate-100 transition-colors">
                    <div className="font-semibold text-slate-700 text-sm">P{period}</div>
                    <div className="text-xs text-slate-400 hidden sm:block">{getPeriodTime(period)}</div>
                  </td>
                  {DAYS.map((_, dayIndex) => {
                    const lesson = data[dayIndex]?.[period] || null
                    const validation = getValidation(dayIndex, period)
                    const isOver = overCell?.day === dayIndex && overCell?.period === period

                    return (
                      <DroppableCell
                        key={dayIndex}
                        day={dayIndex}
                        period={period}
                        lesson={lesson}
                        validation={validation}
                        isOver={isOver}
                        isDragging={!!activeDrag}
                        isLoading={isLoadingValidation}
                        onLessonClick={(l, d, p) => setSelectedLesson({ lesson: l, day: d, period: p })}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subject Legend */}
        <div className="px-3 sm:px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Subjects:</span>
            {Object.entries(SUBJECT_COLORS).map(([id, colors]) => (
              <span
                key={id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${colors.bg} ${colors.text} border ${colors.border}`}
              >
                {getSubjectIcon(id)}
                <span className="uppercase font-medium">{id}</span>
              </span>
            ))}
          </div>
        </div>

        {selectedLesson && (
          <LessonModal
            lesson={selectedLesson.lesson}
            day={selectedLesson.day}
            period={selectedLesson.period}
            onClose={() => setSelectedLesson(null)}
          />
        )}
      </div>

      {/* Drag Overlay - renders the dragged item */}
      <DragOverlay>
        {activeDrag ? <LessonCardOverlay lesson={activeDrag.lesson} /> : null}
      </DragOverlay>

      {/* Error Toast (fallback) */}
      {errorMessage && (
        <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      {/* Conflict Dialog */}
      {conflictDetails && (
        <ConflictDialog
          details={conflictDetails}
          onClose={() => setConflictDetails(null)}
        />
      )}
    </DndContext>
  )
}

function getPeriodTime(period: number): string {
  const times: Record<number, string> = {
    1: '9:00',
    2: '10:00',
    3: '11:00',
    4: '12:30',
    5: '13:30',
    6: '14:30',
  }
  return times[period] || ''
}

export function createEmptyTimetable(): TimetableData {
  const data: TimetableData = {}
  for (let day = 0; day < 5; day++) {
    data[day] = {}
    for (let period = 1; period <= 6; period++) {
      data[day][period] = null
    }
  }
  return data
}
