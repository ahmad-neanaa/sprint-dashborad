# Memory — Sprint Dashboard

**Stack**: Vue 3 + Vite + Chart.js (frontend) → Electron IPC (contextBridge) → Native Node.js + better-sqlite3 (backend)

**DB**: `backend/data/sprint-dashboard.db`
- `projects` — id, name, github_project_id, github_token, expected_hours, all field mappings, done_value
- `sprints` — id, title, start_date, duration, project_id FK
- `items` — id, github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id FK, project_id FK, closed_at, created_at, updated_at
- `config` — global: github_token, last_refreshed, refresh_interval_hours
- `_migrations` — tracks applied migration files

**IPC Channels (window.api)**: getBurndown, getVelocity, getOverview, getTeam, getTimeAnalysis, getCycleTime, getCommitment, getCommitmentAssignee, getDefects, getScorecard, getStability, getKpiReview, getTimesheet, getConfig, updateConfig, putConfig, refreshData, getSprints, getProjects, createProject, updateProject, deleteProject. All data handlers accept optional project arguments.

**KPI Thresholds**: Delivery ≥85/≥70/<70 · Defect ≤15/≤30/>30 · Cycle ≤3d/≤7d/>7d · Est Variance ≤10/≤25/>25 · Delivery CV ≤15/≤30/>30 · Velocity CV ≤15/≤30/>30

**Key**: Defect inverts (low=Good). Overall = worst. `done_value`/`expected_hours` per-project from `projects` table. `REFRESH_KEY` and `PROJECT_KEY` provided via inject. Token: per-project > env var > config table.

**Styling**: Global utilities in `App.vue` unscoped (.view-container, .view-header, .sprint-selector, .kpi-row, .mode-toggle, .badge colors, etc.). Sprint selector in views, project selector in nav bar, mode toggle in relevant views (Burndown, Commitment, Velocity, Overview, Team, TimeAnalysis).

**Status**: Consolidated frontend views to 8 main reports + config (Burndown, Velocity, Overview, Commitment, Time Analysis, Quality, Scorecard, Team, Timesheet). HR Timesheet view completed. Migration to Electron Native IPC (replacing Next.js) completed. Remaining: Gap 3 (unit tests for new endpoints/features), Gap 5 (auto-refresh/cron).
