# Memory — Sprint Dashboard

## Architecture
- **Frontend**: Vue 3 (Composition API + `<script setup>` + TypeScript), Vite, Chart.js + vue-chartjs
- **Backend**: Next.js (pages router), TypeScript, better-sqlite3
- **Database**: SQLite at `backend/data/sprint-dashboard.db`
- **Ports**: backend :3001, frontend :5173 (proxy `/api` -> :3001)

## API Endpoints (`backend/pages/api/`)
| Route | Method | Params | Description |
|---|---|---|---|
| `/api/burndown` | GET | `sprint` | Burndown chart data |
| `/api/velocity` | GET | — | Velocity trend & stats |
| `/api/overview` | GET | `sprint` | Sprint summary cards |
| `/api/team` | GET | `sprint` | Per-assignee breakdown |
| `/api/time-analysis` | GET | `sprint`, `mode` (points\|issues) | Time analysis by label |
| `/api/cycle-time` | GET | `sprint` | Cycle time per item |
| `/api/commitment` | GET | `sprint`, `mode` (points\|issues) | Commitment rate + KPI |
| `/api/commitment-assignee` | GET | `sprint`, `mode` | Commitment by assignee |
| `/api/defects` | GET | `sprint` | Bug count, rate, trend, assignee breakdown |
| `/api/scorecard` | GET | `sprint` | 5 health KPIs + overall |
| `/api/stability` | GET | `sprint` | Estimation accuracy, scope churn, delivery consistency, velocity CV |
| `/api/kpi-review` | GET | — | All sprints side-by-side with KPIs + averages |
| `/api/config` | GET/POST | — | Get / update config (expected_hours) |
| `/api/health` | GET | — | DB health check |
| `/api/refresh` | POST | — | Re-fetch GitHub data (not fully wired) |

## Nav Order
Burndown -> Velocity -> Overview -> Cycle -> Time -> Team -> Commit -> Commit/Asgn -> Defects -> Stability -> Scorecard -> KPI Review -> Config

## Database Schema
- `sprints`: id, name, start_date, end_date, created_at
- `sprint_items`: id, sprint_id, title, type (story|bug|task), status (To Do|In Progress|Done), assignee, story_points, estimated_hours, actual_time, source (MAN|AUTO|null), created_at, updated_at
- `config`: key, value

## Seed Data
3 sprints seeded regardless of GitHub fetch:
- **Sprint 1** (id=3): 9 items (3 bugs), varied statuses
- **Sprint 2** (id=4): 6 items (2 bugs)
- **Sprint 3** (id=5): 6 items (0 bugs)

## KPI Thresholds
| Metric | Good | Fair | Poor |
|---|---|---|---|
| Delivery Rate | >=85% | >=70% | <70% |
| Defect Rate | <=15% | <=30% | >30% |
| Cycle Time | <=3d | <=7d | >7d |
| Estimation Variance | <=10% | <=25% | >25% |
| Delivery Consistency (CV) | <=15% | <=30% | >30% |
| Velocity CV | <=15% | <=30% | >30% |

## Key Decisions
- Defect rate KPI inverts scale (low is Good).
- Overall health = worst of component KPIs.
- Estimation accuracy = `(1 - |actual-estimated|/estimated) * 100`; higher better.
- Delivery consistency = std dev of delivery rates across sprints.
- Scope churn = `100 - scopeCompletionRate`.
- Mode param `points|issues` toggles effort hours (points) vs item count (issues) in burndown, velocity, commitment, commitment-assignee.
- Source field: MAN (manual actual_time set), AUTO (Done but no actual_time), null otherwise.
- Sprint selector hardcoded to `['Sprint 1', 'Sprint 2']` in views — dynamic list not yet implemented.

## Calculator Functions (`backend/lib/calculators.ts`)
- `buildBurndown(db, sprint)` — daily remaining hours, scope line, ideal line
- `buildBurndownPoints(db, sprint)` — same but by issue count
- `buildVelocity(db)` — per-sprint actual hours + velocity moving average
- `buildVelocityPoints(db)` — same but issue count
- `buildTeamStats(db, sprint)` — per-assignee: committed, done, rate, actual + estimated hours, avg cycle time
- `buildOverview(db, sprint)` — total committed/done/not done, actual/estimated, delivery/commitment rate
- `buildTimeAnalysis(db, sprint, mode)` — by label: hours breakdown (estimated, actual, remaining, diff%)
- `calcCycleTime(db, sprintId)` — days from sprint start to Done for each item
- `calcCommitmentRate(db, sprint, mode)` — rate, KPI rating, per-status counts
- `calcCommitmentByAssignee(db, sprint, mode)` — per-assignee commitment rate + KPI
- `buildDefects(db, sprint)` — defect count, rate, trend data, per-assignee breakdown, defect items
- `buildScorecard(db, sprint)` — delivery, cycle, defect, estimation, velocity health
- `buildStability(db, sprint)` — estimation accuracy, scope completion, delivery consistency, velocity CV, trend data
- `buildKpiReview(db)` — all sprints with delivery/cycle/defect/estimation/velocity/scope KPI + overall rating + averages
- Helper functions: `rateToRating`, `defectsRating`, `kpiRating`, `estimationRating`, `consistencyCvKpi`

## Status Badges (color-coded)
- Green: Done/Good
- Purple: In Progress/Fair
- Gray: To Do/Poor

## Frontend Structure (`frontend/src/`)
- `views/` — one view per page (13 views)
- `composables/useApi.ts` — fetch wrappers for every endpoint
- `types/index.ts` — TypeScript interfaces
- `router/index.ts` — route definitions
- `App.vue` — nav bar + router outlet

## State
All 13 feature tasks complete. No blockers. Backend and frontend run successfully. All views render with seed data and respond to sprint selection.

## Known Gaps
- No dynamic sprint list — sprint selector values are hardcoded in views
- No real GitHub ingestion (seed data only)
- No unit/integration tests yet
- No auto-refresh / cron
- Mode toggle (points|issues) only wired in views that accept it
