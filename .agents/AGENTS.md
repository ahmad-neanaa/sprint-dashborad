# AGENTS.md – Sprint Dashboard Agent Workspace

## Tech Stack & Architecture
- **Frontend**: Vue 3 (Composition API + `<script setup>` + TypeScript) + Vite + Chart.js
- **Backend**: Electron Main Process (Node.js + TypeScript)
- **Communication**: Native Electron IPC (`contextBridge` / `ipcMain` / `ipcRenderer`) under `window.api`
- **Database**: SQLite (via `better-sqlite3`), stored in OS `userData` folder (`sprint-dashboard.db`) in production
- **Packaging**: `electron-builder` (Linux AppImage/tar.gz, Windows portable exe)

---

## Core Guidelines & Constraints

### 1. Code Style & Layering
- Maintain strict separation of concerns between Vue frontend (renderer) and Electron main process (backend).
- Use TypeScript for both layers. Use parameterized SQL queries only (never concatenate queries).
- Projects state: Fetch project lists using the reactive `useProjects` / `useProvideProjects` composable to maintain state synchrony.
- Database validation: Verify all query structures against the active database schema in `backend/migrations/schema.sql`.

### 2. Time Calculations
- **Actual Work Time**: Sum the discrete time intervals spent in "In Progress" status. Clamp intervals to sprint dates or selected Date Range boundaries. Ignore work done outside active boundaries. Fallback to `created_at` to `closed_at` only for tasks direct-transitioned to "Done". Ghost tasks (in "To Do" or idle) must accrue 0 hours.
- **Carry Over**: Flags a task as carry over if created before sprint start OR if transitioned to "In Progress" prior to sprint start. Display a Jira-style orange badge next to these task titles.
- **Filtering**: Support both Sprint and Date Range globally/per-view using `TimeSelector.vue` on the frontend, passing selections properly to the backend.

### 3. UI Terminology
- Never use "Points" or "Story Points" in the user interface. Use "Estimated Hours" (maps internally to `points` / effort) and "Number of Issues" (maps internally to `issues` / count).

### 4. Security & Environment
- External HTTP/HTTPS links must open in the user's default browser (via `shell.openExternal`).
- GitHub token is handled on the main process (never sent to the client).

### 5. GraphQL API Ingestion
- Batch queries via top-level `nodes(ids: $ids)` with a maximum batch size of 50 when fetching timeline items to prevent GitHub resolver truncation.

### 6. Development & Build Commands
- **Dev Mode**: Concurrently start Vite and Electron: `npm run electron:dev`
- **Unit Testing**: Run Vitest: `npm run test --prefix backend -- --run src/` (native modules must be built for Node: `npm rebuild better-sqlite3 --prefix backend`)
- **App Packaging**: Compile and pack for Windows/Linux: `npm run package -- --win --linux` (native modules must be built for Electron runtime: `npm run rebuild:electron`)

### 7. Packaging Configuration
- Specify any native addons (like `node_modules/better-sqlite3`) under `"asarUnpack"` in `package.json`.
- Resolve paths to static files or migrations in backend code using `__dirname` relative pathing (e.g. `path.join(__dirname, '..', '..', 'migrations')`) instead of `process.cwd()`.
