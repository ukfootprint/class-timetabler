
interface Assignment {
  lessonId: string
  day: number
  period: number
  roomId: string
}

interface MasterViewProps {
  assignments: Assignment[]
  lessons: Map<string, { subjectId: string; teacherId: string; studentGroupId: string }>
  teachers: Map<string, { name: string; code: string }>
  rooms: Map<string, { name: string }>
  subjects: Map<string, { name: string }>
  studentGroups: Map<string, { name: string }>
  onSelectView: (type: 'teacher' | 'room' | 'group', id: string) => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const PERIODS = [1, 2, 3, 4, 5, 6]

const SUBJECT_COLORS: Record<string, string> = {
  eng: 'bg-blue-200',
  mat: 'bg-red-200',
  sci: 'bg-green-200',
  his: 'bg-yellow-200',
  geo: 'bg-orange-200',
  fre: 'bg-purple-200',
  pe: 'bg-pink-200',
  cmp: 'bg-cyan-200',
}

export default function MasterView({
  assignments,
  lessons,
  teachers,
  rooms,
  subjects,
  studentGroups,
  onSelectView,
}: MasterViewProps) {
  // Build lookup by slot -> list of assignments
  const slotAssignments = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const key = `${a.day}-${a.period}`
    if (!slotAssignments.has(key)) {
      slotAssignments.set(key, [])
    }
    slotAssignments.get(key)!.push(a)
  }

  // Calculate stats
  const teacherLoad = new Map<string, number>()
  const roomLoad = new Map<string, number>()

  for (const a of assignments) {
    const lesson = lessons.get(a.lessonId)
    if (lesson) {
      teacherLoad.set(lesson.teacherId, (teacherLoad.get(lesson.teacherId) || 0) + 1)
    }
    roomLoad.set(a.roomId, (roomLoad.get(a.roomId) || 0) + 1)
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Lessons"
          value={assignments.length}
          subtitle="periods scheduled"
          color="blue"
        />
        <StatCard
          title="Teachers"
          value={teachers.size}
          subtitle="active"
          color="green"
        />
        <StatCard
          title="Rooms"
          value={rooms.size}
          subtitle="in use"
          color="purple"
        />
        <StatCard
          title="Classes"
          value={studentGroups.size}
          subtitle="scheduled"
          color="orange"
        />
      </div>

      {/* Heatmap Overview */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h2 className="text-lg font-semibold">Weekly Overview</h2>
          <p className="text-sm text-gray-300">Lessons per time slot</p>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2 text-sm text-gray-500">Period</th>
                  {DAYS.map((day) => (
                    <th key={day} className="p-2 text-sm font-semibold text-gray-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="p-2 text-center text-sm font-medium text-gray-600">
                      P{period}
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const key = `${dayIndex}-${period}`
                      const count = slotAssignments.get(key)?.length || 0
                      const intensity = Math.min(count / rooms.size, 1)
                      return (
                        <td key={dayIndex} className="p-1">
                          <div
                            className="h-12 rounded flex items-center justify-center text-sm font-medium"
                            style={{
                              backgroundColor: `rgba(59, 130, 246, ${intensity * 0.8})`,
                              color: intensity > 0.5 ? 'white' : 'rgb(59, 130, 246)',
                            }}
                          >
                            {count > 0 && count}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Teacher Workload */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Teacher Workload</h2>
            <p className="text-sm text-gray-300">Click to view individual timetable</p>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from(teachers.entries())
              .sort((a, b) => (teacherLoad.get(b[0]) || 0) - (teacherLoad.get(a[0]) || 0))
              .map(([id, teacher]) => {
                const load = teacherLoad.get(id) || 0
                const loadPercent = (load / 30) * 100
                return (
                  <button
                    key={id}
                    onClick={() => onSelectView('teacher', id)}
                    className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="font-semibold text-gray-800">{teacher.code}</div>
                    <div className="text-xs text-gray-500 truncate">{teacher.name}</div>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          loadPercent > 90
                            ? 'bg-red-500'
                            : loadPercent > 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(loadPercent, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{load}/30 periods</div>
                  </button>
                )
              })}
          </div>
        </div>
      </div>

      {/* Room Utilization */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h2 className="text-lg font-semibold">Room Utilization</h2>
          <p className="text-sm text-gray-300">Click to view room schedule</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from(rooms.entries())
              .sort((a, b) => (roomLoad.get(b[0]) || 0) - (roomLoad.get(a[0]) || 0))
              .map(([id, room]) => {
                const load = roomLoad.get(id) || 0
                const loadPercent = (load / 30) * 100
                return (
                  <button
                    key={id}
                    onClick={() => onSelectView('room', id)}
                    className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="font-semibold text-gray-800 text-sm truncate">
                      {room.name}
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          loadPercent > 90
                            ? 'bg-red-500'
                            : loadPercent > 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(loadPercent, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {load}/30 ({Math.round(loadPercent)}%)
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      </div>

      {/* Subject Distribution */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h2 className="text-lg font-semibold">Subject Distribution</h2>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {Array.from(subjects.entries()).map(([id, subject]) => {
              const count = assignments.filter((a) => {
                const lesson = lessons.get(a.lessonId)
                return lesson?.subjectId === id
              }).length
              return (
                <div
                  key={id}
                  className={`px-4 py-2 rounded-lg ${SUBJECT_COLORS[id] || 'bg-gray-200'}`}
                >
                  <div className="font-semibold">{subject.name}</div>
                  <div className="text-sm opacity-75">{count} periods</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-75">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-60">{subtitle}</div>
    </div>
  )
}
