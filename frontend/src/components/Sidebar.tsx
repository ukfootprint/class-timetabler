import { useState } from 'react'
import { TeacherIcon, RoomIcon, GroupIcon, GridIcon } from './Icons'

export type ViewType = 'master' | 'teacher' | 'room' | 'group'

export interface Teacher {
  id: string
  name: string
  code: string
}

export interface Room {
  id: string
  name: string
  type: string
}

export interface StudentGroup {
  id: string
  name: string
  yearGroup: number
}

export interface ViewSelection {
  type: ViewType
  id?: string
  label: string
}

interface SidebarProps {
  teachers: Teacher[]
  rooms: Room[]
  studentGroups: StudentGroup[]
  currentView: ViewSelection
  onViewChange: (view: ViewSelection) => void
}

type ExpandedSection = 'teachers' | 'rooms' | 'groups' | null

export default function Sidebar({
  teachers,
  rooms,
  studentGroups,
  currentView,
  onViewChange,
}: SidebarProps) {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>('teachers')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredGroups = studentGroups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const isSelected = (type: ViewType, id?: string) => {
    return currentView.type === type && currentView.id === id
  }

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 bg-white border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          View Timetable
        </h2>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Master View */}
        <div className="p-3">
          <button
            onClick={() =>
              onViewChange({ type: 'master', label: 'Master View' })
            }
            className={`w-full px-3 py-2.5 rounded-lg text-left font-medium transition-all duration-200 ${
              isSelected('master')
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-700 hover:bg-white hover:shadow-sm bg-white/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <GridIcon className="w-5 h-5" />
              Master View
            </span>
          </button>
        </div>

        {/* Teachers Section */}
        <div className="border-t border-slate-200">
          <button
            onClick={() => toggleSection('teachers')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <TeacherIcon className="w-4 h-4 text-blue-600" />
              </div>
              Teachers
              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full text-slate-500">
                {teachers.length}
              </span>
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                expandedSection === 'teachers' ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'teachers' && (
            <div className="pb-2 max-h-64 overflow-y-auto bg-white/30">
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  onClick={() =>
                    onViewChange({
                      type: 'teacher',
                      id: teacher.id,
                      label: teacher.name,
                    })
                  }
                  className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 flex items-center gap-3 ${
                    isSelected('teacher', teacher.id)
                      ? 'bg-indigo-50 text-indigo-700 border-r-3 border-indigo-500'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected('teacher', teacher.id)
                      ? 'bg-indigo-200 text-indigo-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {teacher.code}
                  </span>
                  <span className="truncate">{teacher.name}</span>
                </button>
              ))}
              {filteredTeachers.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400 text-center">No teachers found</p>
              )}
            </div>
          )}
        </div>

        {/* Rooms Section */}
        <div className="border-t border-slate-200">
          <button
            onClick={() => toggleSection('rooms')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <RoomIcon className="w-4 h-4 text-purple-600" />
              </div>
              Rooms
              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full text-slate-500">
                {rooms.length}
              </span>
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                expandedSection === 'rooms' ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'rooms' && (
            <div className="pb-2 max-h-64 overflow-y-auto bg-white/30">
              {filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() =>
                    onViewChange({
                      type: 'room',
                      id: room.id,
                      label: room.name,
                    })
                  }
                  className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                    isSelected('room', room.id)
                      ? 'bg-indigo-50 text-indigo-700 border-r-3 border-indigo-500'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{room.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isSelected('room', room.id)
                        ? 'bg-indigo-200 text-indigo-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {room.type}
                    </span>
                  </div>
                </button>
              ))}
              {filteredRooms.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400 text-center">No rooms found</p>
              )}
            </div>
          )}
        </div>

        {/* Student Groups Section */}
        <div className="border-t border-slate-200">
          <button
            onClick={() => toggleSection('groups')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <GroupIcon className="w-4 h-4 text-emerald-600" />
              </div>
              Classes
              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full text-slate-500">
                {studentGroups.length}
              </span>
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                expandedSection === 'groups' ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'groups' && (
            <div className="pb-2 max-h-64 overflow-y-auto bg-white/30">
              {/* Group by year */}
              {Array.from(new Set(filteredGroups.map((g) => g.yearGroup)))
                .sort((a, b) => a - b)
                .map((year) => (
                  <div key={year}>
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100/50 uppercase tracking-wide">
                      Year {year}
                    </div>
                    {filteredGroups
                      .filter((g) => g.yearGroup === year)
                      .map((group) => (
                        <button
                          key={group.id}
                          onClick={() =>
                            onViewChange({
                              type: 'group',
                              id: group.id,
                              label: group.name,
                            })
                          }
                          className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                            isSelected('group', group.id)
                              ? 'bg-indigo-50 text-indigo-700 border-r-3 border-indigo-500 font-medium'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          {group.name}
                        </button>
                      ))}
                  </div>
                ))}
              {filteredGroups.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400 text-center">No classes found</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="text-xs text-slate-400 text-center">
          The School
        </div>
      </div>
    </aside>
  )
}
