import type { ReactNode } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export interface ConflictInfo {
  type: string
  message: string
}

export interface ConflictDetails {
  lessonSubject: string
  lessonGroup: string
  targetDay: number
  targetPeriod: number
  conflicts: ConflictInfo[]
}

interface ConflictDialogProps {
  details: ConflictDetails
  onClose: () => void
  onFindAlternative?: () => void
}

// Map conflict types to friendly icons and colors
const CONFLICT_STYLES: Record<string, { icon: ReactNode; bgColor: string; borderColor: string }> = {
  occupied: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  teacher: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  room: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  student_group: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  same_slot: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  teacher_unavailable: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  room_type: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
}

const DEFAULT_STYLE = {
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  bgColor: 'bg-red-50',
  borderColor: 'border-red-200',
}

// Convert conflict type to friendly label
function getConflictLabel(type: string): string {
  const labels: Record<string, string> = {
    occupied: 'Slot Occupied',
    teacher: 'Teacher Conflict',
    room: 'Room Conflict',
    student_group: 'Class Conflict',
    same_slot: 'Same Slot',
    teacher_unavailable: 'Teacher Unavailable',
    room_type: 'Wrong Room Type',
  }
  return labels[type] || 'Conflict'
}

export default function ConflictDialog({
  details,
  onClose,
  onFindAlternative,
}: ConflictDialogProps) {
  const targetSlot = `${DAYS[details.targetDay]} Period ${details.targetPeriod}`

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Can't Move Here</h2>
              <p className="text-sm text-gray-600">
                {details.lessonGroup} {details.lessonSubject} → {targetSlot}
              </p>
            </div>
          </div>
        </div>

        {/* Conflict List */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">
            This slot isn't available because:
          </p>

          <div className="space-y-3">
            {details.conflicts.map((conflict, index) => {
              const style = CONFLICT_STYLES[conflict.type] || DEFAULT_STYLE
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${style.bgColor} ${style.borderColor}`}
                >
                  <div className="text-gray-600 mt-0.5">{style.icon}</div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {getConflictLabel(conflict.type)}
                    </div>
                    <p className="text-gray-800">{conflict.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-between items-center">
          <button
            onClick={onFindAlternative}
            disabled={!onFindAlternative}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Find Alternative
            {!onFindAlternative && (
              <span className="text-xs text-gray-400 ml-1">(Coming soon)</span>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}
