# Sprint Dashboard

Local agile metrics dashboard for GitHub Projects. Replaces a single-file HTML prototype with a proper three-tier stack.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Vue 3 + Vite + TypeScript + Chart.js |
| Backend  | Next.js (API routes) + TypeScript |
| Database | SQLite (better-sqlite3) |

## Quick Start

```bash
# Start both servers
./sprint-dash.sh start

# Stop both servers
./sprint-dash.sh stop

# Check status
./sprint-dash.sh status
```

- **Frontend**: http://localhost:5173
- **Backend**:  http://localhost:3001

## Manual Start

```bash
# Terminal 1 – Backend
cd backend
cp .env.example .env   # add BACKEND_GH_TOKEN=your_token
npm install
npm run dev

# Terminal 2 – Frontend
cd frontend
npm install
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + DB migration |
| `/api/burndown?sprint=<name>` | GET | Burndown chart data |
| `/api/velocity` | GET | Velocity per sprint |
| `/api/team` | GET | Per-assignee stats |
| `/api/config` | GET | All config values |
| `/api/config` | POST | Set config value (`{"key": "expected_hours", "value": "120"}`) |
| `/api/refresh` | POST | Re-fetch data from GitHub |

## Environment

Create `backend/.env`:

```
BACKEND_GH_TOKEN=github_pat_xxxxxxxxxxxx
```

The token requires read access to the GitHub Project (classic or Organization project).
