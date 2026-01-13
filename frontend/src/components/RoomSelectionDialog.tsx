import { useState } from 'react'
import { RoomIcon } from './Icons'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export interface RoomOption {
  id: string
  name: string
  type: string
  isAvailable: boolean
  isSuitable: boolean // Matches subject room type requirement
  currentLesson?: string // What's scheduled there if not available
}

export interface RoomSelectionDetails {
  lessonId: string
  subject: string
  subjectId: string
  studentGroup: string
  teacher: string
  fromDay: number
  fromPeriod: number
  toDay: number
  toPeriod: number
  currentRoom: string
  requiredRoomType: string | null
}

interface RoomSelectionDialogProps {
  details: RoomSelectionDetails
  rooms: RoomOption[]
  isLoading: boolean
  onConfirm: (roomName: string) => void
  onCancel: () => void
}

export default function RoomSelectionDialog({
  details,
  rooms,
  isLoading,
  onConfirm,
  onCancel,
}: RoomSelectionDialogProps) {
  const [selectedRoom, setSelectedRoom] = useState<string>(details.currentRoom)

  const targetSlot = `${DAYS[details.toDay]} Period ${details.toPeriod}`

  // Sort rooms: suitable & available first, then available, then unavailable
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.isSuitable && a.isAvailable && !(b.isSuitable && b.isAvailable)) return -1
    if (b.isSuitable && b.isAvailable && !(a.isSuitable && a.isAvailable)) return 1
    if (a.isAvailable && !b.isAvailable) return -1
    if (b.isAvailable && !a.isAvailable) return 1
    return a.name.localeCompare(b.name)
  })

  const selectedRoomData = rooms.find(r => r.name === selectedRoom)
  const canConfirm = selectedRoomData?.isAvailable && !isLoading

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <RoomIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Select Room</h2>
              <p className="text-indigo-200 text-sm">
                {details.studentGroup} {details.subject} → {targetSlot}
              </p>
            </div>
          </div>
        </div>

        {/* Room requirement info */}
        {details.requiredRoomType && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{details.subject}</strong> requires a <strong>{details.requiredRoomType.replace('_', ' ')}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Room list */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <div className="space-y-2">
            {sortedRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => room.isAvailable && setSelectedRoom(room.name)}
                disabled={!room.isAvailable}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  selectedRoom === room.name
                    ? 'border-indigo-500 bg-indigo-50'
                    : room.isAvailable
                    ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Selection indicator */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedRoom === room.name
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-slate-300'
                    }`}>
                      {selectedRoom === room.name && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    <div>
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {room.name}
                        {room.name === details.currentRoom && (
                          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">{room.type}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Suitability badge */}
                    {room.isSuitable && details.requiredRoomType && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Suitable
                      </span>
                    )}

                    {/* Availability status */}
                    {!room.isAvailable && (
                      <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        In Use
                      </span>
                    )}
                  </div>
                </div>

                {/* Show what's using the room if unavailable */}
                {!room.isAvailable && room.currentLesson && (
                  <div className="mt-2 ml-8 text-xs text-slate-500">
                    {room.currentLesson}
                  </div>
                )}

                {/* Warning if not suitable but available */}
                {room.isAvailable && !room.isSuitable && details.requiredRoomType && (
                  <div className="mt-2 ml-8 text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Not ideal for {details.subject}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(selectedRoom)}
            disabled={!canConfirm}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Moving...
              </>
            ) : (
              <>
                Confirm Move
                {selectedRoom !== details.currentRoom && (
                  <span className="text-indigo-200">→ {selectedRoom}</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
