# School Timetabler

A constraint-based school timetabling application that helps administrators create and manage class schedules while respecting constraints like teacher availability, room capacity, and student group conflicts.

## What It Does

This application provides:

- **Visual Timetable Display**: View timetables by teacher, room, or student group
- **Master View**: See all assignments across the school at a glance
- **Drag-and-Drop Scheduling**: Move lessons between time slots with real-time conflict validation
- **Conflict Detection**: Automatically detects and explains scheduling conflicts:
  - Teacher double-booking
  - Room conflicts
  - Student group clashes
  - Slot occupancy
  - Teacher unavailability (part-time, meetings, etc.)
- **Room Selection**: Choose which room to use when moving lessons:
  - See room availability at the target time slot
  - Room type suitability indicators (e.g., Science Lab for Science)
  - Warnings when selecting unsuitable room types
- **Teacher Availability**: Respects teacher schedules:
  - Part-time teacher constraints
  - Meeting blocks
  - Early finish / late start days
- **Room Type Requirements**: Subjects can require specific room types:
  - Science requires Science Lab
  - Computing requires Computer Room
  - PE requires Sports Hall
- **Responsive Design**: Works on desktop and tablet devices

## Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Option 1: Run Both Together

From the project root:

```bash
./dev.sh
```

This starts both the backend (port 8000) and frontend (port 3000).

### Option 2: Run Separately

**Backend:**
```bash
cd backend
./start.sh
# Or manually: uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
./start.sh
# Or manually: npm run dev
```

Then open http://localhost:3000 in your browser.

## Loading Different School Data

Currently, the application uses demo data defined in `frontend/src/App.tsx`. To load different school data:

### Modifying Demo Data

Edit the following constants in `App.tsx`:

```typescript
// Teachers
const TEACHERS: Teacher[] = [
  { id: 'smi', name: 'Sarah Mitchell', code: 'SMI' },
  // Add more teachers...
]

// Rooms
const ROOMS: Room[] = [
  { id: 'r101', name: 'Room 101', type: 'Standard' },
  // Add more rooms...
]

// Student Groups
const STUDENT_GROUPS: StudentGroup[] = [
  { id: '7a', name: 'Year 7A', yearGroup: 7 },
  // Add more groups...
]

// Timetable Data
const DEMO_TIMETABLE: TimetableData = {
  0: {  // Monday (0-4 for Mon-Fri)
    1: {  // Period 1 (1-6)
      lessonId: 'l001',
      subject: 'English',
      subjectId: 'eng',
      teacher: 'Sarah Mitchell',
      teacherCode: 'SMI',
      room: 'Room 101',
      studentGroup: 'Year 7A'
    },
    // More periods...
  },
  // More days...
}
```

### Configuring Teacher Availability

Edit `TEACHER_AVAILABILITY` in `App.tsx` to set when teachers are unavailable:

```typescript
const TEACHER_AVAILABILITY: TeacherAvailability[] = [
  {
    teacher_code: 'SMI',
    teacher_name: 'Sarah Mitchell',
    unavailable_slots: [
      { day: 0, period: 4 }, // Monday P4 - meeting
      { day: 4, period: 5 }, // Friday P5 - early finish
      { day: 4, period: 6 }, // Friday P6 - early finish
    ],
  },
  // More teachers...
]
```

### Configuring Room Type Requirements

Edit `SUBJECT_ROOM_REQUIREMENTS` in `App.tsx` to specify which subjects need special rooms:

```typescript
const SUBJECT_ROOM_REQUIREMENTS: Record<string, string | null> = {
  sci: 'Science Lab',      // Science needs a Science Lab
  cmp: 'Computer Room',    // Computing needs a Computer Room
  pe: 'Sports Hall',       // PE needs the Sports Hall
  eng: null,               // English can use any room
  mat: null,               // Maths can use any room
}
```

### Future: API-Based Data Loading

In future phases, the application will support loading data from:
- JSON/CSV file imports
- Database connections
- External school management systems

## Known Limitations (Proof of Concept)

This is a proof-of-concept with the following limitations:

### Data Management
- No persistent storage - data resets on page refresh
- School data is hardcoded in the frontend
- No import/export functionality yet

### Scheduling
- Manual scheduling only - no automatic timetable generation in UI
- Constraint solver exists in backend but not yet integrated with UI
- Limited to 5 days (Mon-Fri) and 6 periods

### Constraints
- Core conflict detection (teacher, room, student group, teacher availability)
- Room type requirements supported (Science Lab, Computer Room, Sports Hall)
- No support yet for:
  - Teacher preferences (preferred times/rooms)
  - Consecutive lesson requirements (double periods)
  - Break/lunch period handling
  - Maximum lessons per day limits

### User Experience
- No authentication or user roles
- No undo/redo for changes
- No multi-user support
- Limited mobile responsiveness

### Backend
- In-memory data only
- No database integration
- API endpoints for validation only (no full CRUD)

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, @dnd-kit
- **Backend**: Python, FastAPI, Google OR-Tools (constraint solver)
- **Build**: Vite, TypeScript compiler

## Project Structure

```
ai-timetabler/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── models/       # Pydantic models
│   │   ├── solver/       # Constraint solver
│   │   └── main.py       # FastAPI app
│   ├── requirements.txt
│   └── start.sh
├── frontend/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   └── App.tsx       # Main app
│   ├── package.json
│   └── start.sh
├── dev.sh                # Run both servers
└── README.md
```

## License

                    GNU GENERAL PUBLIC LICENSE
                       Version 3

