const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export interface MoveDetails {
  lessonId: string
  subject: string
  studentGroup: string
  fromDay: number
  fromPeriod: number
  toDay: number
  toPeriod: number
}

interface ConfirmMoveDialogProps {
  move: MoveDetails
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmMoveDialog({
  move,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmMoveDialogProps) {
  const fromSlot = `${DAYS[move.fromDay]} P${move.fromPeriod}`
  const toSlot = `${DAYS[move.toDay]} P${move.toPeriod}`

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirm Move</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Move{' '}
          <span className="font-semibold text-gray-900">
            {move.studentGroup} {move.subject}
          </span>{' '}
          from{' '}
          <span className="font-semibold text-gray-900">{fromSlot}</span>{' '}
          to{' '}
          <span className="font-semibold text-gray-900">{toSlot}</span>?
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Moving...
              </>
            ) : (
              'Confirm Move'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
