# ARCHITECTURE.md – Sprint Dashboard Application

## Overview
The Sprint Dashboard is a local web application that provides agile metrics for a GitHub Project.  
It replaces the single‑file HTML prototype with a maintainable, secure, and efficient stack.

## Tech Stack
| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Vue 3 + Vite, Chart.js, TypeScript  |
| Backend    | Next.js (API routes only), TypeScript |
| Database   | SQLite (via `better-sqlite3`)       |
| DevOps     | Entirely local, run via `npm run dev` in both directories |

## System Components

### 1. Backend (Next.js)
- **Purpose**: Securely store the GitHub token, fetch project data from GitHub GraphQL API, compute agile metrics, and serve them via REST endpoints.
- **Key responsibilities**:
  - Authentication: none (local only), but GitHub token is read from environment variable.
  - Data ingestion: a scheduled or manually triggered job pulls all project items, parses field values, and stores them in SQLite.
  - Metric calculation: Burndown, velocity, cycle time, etc., are computed from DB data.
  - API endpoints: RESTful routes under `/api/` (e.g., `/api/burndown?sprint=Sprint%201`).
  - Configuration: stores global settings like “Expected Hours per Sprint” in a `config` table.
- **Database schema** (simplified):
  - `sprints` (id, title, start_date, duration)
  - `items` (id, github_id, title, number, url, type, status, effort, actual_time, assignee, sprint_id, closed_at, …)
  - `config` (key, value) – e.g., `expected_hours` = 120.
- **Caching**: Data remains in SQLite until explicitly refreshed. The `/api/refresh` endpoint triggers a re‑fetch.

### 2. Frontend (Vue 3)
- **Purpose**: Display the dashboard UI, identical in functionality to the HTML prototype but rebuilt with modern components.
- **Key responsibilities**:
  - Routing: each tab (Burndown, Velocity, Team, …) is a separate route (or dynamic component) using Vue Router.
  - State management: uses composables to fetch data from the backend and pass to chart components.
  - UI components: Summary cards, chart panels, data tables, collapsible drawers.
  - The “Expected Hours per Sprint” target is fetched from backend config and displayed in the relevant views.
- **Key libraries**: `vue-chartjs`, `chart.js`, `pinia` (optional), `axios` or native `fetch`.

### 3. Database (SQLite)
- Stored as a single file `backend/data/sprint-dashboard.db`.
- Schema is managed via a migration script (or simply a `schema.sql` file).
- Why SQLite? Perfect for a single‑user local tool; zero setup, no external server needed.

## Data Flow
[GitHub API]
↓ (fetch on demand or schedule)
[Backend: ingestion + calculation] → SQLite
↓ (REST API)
[Frontend: Vue components] → User Browser

text
1. **Ingestion**: Backend calls GitHub GraphQL with the token, loops through items, parses fields, and upserts into SQLite.
2. **API requests**: Frontend calls e.g. `GET /api/burndown?sprint=Sprint%201`. Backend queries DB, runs `buildBurndown` logic, returns JSON.
3. **Rendering**: Vue components use the returned data to render charts and tables.

## Security Model
- The GitHub token never leaves the backend.
- API routes do not require authentication because the app is local.
- However, the backend should be configured to listen only on `localhost` (default Next.js dev server behavior).

## Local Deployment
```bash
# Terminal 1 – Backend
cd backend
cp .env.example .env   # add BACKEND_GH_TOKEN=your_token
npm install
npm run dev            # runs on localhost:3000

# Terminal 2 – Frontend
cd frontend
npm install
npm run dev            # runs on localhost:5173 (proxies API calls to :3000)
In production‑like local use, you can build both and serve the Vue app from the Next.js server using a static export or reverse proxy.
```

