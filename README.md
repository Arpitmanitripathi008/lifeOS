# LifeOS — Student Edition
### AI-Powered Adaptive Life & Academic Operating System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4+-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-Flash--Lite-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> *"LifeOS adapts to the user's life. The user does not adapt their life to LifeOS."*

LifeOS is an intelligent, deterministic, and privacy-first life management system built specifically for college students. It bridges the gap between chaotic academic commitments, fixed college schedules, upcoming exam deadlines, coursework assignments, personal growth goals, and restorative health routines.

---

## Architecture Overview

LifeOS follows a modular client-server architecture designed for high maintainability, strict multi-tenancy, and zero overlap scheduling:

```
┌────────────────────────────────────────────────────────┐
│               Client (React 18 + Vite)                 │
│  Tailwind CSS • Lucide Icons • Editorial Warm Ivory UI │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (JWT Auth)
┌───────────────────────────▼────────────────────────────┐
│               Server (Express + TypeScript)            │
│  Auth Middleware • Zod Validation • Security Bounds    │
├───────────────────────────┬────────────────────────────┤
│   Deterministic Engine    │    Google Gemini Service   │
│  - Conflict-Free Slots    │  - Multimodal Vision & OCR │
│  - Real-Time Clock Cursor │  - Natural Language NLP    │
│  - Buffer & Meal Protect  │  - Adaptive Strategy       │
├───────────────────────────┴────────────────────────────┤
│                  Prisma ORM (SQLite)                   │
│   Multi-Tenant Scoped Data • Transactions • Cascades   │
└────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Real-Time Adaptive Daily Scheduler
* **Conflict-Free Invariant**: Mathematically guarantees zero scheduling overlaps across fixed college classes, meals, and study tasks.
* **Real-Time Clock Awareness**: Dynamically determines the current local time; when planning mid-day or evening, it never places tasks in the past.
* **Buffer & Cognitive Load Protection**: Caps daily workload sustainably (max 6h) and inserts mandatory rest buffers between intense study sessions.
* **Weekly Timetables & Holiday Overrides**: Automatically recognizes weekly holidays (e.g. Sunday) and supports natural language overrides (e.g. *"Tomorrow is a holiday"*, *"Half-day college today"*).

### 2. Multimodal Academic Intelligence
* **Document Parser**: Extracts subjects, course codes, units, topics, and exam schedules from official university syllabi and exam timetable sheets (PDFs, Word docs, photos, camera scans).
* **Smart Deduplication & Code Matching**: Normalizes Roman numerals (e.g., `Maths IV` = `Mathematics 4` = `MATHEMATICS-IV`), strips parenthetical subtitles, and tokenizes slash-separated codes (e.g. `BAS303/ BAS303H`).
* **Automated Exam Revision Planner**: Automatically breaks down syllabus topics into spaced revision blocks leading up to scheduled examination dates.

### 3. Integrated Coursework & Assignment Management
* Dedicated **Assignments** hub with subject linking, deadline countdowns, and estimated effort tracking.
* **1-Click Plan Work**: Pushes high-priority study sessions straight to your planner timeline.

### 4. AI-Powered Data Reset & Workspace Management
* **Mode A: Seeded Demo Cleanup**: Deletes only mock demonstration records while preserving user-created coursework, credentials, and settings.
* **Mode B: Complete Workspace Reset**: Wipes workspace data for a fresh start while preserving authentication credentials.
* **Safety First**: Full transactional rollback, multi-user isolation, interactive preview, and explicit confirmation before any destructive action.

### 5. Multi-Tenant Security & Privacy
* Every database query is strictly isolated by authenticated `userId`.
* Passwords hashed with `bcryptjs` (salt rounds: 10).
* Protected by JWT authentication and strict input validation via `Zod`.

---

## Project Structure

```
lifeos/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable UI & Dashboard Widgets
│   │   ├── context/            # AuthContext & State Providers
│   │   ├── pages/              # Academics, Planner, Focus, Goals, Settings
│   │   ├── services/           # Typed API Client Layer
│   │   └── types/              # Domain TypeScript Interfaces
│   ├── package.json
│   └── vite.config.ts
├── server/                     # Backend Application
│   ├── prisma/
│   │   ├── schema.prisma       # Database Schema & Relations
│   │   └── seed.ts             # Default Seed Data
│   ├── src/
│   │   ├── controllers/        # Express Route Handlers
│   │   ├── middleware/         # Auth & Zod Validation Middleware
│   │   ├── routes/             # REST API Endpoint Routers
│   │   ├── scheduling/         # Deterministic Adaptive Scheduler
│   │   ├── services/           # Gemini AI & Multimodal Parser Services
│   │   └── app.ts              # Express Application Entry
│   ├── scripts/                # Automated Regression Test Suites
│   ├── .env.example            # Sample Environment Variables
│   └── package.json
├── docs/                       # Project Documentation & Screenshots
└── .gitignore                  # Git Ignore Configuration
```

---

## Quickstart & Local Setup

### Prerequisites
* **Node.js**: v20+ recommended
* **npm**: v10+

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd lifeos

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

In `server/`:
```bash
cp .env.example .env
```
Open `server/.env` and configure:
```env
PORT=3001
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-flash-lite-latest"
JWT_SECRET="your-secure-jwt-secret-key"
NODE_ENV=development
```
*(Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey))*

### 3. Initialize Database & Seed Demo Data

```bash
cd server
npm run db:push
npm run db:seed
```

### 4. Run the Development Environment

Run both processes in separate terminals:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Web app runs on http://localhost:5173
```

---

## Default Demo Credentials

To explore demonstration data immediately:
* **Username**: `alex_rivera`
* **Password**: `password123`

Or register a new account on the login page to start with a clean workspace.

---

## Verification & Testing

LifeOS includes automated test suites covering scheduler determinism, multi-tenant isolation, and data reset safety:

```bash
cd server

# Run Multi-Tenancy & Auth tests
npx tsx scripts/testAuthAndMultiTenancy.ts

# Run Scheduler Determinism tests
npx tsx scripts/testScheduler.ts

# Run Holiday & Schedule Override tests
npx tsx scripts/testWeeklyScheduleAndHoliday.ts

# Run Mock Data Reset tests
npx tsx scripts/testDataReset.ts
```

---

## License
MIT License. Built for student productivity and academic wellness.
