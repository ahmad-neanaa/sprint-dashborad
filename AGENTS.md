# AGENTS.md – Sprint Dashboard Agent Workspace

## Purpose
You are an AI coding assistant helping build a local **Sprint Dashboard** application.  
The app replaces the single‑file HTML prototype with a proper three‑tier architecture:

- **Frontend**: Vue 3 (Composition API + `<script setup>` + TypeScript)
- **Backend**: Next.js API routes (Node.js, with TypeScript)
- **Database**: SQLite (via `better-sqlite3`)
- **Charts**: Chart.js with vue-chartjs wrapper

All components run on the developer’s machine – no external hosting needed.

## Agent Guidelines

### 1. Always think in layers
- `backend/` – Next.js application serving REST endpoints and managing database.
- `frontend/` – Vue application that consumes the REST API.
- Do not mix frontend and backend concerns.

### 2. Security first
- The GitHub Personal Access Token is stored **only** on the server (`BACKEND_GH_TOKEN` environment variable).
- Never send the token to the client. The frontend only receives processed data.
- Validate all API inputs on the server (e.g., sprint names, query parameters).

### 3. Code style
- Use TypeScript everywhere (both Vue and Next.js).
- Follow Vue 3 Composition API with `<script setup>` and composables for logic reuse.
- Backend: use Next.js API routes with proper error handling.
- SQL queries: parameterised, never string‑concatenated.

### 4. Folder structure (proposed)
```
/workspace
├── AGENTS.md
├── ARCHITECTURE.md
├── frontend/ # Vue 3 + Vite
│ ├── src/
│ │ ├── components/ # Reusable UI components (summary cards, charts, tables)
│ │ ├── views/ # Page‑level views (Burndown, Velocity, etc.)
│ │ ├── composables/ # useApi, useSprintData, etc.
│ │ ├── stores/ # Pinia stores (optional)
│ │ ├── types/ # TypeScript interfaces
│ │ └── App.vue
│ └── package.json
├── backend/ # Next.js app
│ ├── pages/
│ │ └── api/ # API routes: burndown, velocity, team, ...
│ ├── lib/ # DB connection, GitHub GraphQL client, calculators
│ ├── prisma/ or migrations/ # SQLite schema
│ └── package.json
└── shared/ # (optional) shared type definitions
```

### 5. Implementation order (when building from scratch)
1. Set up `backend` with SQLite schema (sprint_items, sprints, configurations).
2. Implement GitHub data ingestion (fetch project items, parse, store in DB).
3. Create API endpoints that replicate the logic from the HTML prototype (burndown, velocity, etc.).
4. Set up `frontend` with Vue Router, views for each tab, and connect to API.
5. Add the “expected hours per sprint” global target as a configuration stored in DB.
6. Polish UI (Jira‑style theme) and add caching / scheduled refresh on the backend.

### 6. Reuse existing logic
The HTML prototype contains many calculation functions (`calcActualHours`, `buildBurndown`, etc.).  
When building the backend, refactor them into separate `lib/calculators.ts` modules, adjusting for database queries rather than in‑memory arrays.

### 7. Caching & refresh
- The backend should cache project data in SQLite.
- When the user requests data, serve from DB.
- A manual “Refresh” button (or a cron‑like trigger) re‑fetches from GitHub and updates DB.
- The “Expected Hours per Sprint” setting is persisted in a `config` table.

### 8. Testing
- Write unit tests for metric calculations (using known data).
- Write integration tests for API endpoints (mocking GitHub if needed).
- Do not over‑engineer; focus on correctness first.

### 9. Project memory
- Always read `docs/memory.md` first — it contains the current state, schema, config keys, API endpoints, KPI thresholds, and implementation status.

## Interacting with the Agent
- When you ask the agent to implement a feature, it will propose changes to both frontend and backend.
- The agent will respect the folder structure and TypeScript conventions.
- If clarification is needed, the agent will ask before making assumptions.



