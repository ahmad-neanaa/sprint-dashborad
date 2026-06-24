# Sprint Dashboard — Gap Work Plan

Generated: 2026-06-24

## Context
Based on `docs/memory.md` Known Gaps section and full codebase exploration.
All 13 original feature tasks are complete. This plan covers the 5 remaining gaps.

---

## Gap 1 — Dynamic Sprint List (Priority: High)

### Problem
- No `/api/sprints` backend endpoint exists.
- No `getSprints()` in `frontend/src/composables/useApi.ts`.
- 8 views hardcode sprint values:
  | View | File | Line | Pattern |
  |---|---|---|---|
  | BurndownView | BurndownView.vue | 31 | `ref('Sprint 1')` + free-text input |
  | OverviewView | OverviewView.vue | 8 | `ref('Sprint 1')` + free-text input |
  | CycleTimeView | CycleTimeView.vue | 22 | `ref('Sprint 1')` + free-text input |
  | TimeAnalysisView | TimeAnalysisView.vue | 20 | `ref('Sprint 1')` + free-text input |
  | ScorecardView | ScorecardView.vue | 8–9 | hardcoded `['Sprint 1', 'Sprint 2']` select |
  | StabilityView | StabilityView.vue | 22–23 | hardcoded `['Sprint 1', 'Sprint 2']` select |
  | DefectsView | DefectsView.vue | 23, 33 | stub `loadSprints()` returns `['Sprint 1']` |
  | CommitAssigneeView | CommitAssigneeView.vue | 34–35, 52–53 | stub `loadSprints()` returns `['Sprint 1']` |

### Tasks
1. Add `backend/pages/api/sprints.ts`
   - `GET /api/sprints` → `SELECT name FROM sprints ORDER BY start_date`
   - Returns `{ sprints: string[] }`
2. Add `getSprints()` to `frontend/src/composables/useApi.ts`
3. Update all 8 views:
   - Replace hardcoded arrays/defaults with `onMounted(() => getSprints())`
   - Convert free-text inputs (Burndown, Overview, CycleTime, TimeAnalysis) to `<select>` dropdowns
   - Auto-select first sprint from the returned list

---

## Gap 2 — GitHub Ingestion (Priority: Critical)

### Problem
- `backend/pages/api/refresh.ts` only runs a connectivity ping (`viewer { login }`).
- No `backend/lib/github.ts` GraphQL client exists.
- No parsing or upsert of project items into DB.
- Config table has `github_token`, `github_project_id`, `status_field`, `effort_field`,
  `actual_time_field`, `assignee_field`, `sprint_field`, `type_field` — none used during refresh.
- `refreshData()` in `useApi.ts` is exported but never called from any view.

### Tasks
1. Create `backend/lib/github.ts`
   - Typed GraphQL client using `process.env.BACKEND_GH_TOKEN`
   - `fetchProjectItems(projectId, fields)` — paginated query (100/page, cursor loop)
   - Returns typed `ProjectItem[]` array
2. Rewrite `backend/pages/api/refresh.ts`
   - Read `github_project_id` from config table (or env fallback)
   - Read all field-mapping keys from config (`status_field`, etc.)
   - Call `fetchProjectItems()` from `lib/github.ts`
   - Upsert sprints into `sprints` table (insert or update by name)
   - Upsert items into `sprint_items` table (preserve `MAN` source rows on conflict)
   - Update `last_refreshed` in config
3. Add **Refresh** button to `App.vue` nav bar
   - Calls `refreshData()` from `useApi.ts`
   - Shows loading spinner / success toast / error message

---

## Gap 3 — Unit Tests (Priority: High)

### Problem
- Zero test files exist anywhere in the project.
- No test runner configured in `backend/package.json` or `frontend/package.json`.

### Tasks
1. Add `vitest` and `@vitest/coverage-v8` to `backend/package.json` devDependencies
2. Add `"test"` and `"test:coverage"` scripts to `backend/package.json`
3. Create `backend/lib/calculators.test.ts`
   - Set up an in-memory SQLite fixture seeded with known data
   - Test each major calculator:
     - `buildBurndown` / `buildBurndownPoints`
     - `buildVelocity` / `buildVelocityPoints`
     - `buildTeamStats`
     - `buildOverview`
     - `buildDefects`
     - `buildScorecard`
     - `buildStability`
     - `buildKpiReview`
   - Test rating helpers: `rateToRating`, `defectsRating`, `kpiRating`, `estimationRating`, `consistencyCvKpi`

---

## Gap 4 — Mode Toggle in 3 More Views (Priority: Low-Medium)

### Problem
- `OverviewView`, `TeamView`, `TimeAnalysisView` have no `points|issues` mode toggle.
- Backend routes `overview.ts`, `team.ts`, `timeanalysis.ts` ignore the `mode` param.

### Tasks
1. Update `backend/pages/api/overview.ts` — accept `mode` query param, route to `buildOverview(db, sprint, mode)`
2. Update `backend/pages/api/team.ts` — same pattern
3. Update `backend/pages/api/timeanalysis.ts` — same pattern
4. Update calculator functions in `backend/lib/calculators.ts` to accept `mode` where applicable
5. Add mode toggle UI (`<button>` pair) to `OverviewView.vue`, `TeamView.vue`, `TimeAnalysisView.vue`
6. Wire `watch(mode, load)` in each view

---

## Gap 5 — Auto-refresh / Cron (Priority: Medium)

### Problem
- No scheduled refresh mechanism exists.
- No `node-cron` or similar in backend dependencies.

### Tasks
1. Add `node-cron` to `backend/package.json` dependencies
2. Create `backend/lib/scheduler.ts`
   - Reads `refresh_interval_hours` from config table (default: 6)
   - Schedules refresh job using `node-cron`
   - Re-uses the same ingestion logic as `refresh.ts`
3. Start scheduler on Next.js server startup (custom server or `instrumentation.ts`)
4. Add `refresh_interval_hours` setting to `ConfigView.vue` and `backend/pages/api/config.ts`

---

## Execution Order

1. **Gap 1** — Dynamic sprint list (unblocks dropdowns before ingestion is live)
2. **Gap 2** — GitHub ingestion (populates the sprints table the dropdowns depend on)
3. **Gap 3** — Unit tests (validate calculators with known seed data)
4. **Gap 4** — Mode toggle in 3 remaining views
5. **Gap 5** — Auto-refresh / cron

---

## Files to Create
| File | Purpose |
|---|---|
| `backend/pages/api/sprints.ts` | Dynamic sprint list endpoint |
| `backend/lib/github.ts` | GitHub GraphQL client |
| `backend/lib/scheduler.ts` | node-cron auto-refresh |
| `backend/lib/calculators.test.ts` | Vitest calculator tests |

## Files to Modify
| File | Change |
|---|---|
| `backend/pages/api/refresh.ts` | Full rewrite — real ingestion |
| `backend/pages/api/overview.ts` | Accept `mode` param |
| `backend/pages/api/team.ts` | Accept `mode` param |
| `backend/pages/api/timeanalysis.ts` | Accept `mode` param |
| `backend/lib/calculators.ts` | Add `mode` support to 3 builders |
| `backend/package.json` | Add vitest, node-cron |
| `frontend/src/composables/useApi.ts` | Add `getSprints()` |
| `frontend/src/App.vue` | Add Refresh button |
| `frontend/src/views/BurndownView.vue` | Dynamic sprint select |
| `frontend/src/views/OverviewView.vue` | Dynamic sprint select + mode toggle |
| `frontend/src/views/CycleTimeView.vue` | Dynamic sprint select |
| `frontend/src/views/TimeAnalysisView.vue` | Dynamic sprint select + mode toggle |
| `frontend/src/views/ScorecardView.vue` | Dynamic sprint select |
| `frontend/src/views/StabilityView.vue` | Dynamic sprint select |
| `frontend/src/views/DefectsView.vue` | Dynamic sprint select |
| `frontend/src/views/CommitAssigneeView.vue` | Dynamic sprint select |
| `frontend/src/views/TeamView.vue` | Mode toggle |
| `frontend/src/views/ConfigView.vue` | refresh_interval_hours setting |
