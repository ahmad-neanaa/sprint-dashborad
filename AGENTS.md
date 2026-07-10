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
- Use **Vitest** as the testing framework.
- For unit tests requiring a database connection, mock `getDb()` to use an in-memory SQLite instance (`new Database(':memory:')`).
- Initialize the in-memory database in `beforeEach()` by executing `migrations/schema.sql` and manually seed known test data.
- Write integration tests for API endpoints (mocking GitHub if needed).
- Do not over‑engineer; focus on correctness first.

### 9. Project memory
- Always read `docs/memory.md` first — it contains the current state, schema, config keys, API endpoints, KPI thresholds, and implementation status.

### 10. Time Selection and Filtering
- The dashboard supports both Sprint-based and Date Range-based filtering globally/per-view.
- Use the reusable `TimeSelector.vue` component for choosing between Sprint or Date Range modes.
- Frontend views must destructure `selectionMode`, `startDate`, and `endDate` from `useSprintSelector()` and pass them appropriately to API client calls.
- Backend API endpoints must handle both parameters, passing `startDate`/`endDate` (in ISO string format `YYYY-MM-DD`) to calculators when `sprint` is not specified.

### 11. Actual Time Calculation Rules
When modifying business logic for "Actual Time" calculations (currently encapsulated in `backend/lib/calculators.ts` -> `getActualTimeSql`):
- **Active Work Time Summation**: Instead of continuous elapsed cycle time, actual time must sum the discrete time intervals spent in the "In Progress" status. Time spent in "Blocked", "To Do", or other idle states is excluded.
- **Boundaries Clamping**: All work time intervals are strictly clamped to boundaries. 
  - If a Date Range is selected, intervals are clamped to the `startDate` and `endDate` parameters.
  - If a Sprint is selected (or we fall back to sprint boundaries), intervals are clamped to the Sprint's start date (for sprint-assigned items).
  - Any work done outside the active boundaries is ignored (accrues 0 hours).
- **No In-Progress Transitions Fallback**: For tasks that were moved directly to "Done" (without any "In Progress" transitions), the actual time is calculated as the interval between `created_at` and `closed_at`, clamped to the active boundaries.
- **Ghost Hours Prevention**: Tasks that are in "To Do" or other idle states (no "In Progress" transition and not "Done") must always accrue **0 hours** under all boundaries.

### 12. Carry Over Calculation Rules
When calculating whether a task is "Carry Over" (encapsulated in `backend/lib/calculators.ts` -> `getIsCarryOverSql`):
- **Carry Over Definition**: A task is considered a carry over if it was created before the sprint start date (`created_at < sprint.start_date || ' 00:00:00'`) OR if it has a transition to "In Progress" prior to the sprint start date.
- **Views Display**: Any view displaying task item lists (e.g. Burndown, Overview, Team, Commitment, Quality, and Timesheet) must show a Jira-style orange badge next to the task title if the task is flagged as a carryover.

## Interacting with the Agent
- When you ask the agent to implement a feature, it will propose changes to both frontend and backend.
- The agent will respect the folder structure and TypeScript conventions.
- If clarification is needed, the agent will ask before making assumptions.

### 13. Native Module Rebuilding for Electron
When installing or updating native modules (such as `better-sqlite3`) in the Electron backend, the module must be rebuilt to match Electron's internal Node.js ABI version. 
Always use the following pattern within the `backend` directory to rebuild:
`npm_config_runtime=electron npm_config_target=43.1.0 npm_config_disturl=https://electronjs.org/headers npm rebuild <MODULE_NAME> --build-from-source`

### 14. Database Schema Verification
When writing, migrating, or modifying SQL queries in the application code (e.g., `ipc-handlers.ts`), you MUST strictly verify the table names, column names, and relationships against the active schema definition in `backend/migrations/schema.sql`. Do not assume legacy column names are correct without checking the schema.

### 15. Project List State Synchrony
The list of projects shown in the top navigation bar (`App.vue`) and settings (`ConfigView.vue`) must be synchronized globally. Always use the shared Vue inject/provide system composables (`useProjects` / `useProvideProjects`) to manage and fetch the project list so that any project modification reactively updates all components.

### 16. UI Terminology Constraints (Hours vs. Points)
Never use "Points" or "Story Points" in the user-facing interface (buttons, headers, inputs, text). Label the modes as "Estimated Hours" (which maps internally to the `points` parameter/effort database column) and "Number of Issues" (which maps internally to the `issues` parameter).

### 17. Electron External Links
All external HTTP/HTTPS links (such as GitHub issues) must open in the user's default browser. Ensure `backend/src/main.ts` maintains listeners for `setWindowOpenHandler` and `will-navigate` on the main window's `webContents` to open them via `shell.openExternal(url)` and prevent them from opening in the Electron window.

### 18. GitHub GraphQL API Ingestion Constraints
When fetching timeline items or status change history via the GitHub GraphQL API:
- Do not query timeline connections (e.g., `timelineItems`) nested inside `ProjectV2` queries, as GitHub silently omits/drops them for newer issues. Instead, fetch the issue/PR content IDs and query them via top-level `nodes(ids: $ids)`.
- When using `nodes(ids: $ids)` with nested connections (like `timelineItems`), **never exceed a batch size of 50**. Requesting larger batch sizes (e.g., 100) causes GitHub's API resolver to silently drop/empty out the nested timeline connections.




