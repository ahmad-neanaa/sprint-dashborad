# Memory — Sprint Dashboard

**Stack**: Vue 3 + Vite + Chart.js (frontend :5173) → proxy → Next.js + better-sqlite3 (backend :3001)

**DB**: `backend/data/sprint-dashboard.db`
- `projects` — id, name, github_project_id, github_token, expected_hours, all field mappings, done_value
- `sprints` — id, title, start_date, duration, project_id FK
- `items` — id, github_id, title, number, url, type, status, effort, actual_time, assignee, sprint_id FK, project_id FK, closed_at, created_at, updated_at
- `config` — global: github_token, last_refreshed, refresh_interval_hours
- `_migrations` — tracks applied migration files

**Endpoints**: burndown, velocity, overview, team, time-analysis, cycle-time, commitment, commitment-assignee, defects, scorecard, stability, kpi-review, config (GET/PUT/POST), health, refresh, sprints, projects (GET/POST/PUT/DELETE). All data endpoints accept optional `?project=`.

**KPI Thresholds**: Delivery ≥85/≥70/<70 · Defect ≤15/≤30/>30 · Cycle ≤3d/≤7d/>7d · Est Variance ≤10/≤25/>25 · Delivery CV ≤15/≤30/>30 · Velocity CV ≤15/≤30/>30

**Key**: Defect inverts (low=Good). Overall = worst. `done_value`/`expected_hours` per-project from `projects` table. `REFRESH_KEY` and `PROJECT_KEY` provided via inject. Token: per-project > env var > config table.

**Styling**: Global utilities in `App.vue` unscoped (.view-container, .view-header, .sprint-selector, .kpi-row, .mode-toggle, .badge colors, etc.). Sprint selector in views, project selector in nav bar, mode toggle in 7 views (Burndown, Commitment, CommitAssignee, Velocity, Overview, Team, TimeAnalysis).

**Status**: Gap 4 done (mode toggle in all applicable views). Remaining: Gap 3 (unit tests), Gap 5 (auto-refresh/cron).
