import { Component, type ReactNode } from 'react'

// =============================================================================
// Error Types
// =============================================================================

export interface ApiError {
  type: 'network' | 'server' | 'validation' | 'solver' | 'unknown'
  message: string
  details?: string
  suggestions?: string[]
  retryable?: boolean
}

export function parseApiError(error: unknown): ApiError {
  // Network error (backend down, no internet, etc.)
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      type: 'network',
      message: 'Unable to connect to the server',
      details: 'The backend server may be down or unreachable.',
      suggestions: [
        'Check if the backend server is running on port 8000',
        'Verify your network connection',
        'Try refreshing the page',
      ],
      retryable: true,
    }
  }

  // HTTP error from API
  if (error instanceof Error && error.message.startsWith('API error:')) {
    const statusMatch = error.message.match(/API error: (\d+)/)
    const status = statusMatch ? parseInt(statusMatch[1]) : 0

    if (status === 500) {
      return {
        type: 'server',
        message: 'Server error occurred',
        details: 'The server encountered an unexpected error.',
        suggestions: [
          'Try the operation again',
          'If the problem persists, check the server logs',
        ],
        retryable: true,
      }
    }

    if (status === 422) {
      return {
        type: 'validation',
        message: 'Invalid request data',
        details: 'The data sent to the server was not valid.',
        suggestions: ['Check your input and try again'],
        retryable: false,
      }
    }

    if (status === 404) {
      return {
        type: 'server',
        message: 'Resource not found',
        details: 'The requested endpoint or resource does not exist.',
        suggestions: ['Refresh the page and try again'],
        retryable: false,
      }
    }
  }

  // Generic error
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  return {
    type: 'unknown',
    message,
    suggestions: ['Try refreshing the page', 'If the problem persists, contact support'],
    retryable: true,
  }
}

export function parseSolverError(message: string): ApiError {
  // Check for common solver failure patterns
  if (message.toLowerCase().includes('infeasible') || message.toLowerCase().includes('no solution')) {
    return {
      type: 'solver',
      message: 'No valid timetable could be generated',
      details: 'The constraints are too restrictive to find a solution.',
      suggestions: [
        'Try reducing the number of lessons per teacher',
        'Add more rooms or time slots',
        'Check for conflicting constraints',
        'Remove some hard constraints temporarily',
      ],
      retryable: false,
    }
  }

  if (message.toLowerCase().includes('timeout')) {
    return {
      type: 'solver',
      message: 'Solver took too long to find a solution',
      details: 'The problem is too complex to solve within the time limit.',
      suggestions: [
        'Try with fewer classes or subjects',
        'Simplify the constraints',
        'Break the problem into smaller parts',
      ],
      retryable: true,
    }
  }

  return {
    type: 'solver',
    message: 'Solver encountered an error',
    details: message,
    suggestions: ['Check your constraint configuration', 'Try with simpler input data'],
    retryable: true,
  }
}

// =============================================================================
// Loading Spinner Component
// =============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', message, fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-[400px]' : ''}`}>
      <svg
        className={`animate-spin text-blue-600 ${sizeClasses[size]}`}
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
      {message && <p className="text-gray-600 text-sm">{message}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

// =============================================================================
// Error Message Component
// =============================================================================

interface ErrorMessageProps {
  error: ApiError
  onRetry?: () => void
  onDismiss?: () => void
}

export function ErrorMessage({ error, onRetry, onDismiss }: ErrorMessageProps) {
  const iconByType = {
    network: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
    ),
    server: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    solver: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    validation: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    unknown: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const colorByType = {
    network: 'bg-orange-50 border-orange-200 text-orange-800',
    server: 'bg-red-50 border-red-200 text-red-800',
    solver: 'bg-purple-50 border-purple-200 text-purple-800',
    validation: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    unknown: 'bg-gray-50 border-gray-200 text-gray-800',
  }

  const iconColorByType = {
    network: 'text-orange-500',
    server: 'text-red-500',
    solver: 'text-purple-500',
    validation: 'text-yellow-500',
    unknown: 'text-gray-500',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorByType[error.type]}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${iconColorByType[error.type]}`}>
          {iconByType[error.type]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{error.message}</h3>
          {error.details && (
            <p className="mt-1 text-sm opacity-80">{error.details}</p>
          )}
          {error.suggestions && error.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">Suggestions:</p>
              <ul className="mt-1 text-sm list-disc list-inside space-y-1 opacity-80">
                {error.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            {error.retryable && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-white border border-current rounded text-sm font-medium hover:bg-opacity-50 transition-colors"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-sm opacity-70 hover:opacity-100 transition-opacity"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Connection Error Component (for backend down)
// =============================================================================

interface ConnectionErrorProps {
  onRetry: () => void
}

export function ConnectionError({ onRetry }: ConnectionErrorProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Connect</h1>
        <p className="text-gray-600 mb-6">
          We couldn't connect to the timetabling server. This usually means the backend is not running.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">To start the backend server:</p>
          <code className="block bg-gray-800 text-green-400 p-3 rounded text-sm font-mono">
            cd backend && ./start.sh
          </code>
        </div>

        <button
          onClick={onRetry}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Error Boundary Component
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 text-center mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 text-center mb-4">
              The application encountered an unexpected error.
            </p>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-sm font-mono text-red-800 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// =============================================================================
// Toast Notification Component
// =============================================================================

interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  onClose: () => void
}

export function Toast({ type, message, onClose }: ToastProps) {
  const styles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600',
  }

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  return (
    <div className={`fixed bottom-4 right-4 ${styles[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up max-w-md`}>
      <span className="flex-shrink-0">{icons[type]}</span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="flex-shrink-0 hover:opacity-70 transition-opacity">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
