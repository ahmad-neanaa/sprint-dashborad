import { getDb } from './db'

export function getActualTimeSql(doneStatus: string, inProgressStatus: string) {
  const ds = doneStatus.replace(/'/g, "''");
  const ips = inProgressStatus.replace(/'/g, "''");
  return `
    COALESCE(
      i.actual_time,
      CASE WHEN i.sprint_id IS NOT NULL THEN
        CASE WHEN i.status = '${ds}' OR i.status = '${ips}' OR (SELECT COUNT(*) FROM item_transitions t WHERE t.item_id = i.id AND t.status = '${ips}') > 0 THEN
          MAX(0, julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(
            MAX(
              (SELECT start_date FROM sprints s WHERE s.id = i.sprint_id),
              COALESCE((SELECT MIN(t.start_date) FROM item_transitions t WHERE t.item_id = i.id AND t.status = '${ips}'), '')
            )
          )) * 8
        ELSE 0 END
      ELSE
        CASE WHEN i.status = '${ds}' THEN
          COALESCE(
            (SELECT (julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(MIN(t.start_date))) * 8 FROM item_transitions t WHERE t.item_id = i.id AND t.status = '${ips}'),
            (julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(i.created_at)) * 8
          )
        ELSE
          COALESCE((SELECT SUM(julianday(COALESCE(t.end_date, datetime('now'))) - julianday(t.start_date)) * 8 FROM item_transitions t WHERE t.item_id = i.id AND t.status = '${ips}'), 0)
        END
      END
    )`;
}


function getProjectId(projectName?: string): number | null {
  if (!projectName) return null
  const row = getDb().prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined
  return row?.id ?? null
}

function getProjectFilter(projectName?: string): { sql: string; params: unknown[] } {
  const pid = getProjectId(projectName)
  if (pid === null) return { sql: '', params: [] }
  return { sql: 'AND s.project_id = ?', params: [pid] }
}

function getSprintProjectFilter(projectName?: string): { sql: string; params: unknown[] } {
  const pid = getProjectId(projectName)
  if (pid === null) return { sql: '', params: [] }
  return { sql: 'AND i.project_id = ?', params: [pid] }
}

function getIssueTypeFilter(issueType?: string, prefix = 'i'): { sql: string; params: unknown[] } {
  if (!issueType) return { sql: '', params: [] }
  const field = prefix ? `${prefix}.type` : 'type'
  return { sql: ` AND ${field} = ?`, params: [issueType] }
}

function getDoneValue(projectName?: string): string {
  if (projectName) {
    const row = getDb().prepare("SELECT done_value FROM projects WHERE name = ?").get(projectName) as { done_value: string } | undefined
    if (row?.done_value) return row.done_value
  }
  return 'Done'
}

function getInProgressValue(projectName?: string): string {
  if (projectName) {
    const row = getDb().prepare("SELECT in_progress_value FROM projects WHERE name = ?").get(projectName) as { in_progress_value: string } | undefined
    if (row?.in_progress_value) return row.in_progress_value
  }
  return 'In Progress'
}

function getExpectedHours(projectName?: string): number {
  if (projectName) {
    const row = getDb().prepare("SELECT expected_hours FROM projects WHERE name = ?").get(projectName) as { expected_hours: number } | undefined
    if (row) return row.expected_hours
  }
  return 0
}

export interface BurndownPoint {
  date: string
  ideal: number
  actual: number
}

export interface BurndownSummary {
  total: number
  completed: number
  remaining: number
  daysLeft: number
  daysTotal: number
  percentComplete: number
}

export interface BurndownItem {
  title: string
  number: number
  url: string
  type: string
  status: string
  effort: number | null
  actual_time: number | null
  assignee: string | null
  closed_at: string | null
}

export interface BurndownData {
  summary: BurndownSummary
  points: BurndownPoint[]
  items: BurndownItem[]
}

export function buildBurndown(sprintTitle: string | null, mode: 'points' | 'issues' = 'points', projectName?: string, startDate?: string, endDate?: string, issueType?: string): BurndownData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let startStr: string
  let totalDays: number
  let items: BurndownItem[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT * FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined

    if (!sprint) return null
    startStr = sprint.start_date
    totalDays = sprint.duration
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else {
    return null
  }

  const expectedHours = getExpectedHours(projectName)
  const startDateObj = new Date(startStr)

  const now = new Date()
  const dayIndex = Math.min(
    Math.max(
      Math.floor((now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)),
      0
    ),
    totalDays
  )
  const daysLeft = totalDays - dayIndex

  const total = mode === 'points' ? expectedHours : items.length
  const closedItems = items.filter((i) => i.status === doneStatus)
  const completed = mode === 'points'
    ? closedItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    : closedItems.length
  const remaining = total - completed
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0

  const points: BurndownPoint[] = []
  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDateObj)
    date.setDate(date.getDate() + day)
    const dateStr = date.toISOString().slice(0, 10)

    const ideal = total * (1 - day / totalDays)

    const closedOnOrBefore = items.filter(
      (i) => i.closed_at && i.closed_at.slice(0, 10) <= dateStr
    )
    const actualRemaining = mode === 'points'
      ? total - closedOnOrBefore.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
      : total - closedOnOrBefore.length

    points.push({
      date: dateStr,
      ideal: Math.max(0, Math.round(ideal * 10) / 10),
      actual: Math.max(0, Math.round(actualRemaining * 10) / 10),
    })
  }

  return {
    summary: {
      total: Math.round(total * 10) / 10,
      completed: Math.round(completed * 10) / 10,
      remaining: Math.round(remaining * 10) / 10,
      daysLeft,
      daysTotal: totalDays,
      percentComplete,
    },
    points,
    items,
  }
}

export interface VelocityEntry {
  sprint: string
  completed: number
}

export interface VelocityData {
  velocity: VelocityEntry[]
  average: number
  target: number
  currentSprint: {
    title: string
    completed: number
    items: BurndownItem[]
  } | null
  bestSprint: { sprint: string; completed: number } | null
  sprintCount: number
}

export function buildVelocity(mode: 'points' | 'issues' = 'points', projectName?: string, issueType?: string): VelocityData {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  const bindParams: unknown[] = []
  let countExpr = ''
  if (mode === 'points') {
    countExpr = `COALESCE(SUM(CASE WHEN i.status = ? THEN 
        ${getActualTimeSql(doneStatus, inProgressStatus)}
       ELSE 0 END), 0)`
    bindParams.push(doneStatus)
  } else {
    countExpr = "COUNT(CASE WHEN i.status = ? THEN 1 END)"
    bindParams.push(doneStatus)
  }

  const rows = db
    .prepare(
      `SELECT s.title AS sprint, ${countExpr} AS completed
       FROM sprints s
       LEFT JOIN items i ON i.sprint_id = s.id ${typeFilter.sql}
       WHERE 1=1 ${projectFilter.sql}
       GROUP BY s.id
       ORDER BY s.start_date`
    )
    .all(...bindParams, ...typeFilter.params, ...projectFilter.params) as VelocityEntry[]

  const target = getExpectedHours(projectName)
  const completedValues = rows.map((r) => r.completed)
  const average = completedValues.length > 0
    ? Math.round((completedValues.reduce((a, b) => a + b, 0) / completedValues.length) * 10) / 10
    : 0

  let bestSprint: { sprint: string; completed: number } | null = null
  if (rows.length > 0) {
    const best = rows.reduce((a, b) => (a.completed > b.completed ? a : b))
    bestSprint = { sprint: best.sprint, completed: best.completed }
  }

  let currentSprint: {
    title: string
    completed: number
    items: BurndownItem[]
  } | null = null

  if (rows.length > 0) {
    const latest = rows[rows.length - 1]
    const items = db
      .prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
           i.assignee, i.closed_at
         FROM items i
         WHERE i.sprint_id = (SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql})
           AND i.status = ? ${typeFilter.sql}
         ORDER BY i.closed_at`
      )
      .all(latest.sprint, ...projectFilter.params, doneStatus, ...typeFilter.params) as BurndownItem[]

    currentSprint = {
      title: latest.sprint,
      completed: latest.completed,
      items,
    }
  }

  return {
    velocity: rows,
    average,
    target,
    currentSprint,
    bestSprint,
    sprintCount: rows.length,
  }
}

export interface TeamMemberItem extends BurndownItem {}

export interface TeamMemberStat {
  assignee: string
  totalEffort: number
  totalActual: number
  closedCount: number
  share: number
  items: TeamMemberItem[]
}

export interface TeamSummary {
  activeMembers: number
  totalEffort: number
  totalActual: number
  closedCount: number
}

export interface TeamData {
  summary: TeamSummary
  members: TeamMemberStat[]
}

export interface OverviewStory {
  title: string
  number: number
  url: string
  type: string
  status: string
  effort: number | null
  actual_time: number | null
  assignee: string | null
  closed_at: string | null
}

export interface OverviewSummary {
  totalStories: number
  doneStories: number
  inProgress: number
  toDo: number
  effortDelivered: number
  effortTotal: number
  daysLeft: number
  daysTotal: number
  percentComplete: number
}

export interface OverviewData {
  summary: OverviewSummary
  stories: OverviewStory[]
}

export function buildOverview(sprintTitle: string | null, mode: 'points' | 'issues' = 'points', projectName?: string, startDate?: string, endDate?: string, issueType?: string): OverviewData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let startStr: string
  let duration: number
  let stories: OverviewStory[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT start_date, duration FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined

    if (!sprint) return null
    startStr = sprint.start_date
    duration = sprint.duration
    stories = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = (SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql}) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.type, i.title`
      )
      .all(sprintTitle, ...projectFilter.params, ...sprintProjectFilter.params, ...typeFilter.params) as OverviewStory[]
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    stories = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.type, i.title`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as OverviewStory[]
  } else {
    return null
  }

  const doneStories = stories.filter((s) => s.status === doneStatus)
  const inProgress = stories.filter((s) => s.status !== doneStatus && s.status !== 'To Do')
  const toDo = stories.filter((s) => s.status === 'To Do')

  const expectedHours = getExpectedHours(projectName)

  const effortDelivered = mode === 'points'
    ? doneStories.reduce((sum, s) => sum + (s.actual_time ?? 0), 0)
    : doneStories.length
  const effortTotal = mode === 'points' ? expectedHours : stories.length

  const startDateObj = new Date(startStr)
  const now = new Date()
  const dayIndex = Math.min(
    Math.max(Math.floor((now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)), 0),
    duration
  )

  return {
    summary: {
      totalStories: stories.length,
      doneStories: doneStories.length,
      inProgress: inProgress.length,
      toDo: toDo.length,
      effortDelivered: Math.round(effortDelivered * 10) / 10,
      effortTotal,
      daysLeft: duration - dayIndex,
      daysTotal: duration,
      percentComplete: effortTotal > 0
        ? Math.round((effortDelivered / effortTotal) * 100)
        : 0,
    },
    stories,
  }
}

export interface TimeAnalysisMember {
  assignee: string
  estimated: number
  actual: number
  variance: number
  count: number
  items: {
    title: string
    number: number
    url: string
    type: string
    status: string
    effort: number | null
    actual_time: number | null
    source: 'MAN' | 'AUTO' | null
  }[]
}

export interface TimeAnalysisIssue {
  title: string
  number: number
  url: string
  type: string
  status: string
  assignee: string | null
  effort: number | null
  actual_time: number | null
  variance: number | null
  source: 'MAN' | 'AUTO' | null
}

export interface TimeAnalysisSummary {
  totalEstimated: number
  totalActual: number
  variance: number
  issuesTracked: number
}

export interface TimeAnalysisData {
  summary: TimeAnalysisSummary
  members: TimeAnalysisMember[]
  issues: TimeAnalysisIssue[]
}

export function buildTimeAnalysis(sprintTitle: string | null, mode: 'points' | 'issues' = 'points', projectName?: string, startDate?: string, endDate?: string, issueType?: string): TimeAnalysisData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let items: {
    title: string
    number: number
    url: string
    type: string
    status: string
    effort: number | null
    actual_time: number | null
    assignee: string | null
    closed_at: string | null
  }[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number } | undefined

    if (!sprint) return null

    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
  } else if (startDate && endDate) {
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
  } else {
    return null
  }

  const issues: TimeAnalysisIssue[] = items.map((i) => {
    const source = i.actual_time != null ? 'MAN' as const : (i.status === doneStatus ? 'AUTO' as const : null)
    const est = mode === 'issues' ? 1 : i.effort
    const act = mode === 'issues' ? (i.status === doneStatus ? 1 : 0) : i.actual_time
    const variance = est != null && act != null
      ? Math.round((act - est) * 10) / 10
      : null
    return {
      title: i.title,
      number: i.number,
      url: i.url,
      type: i.type,
      status: i.status,
      assignee: i.assignee,
      effort: mode === 'issues' ? est : i.effort,
      actual_time: mode === 'issues' ? act : i.actual_time,
      variance,
      source,
    }
  })

  const totalEstimated = issues.reduce((s, i) => s + (i.effort ?? 0), 0)
  const totalActual = issues.reduce((s, i) => s + (i.actual_time ?? 0), 0)
  const variance = totalActual - totalEstimated

  const assigneeMap = new Map<string, TimeAnalysisMember>()
  for (const i of issues) {
    const name = i.assignee || 'Unassigned'
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, {
        assignee: name,
        estimated: 0,
        actual: 0,
        variance: 0,
        count: 0,
        items: [],
      })
    }
    const m = assigneeMap.get(name)!
    m.estimated += i.effort ?? 0
    m.actual += i.actual_time ?? 0
    m.count++
    m.items.push(i)
    m.variance = Math.round((m.actual - m.estimated) * 10) / 10
  }

  const members = Array.from(assigneeMap.values()).sort((a, b) => a.assignee.localeCompare(b.assignee))

  return {
    summary: {
      totalEstimated: Math.round(totalEstimated * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
      variance: Math.round(variance * 10) / 10,
      issuesTracked: items.length,
    },
    members,
    issues,
  }
}

export interface CycleTimeAssignee {
  assignee: string
  avgCycleTime: number
  count: number
  rating: 'Good' | 'Fair' | 'Poor'
  items: { title: string; number: number; url: string; cycleTime: number | null }[]
}

export interface CycleTimeData {
  summary: {
    currentAvg: number
    allSprintAvg: number
    kpiRating: 'Good' | 'Fair' | 'Poor'
    issuesMeasured: number
  }
  trend: { sprint: string; avgCycleTime: number }[]
  assignees: CycleTimeAssignee[]
}

function calcCycleTime(startDate: string, closedAt: string | null, duration: number): number | null {
  if (!closedAt) return null
  const start = new Date(startDate)
  const closed = new Date(closedAt)
  const days = (closed.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(days, duration))
}

function kpiRating(days: number): 'Good' | 'Fair' | 'Poor' {
  if (days <= 3) return 'Good'
  if (days <= 7) return 'Fair'
  return 'Poor'
}

export function buildCycleTime(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): CycleTimeData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let startStr: string
  let duration: number
  let items: { title: string; number: number; url: string; assignee: string | null; closed_at: string | null; calculated_cycle_time: number; sprint_start?: string; sprint_duration?: number }[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id, start_date, duration FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined

    if (!sprint) return null
    startStr = sprint.start_date
    duration = sprint.duration

    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.assignee, i.closed_at, s.start_date as sprint_start, s.duration as sprint_duration,
            COALESCE((
              SELECT SUM(julianday(COALESCE(t.end_date, datetime('now'))) - julianday(t.start_date))
              FROM item_transitions t
              WHERE t.item_id = i.id AND t.status = ?
            ), (julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(i.created_at))) as calculated_cycle_time
          FROM items i
          JOIN sprints s ON i.sprint_id = s.id
          WHERE i.sprint_id = s.id AND s.title = ? AND i.status = ? ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(inProgressStatus, sprintTitle, doneStatus, ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.assignee, i.closed_at, s.start_date as sprint_start, s.duration as sprint_duration,
            COALESCE((
              SELECT SUM(julianday(COALESCE(t.end_date, datetime('now'))) - julianday(t.start_date))
              FROM item_transitions t
              WHERE t.item_id = i.id AND t.status = ?
            ), (julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(i.created_at))) as calculated_cycle_time
          FROM items i
          LEFT JOIN sprints s ON i.sprint_id = s.id
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) AND i.status = ? ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(inProgressStatus, endDate + ' 23:59:59', startDate + ' 00:00:00', doneStatus, ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
  } else {
    return null
  }

  const cycleTimes = items.map((i) => {
    let ct = i.calculated_cycle_time
    if (ct <= 0) ct = 0.1
    const cap = i.sprint_duration || duration
    return {
      ...i,
      cycleTime: Math.round(Math.min(ct, cap) * 10) / 10,
    }
  })

  const currentAvg = cycleTimes.length > 0
    ? Math.round((cycleTimes.reduce((s, i) => s + i.cycleTime!, 0) / cycleTimes.length) * 10) / 10
    : 0

  const assigneeMap = new Map<string, { count: number; total: number; items: { title: string; number: number; url: string; cycleTime: number }[] }>()
  for (const i of cycleTimes) {
    const name = i.assignee || 'Unassigned'
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { count: 0, total: 0, items: [] })
    }
    const m = assigneeMap.get(name)!
    m.count++
    m.total += i.cycleTime!
    m.items.push({ title: i.title, number: i.number, url: i.url, cycleTime: i.cycleTime! })
  }

  const assignees: CycleTimeAssignee[] = []
  for (const [name, m] of assigneeMap) {
    const avg = Math.round((m.total / m.count) * 10) / 10
    assignees.push({
      assignee: name,
      avgCycleTime: avg,
      count: m.count,
      rating: kpiRating(avg),
      items: m.items,
    })
  }
  assignees.sort((a, b) => a.assignee.localeCompare(b.assignee))

  const allSprints = db
    .prepare(`SELECT id, title, start_date, duration FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string; start_date: string; duration: number }[]

  const trend: { sprint: string; avgCycleTime: number }[] = []
  let totalAllAvg = 0
  let sprintCount = 0
  for (const s of allSprints) {
    const sprintItems = db
      .prepare(`
        SELECT
          COALESCE((
            SELECT SUM(julianday(COALESCE(t.end_date, datetime('now'))) - julianday(t.start_date))
            FROM item_transitions t
            WHERE t.item_id = i.id AND t.status = ?
          ), (julianday(COALESCE(i.closed_at, datetime('now'))) - julianday(i.created_at))) as calculated_cycle_time
        FROM items i
        WHERE i.sprint_id = ? AND i.status = ?` + typeFilter.sql
      )
      .all(inProgressStatus, s.id, doneStatus, ...typeFilter.params) as { calculated_cycle_time: number }[]

    const times = sprintItems
      .map((i) => {
        let ct = i.calculated_cycle_time
        if (ct <= 0) ct = 0.1
        return Math.min(ct, s.duration)
      })

    if (times.length > 0) {
      const avg = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
      trend.push({ sprint: s.title, avgCycleTime: avg })
      totalAllAvg += avg
      sprintCount++
    }
  }

  const allSprintAvg = sprintCount > 0 ? Math.round((totalAllAvg / sprintCount) * 10) / 10 : 0

  return {
    summary: {
      currentAvg,
      allSprintAvg,
      kpiRating: kpiRating(currentAvg),
      issuesMeasured: cycleTimes.length,
    },
    trend,
    assignees,
  }
}

export interface CommitmentSprint {
  sprint: string
  committed: number
  delivered: number
  rate: number
  rating: 'Good' | 'Fair' | 'Poor'
}

export interface CommitmentData {
  summary: {
    effortRate: number
    issueRate: number
    kpiRating: 'Good' | 'Fair' | 'Poor'
    deliveryVsTarget: number
  }
  sprints: CommitmentSprint[]
}

function rateToRating(rate: number): 'Good' | 'Fair' | 'Poor' {
  if (rate >= 85) return 'Good'
  if (rate >= 70) return 'Fair'
  return 'Poor'
}

export function buildCommitment(mode: 'points' | 'issues' = 'points', projectName?: string, issueType?: string): CommitmentData {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  const sprints = db
    .prepare(`SELECT id, title FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string }[]

  const expectedHours = getExpectedHours(projectName)

  const sprintRows: CommitmentSprint[] = []
  for (const s of sprints) {
    const items = db
      .prepare('SELECT effort, actual_time, status FROM items i WHERE i.sprint_id = ?' + typeFilter.sql)
      .all(s.id, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]

    const committed = mode === 'points'
      ? items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
      : items.length

    const deliveredItems = items.filter((i) => i.status === doneStatus)
    const delivered = mode === 'points'
      ? deliveredItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
      : deliveredItems.length

    const rate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    sprintRows.push({
      sprint: s.title,
      committed: Math.round(committed * 10) / 10,
      delivered: Math.round(delivered * 10) / 10,
      rate,
      rating: rateToRating(rate),
    })
  }

  const currentSprint = sprintRows[sprintRows.length - 1]
  const currentRate = currentSprint ? currentSprint.rate : 0
  const currentDelivered = currentSprint ? currentSprint.delivered : 0
  const deliveryVsTarget = expectedHours > 0 ? Math.round((currentDelivered / expectedHours) * 100) : 0

  return {
    summary: {
      effortRate: currentRate,
      issueRate: currentRate,
      kpiRating: rateToRating(currentRate),
      deliveryVsTarget,
    },
    sprints: sprintRows,
  }
}

export interface CommitAssigneeItem {
  title: string
  number: number
  url: string
  type: string
  status: string
  effort: number | null
  actual_time: number | null
  assignee: string | null
}

export interface CommitAssigneeStat {
  assignee: string
  estimated: number
  actual: number
  rate: number
  count: number
  rating: 'Good' | 'Fair' | 'Poor'
  items: CommitAssigneeItem[]
}

export interface CommitAssigneeData {
  summary: {
    totalEstimated: number
    totalActual: number
    overallRate: number
    kpiRating: 'Good' | 'Fair' | 'Poor'
    assigneesCount: number
  }
  assignees: CommitAssigneeStat[]
}

export function buildCommitmentByAssignee(
  sprintTitle: string | null,
  mode: 'points' | 'issues' = 'points',
  projectName?: string,
  startDate?: string,
  endDate?: string,
  issueType?: string
): CommitAssigneeData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let items: CommitAssigneeItem[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number } | undefined
    if (!sprint) return null

    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = ? AND i.assignee IS NOT NULL ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as any[]
  } else if (startDate && endDate) {
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) AND i.assignee IS NOT NULL ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as any[]
  } else {
    return null
  }

  const assigneeMap = new Map<string, { estimated: number; actual: number; count: number; items: CommitAssigneeItem[] }>()

  for (const i of items) {
    const name = i.assignee!
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { estimated: 0, actual: 0, count: 0, items: [] })
    }
    const m = assigneeMap.get(name)!
    
    const resolvedActualTime = i.actual_time ?? 0

    m.estimated += mode === 'points' ? (i.effort ?? 0) : 1
    m.actual += (i.status === doneStatus) ? (mode === 'points' ? (resolvedActualTime ?? 0) : 1) : 0
    m.count++
    
    m.items.push({
      ...i,
      actual_time: resolvedActualTime
    })
  }

  let totalEstimated = 0
  let totalActual = 0

  const assignees: CommitAssigneeStat[] = Array.from(assigneeMap.entries())
    .map(([name, m]) => {
      totalEstimated += m.estimated
      totalActual += m.actual
      const rate = m.estimated > 0 ? Math.round((m.actual / m.estimated) * 100) : 0
      return {
        assignee: name,
        estimated: Math.round(m.estimated * 10) / 10,
        actual: Math.round(m.actual * 10) / 10,
        rate,
        count: m.count,
        rating: rateToRating(rate),
        items: m.items,
      }
    })
    .sort((a, b) => a.assignee.localeCompare(b.assignee))

  const overallRate = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0

  return {
    summary: {
      totalEstimated: Math.round(totalEstimated * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
      overallRate,
      kpiRating: rateToRating(overallRate),
      assigneesCount: assignees.length,
    },
    assignees,
  }
}

export interface DefectTrendEntry {
  sprint: string
  defectCount: number
  totalCount: number
  defectRate: number
}

export interface DefectAssigneeStat {
  assignee: string
  defectCount: number
  totalItems: number
  defectRate: number
  effortOnDefects: number
}

export interface DefectData {
  summary: {
    defectCount: number
    totalItems: number
    defectRate: number
    closedDefects: number
    openDefects: number
    kpiRating: 'Good' | 'Fair' | 'Poor'
  }
  trend: DefectTrendEntry[]
  assignees: DefectAssigneeStat[]
  items: BurndownItem[]
}

function defectsRating(rate: number): 'Good' | 'Fair' | 'Poor' {
  if (rate <= 15) return 'Good'
  if (rate <= 30) return 'Fair'
  return 'Poor'
}

export function buildDefects(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): DefectData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let items: BurndownItem[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number } | undefined
    if (!sprint) return null

    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort, i.actual_time, i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.title`
      )
      .all(sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else if (startDate && endDate) {
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort, i.actual_time, i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.title`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else {
    return null
  }

  const bugItems = items.filter((i) => i.type === 'bug')
  const closedBugs = bugItems.filter((i) => i.status === doneStatus)
  const openBugs = bugItems.filter((i) => i.status !== doneStatus)

  const defectCount = bugItems.length
  const totalItems = items.length
  const defectRate = totalItems > 0 ? Math.round((defectCount / totalItems) * 100) : 0

  const assigneeMap = new Map<string, { defectCount: number; totalItems: number; effortOnDefects: number }>()
  for (const i of items) {
    const name = i.assignee ?? 'Unassigned'
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { defectCount: 0, totalItems: 0, effortOnDefects: 0 })
    }
    const m = assigneeMap.get(name)!
    m.totalItems++
    if (i.type === 'bug') {
      m.defectCount++
      m.effortOnDefects += i.effort ?? 0
    }
  }

  const assignees: DefectAssigneeStat[] = Array.from(assigneeMap.entries())
    .map(([name, m]) => ({
      assignee: name,
      defectCount: m.defectCount,
      totalItems: m.totalItems,
      defectRate: m.totalItems > 0 ? Math.round((m.defectCount / m.totalItems) * 100) : 0,
      effortOnDefects: Math.round(m.effortOnDefects * 10) / 10,
    }))
    .sort((a, b) => a.assignee.localeCompare(b.assignee))

  const allSprints = db
    .prepare(`SELECT id, title FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string }[]

  const trend: DefectTrendEntry[] = allSprints.map((s) => {
    const sprintItems = db
      .prepare('SELECT type FROM items i WHERE i.sprint_id = ?' + typeFilter.sql)
      .all(s.id, ...typeFilter.params) as { type: string }[]
    const total = sprintItems.length
    const bugs = sprintItems.filter((i) => i.type === 'bug').length
    return {
      sprint: s.title,
      defectCount: bugs,
      totalCount: total,
      defectRate: total > 0 ? Math.round((bugs / total) * 100) : 0,
    }
  })

  return {
    summary: {
      defectCount,
      totalItems,
      defectRate,
      closedDefects: closedBugs.length,
      openDefects: openBugs.length,
      kpiRating: defectsRating(defectRate),
    },
    trend,
    assignees,
    items: bugItems,
  }
}

export interface ScorecardKpi {
  label: string
  value: string
  rating: 'Good' | 'Fair' | 'Poor'
  detail: string
}

export interface ScorecardData {
  sprint: string
  summary: {
    overallRating: 'Good' | 'Fair' | 'Poor'
    deliveryRate: number
    deliveryKpi: 'Good' | 'Fair' | 'Poor'
    cycleTime: number
    cycleKpi: 'Good' | 'Fair' | 'Poor'
    defectRate: number
    defectKpi: 'Good' | 'Fair' | 'Poor'
    velocityCompleted: number
    velocityAverage: number
    velocityDiff: number
    estimationVariance: number
    estimationVariancePct: number
    estimationKpi: 'Good' | 'Fair' | 'Poor'
    burndownPct: number
    issuesCompleted: number
    issuesTotal: number
    daysLeft: number
    activeMembers: number
    issuesAtRisk: number
  }
  kpis: ScorecardKpi[]
}

function estimationRating(varPct: number): 'Good' | 'Fair' | 'Poor' {
  const abs = Math.abs(varPct)
  if (abs <= 10) return 'Good'
  if (abs <= 25) return 'Fair'
  return 'Poor'
}

export function buildScorecard(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): ScorecardData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let startStr: string
  let duration: number

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id, start_date, duration FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined
    if (!sprint) return null
    startStr = sprint.start_date
    duration = sprint.duration
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  } else {
    return null
  }

  const commitment = buildCommitment('points', projectName, issueType)
  const currentSprintCommit = sprintTitle ? commitment.sprints.find((s) => s.sprint === sprintTitle) : null
  
  let deliveryRate = 0
  let committedHours = 0
  let deliveredHours = 0
  if (sprintTitle) {
    deliveryRate = currentSprintCommit?.rate ?? 0
    committedHours = currentSprintCommit?.committed ?? 0
    deliveredHours = currentSprintCommit?.delivered ?? 0
  } else {
    const items = db
      .prepare(
        `SELECT effort, actual_time, status FROM items i
         WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${getSprintProjectFilter(projectName).sql} ${typeFilter.sql}`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...getSprintProjectFilter(projectName).params, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]
    committedHours = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    deliveredHours = items.filter((i) => i.status === doneStatus).reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    deliveryRate = committedHours > 0 ? Math.round((deliveredHours / committedHours) * 100) : 0
  }
  const deliveryKpi = rateToRating(deliveryRate)

  const cycleData = buildCycleTime(sprintTitle, projectName, startDate, endDate, issueType)
  const cycleTime = cycleData?.summary.currentAvg ?? 0
  const cycleKpi = cycleData?.summary.kpiRating ?? 'Good'

  const defectData = buildDefects(sprintTitle, projectName, startDate, endDate, issueType)
  const defectRate = defectData?.summary.defectRate ?? 0
  const defectKpi = defectData?.summary.kpiRating ?? 'Good'

  const velocity = buildVelocity('points', projectName, issueType)
  const velocityCompleted = sprintTitle ? (velocity.currentSprint?.completed ?? 0) : deliveredHours
  const velocityAverage = velocity.average
  const velocityDiff = Math.round((velocityCompleted - velocityAverage) * 10) / 10

  const timeData = buildTimeAnalysis(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const totalEst = timeData?.summary.totalEstimated ?? 1
  const totalAct = timeData?.summary.totalActual ?? 0
  const estimationVariance = Math.round((totalAct - totalEst) * 10) / 10
  const estimationVariancePct = totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0
  const estimationKpi = estimationRating(estimationVariancePct)

  const burndown = buildBurndown(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const burndownPct = burndown?.summary.percentComplete ?? 0
  const issuesTotal = burndown?.items.length ?? 0
  const issuesCompleted = burndown?.items.filter((i) => i.status === doneStatus).length ?? 0

  const startDateObj = new Date(startStr)
  const now = new Date()
  const dayIndex = Math.min(
    Math.max(Math.floor((now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)), 0),
    duration
  )
  const daysLeft = duration - dayIndex

  const team = buildTeamStats(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const activeMembers = team.summary.activeMembers

  const overview = buildOverview(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const issuesAtRisk = overview?.stories.filter((s) => s.status === 'In Progress' || s.status === 'To Do').length ?? 0

  const ratings = [deliveryKpi, cycleKpi, defectKpi, estimationKpi]
  const overallRating: 'Good' | 'Fair' | 'Poor' =
    ratings.some((r) => r === 'Poor') ? 'Poor' :
    ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

  const kpis: ScorecardKpi[] = [
    {
      label: 'Delivery Rate',
      value: `${deliveryRate}%`,
      rating: deliveryKpi,
      detail: `${currentSprintCommit?.delivered ?? 0}h / ${currentSprintCommit?.committed ?? 0}h delivered`,
    },
    {
      label: 'Cycle Time',
      value: `${cycleTime}d`,
      rating: cycleKpi,
      detail: `Average days to complete`,
    },
    {
      label: 'Defect Rate',
      value: `${defectRate}%`,
      rating: defectKpi,
      detail: `${defectData?.summary.defectCount ?? 0} bugs in ${defectData?.summary.totalItems ?? 0} items`,
    },
    {
      label: 'Estimation Accuracy',
      value: `${estimationVariancePct > 0 ? '+' : ''}${estimationVariancePct}%`,
      rating: estimationKpi,
      detail: `${Math.abs(estimationVariance)}h variance (est ${totalEst}h / act ${totalAct}h)`,
    },
    {
      label: 'Velocity',
      value: `${velocityCompleted}h`,
      rating: velocityDiff >= 0 ? 'Good' : 'Fair',
      detail: `Avg ${velocityAverage}h — ${velocityDiff >= 0 ? '+' : ''}${velocityDiff}h vs average`,
    },
  ]

  return {
    sprint: sprintTitle || 'Custom Range',
    summary: {
      overallRating,
      deliveryRate,
      deliveryKpi,
      cycleTime,
      cycleKpi,
      defectRate,
      defectKpi,
      velocityCompleted,
      velocityAverage,
      velocityDiff,
      estimationVariance,
      estimationVariancePct,
      estimationKpi,
      burndownPct,
      issuesCompleted,
      issuesTotal,
      daysLeft,
      activeMembers,
      issuesAtRisk,
    },
    kpis,
  }
}

export interface StabilitySprintMetric {
  sprint: string
  estimationAccuracy: number
  scopeCompletionRate: number
  deliveryRate: number
  velocity: number
}

export interface StabilityData {
  sprint: string
  summary: {
    estimationAccuracy: number
    estimationKpi: 'Good' | 'Fair' | 'Poor'
    scopeCompletionRate: number
    scopeChurn: number
    deliveryConsistency: number
    deliveryConsistencyKpi: 'Good' | 'Fair' | 'Poor'
    velocityCv: number
    velocityCvKpi: 'Good' | 'Fair' | 'Poor'
    overallRating: 'Good' | 'Fair' | 'Poor'
  }
  sprintMetrics: StabilitySprintMetric[]
  trendLabels: string[]
  estimationTrend: number[]
  completionTrend: number[]
}

function consistencyCvKpi(cv: number): 'Good' | 'Fair' | 'Poor' {
  if (cv <= 15) return 'Good'
  if (cv <= 30) return 'Fair'
  return 'Poor'
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  return Math.round(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export function buildStability(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): StabilityData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  const allSprints = db
    .prepare(`SELECT id, title FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string }[]

  const sprintMetrics: StabilitySprintMetric[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status FROM items i WHERE i.sprint_id = ?' + typeFilter.sql)
      .all(s.id, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]

    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    const doneItems = items.filter((i) => i.status === doneStatus)
    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100

    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    return {
      sprint: s.title,
      estimationAccuracy,
      scopeCompletionRate,
      deliveryRate,
      velocity: Math.round(delivered * 10) / 10,
    }
  })

  let current: StabilitySprintMetric | undefined
  if (sprintTitle) {
    current = sprintMetrics.find((s) => s.sprint === sprintTitle)
  } else if (startDate && endDate) {
    const items = db
      .prepare(
        `SELECT effort, actual_time, status FROM items i
         WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${getSprintProjectFilter(projectName).sql} ${typeFilter.sql}`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...getSprintProjectFilter(projectName).params, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]
    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100
    const doneItems = items.filter((i) => i.status === doneStatus)
    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100
    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    current = {
      sprint: 'Custom Range',
      estimationAccuracy,
      scopeCompletionRate,
      deliveryRate,
      velocity: Math.round(delivered * 10) / 10,
    }
    sprintMetrics.push(current)
  }
  if (!current) return null

  const rates = sprintMetrics.map((s) => s.deliveryRate)
  const velocities = sprintMetrics.map((s) => s.velocity)
  const meanVel = velocities.reduce((a, b) => a + b, 0) / velocities.length

  const deliveryConsistency = stdDev(rates)
  const velocityCv = meanVel > 0 ? Math.round((stdDev(velocities) / meanVel) * 100) : 0

  const scopeChurn = 100 - current.scopeCompletionRate

  const ratings = [current.estimationAccuracy >= 90 ? 'Good' as const : current.estimationAccuracy >= 75 ? 'Fair' as const : 'Poor' as const,
    consistencyCvKpi(deliveryConsistency),
    consistencyCvKpi(velocityCv)]
  const overallRating: 'Good' | 'Fair' | 'Poor' =
    ratings.some((r) => r === 'Poor') ? 'Poor' :
    ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

  return {
    sprint: sprintTitle || 'Custom Range',
    summary: {
      estimationAccuracy: current.estimationAccuracy,
      estimationKpi: current.estimationAccuracy >= 90 ? 'Good' : current.estimationAccuracy >= 75 ? 'Fair' : 'Poor',
      scopeCompletionRate: current.scopeCompletionRate,
      scopeChurn,
      deliveryConsistency,
      deliveryConsistencyKpi: consistencyCvKpi(deliveryConsistency),
      velocityCv,
      velocityCvKpi: consistencyCvKpi(velocityCv),
      overallRating,
    },
    sprintMetrics,
    trendLabels: sprintMetrics.map((s) => s.sprint),
    estimationTrend: sprintMetrics.map((s) => s.estimationAccuracy),
    completionTrend: sprintMetrics.map((s) => s.scopeCompletionRate),
  }
}

export function buildTeamStats(
  sprintTitle?: string | null,
  mode: 'points' | 'issues' = 'points',
  projectName?: string,
  startDate?: string,
  endDate?: string,
  issueType?: string
): TeamData {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)

  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let sprintFilter = ''
  let sprintParams = projectFilter.params

  if (sprintTitle) {
    sprintFilter = `AND i.sprint_id = (SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql})`
    sprintParams = [sprintTitle, ...projectFilter.params]
  } else if (startDate && endDate) {
    sprintFilter = `AND i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?)`
    sprintParams = [endDate + ' 23:59:59', startDate + ' 00:00:00']
  } else if (projectFilter.sql) {
    sprintFilter = `AND i.project_id = ?`
  }

  const rawMembers = db
    .prepare(
      `SELECT
         i.assignee,
         COALESCE(SUM(i.effort), 0) AS totalEffort,
         COALESCE(SUM(
           ${getActualTimeSql(doneStatus, inProgressStatus)}
         ), 0) AS totalActual,
         COUNT(CASE WHEN i.status = ? THEN 1 END) AS closedCount
       FROM items i
       LEFT JOIN sprints s ON i.sprint_id = s.id
       WHERE i.assignee IS NOT NULL ${sprintFilter} ${sprintProjectFilter.sql} ${typeFilter.sql}
       GROUP BY i.assignee
       ORDER BY i.assignee`
    )
    .all(doneStatus, ...sprintParams, ...sprintProjectFilter.params, ...typeFilter.params) as { assignee: string; totalEffort: number; totalActual: number; closedCount: number }[]

  const memberStatements = sprintTitle
    ? db.prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
           i.assignee, i.closed_at
         FROM items i
         JOIN sprints s ON i.sprint_id = s.id
         WHERE i.assignee = ? AND i.assignee IS NOT NULL
           AND s.title = ? ${projectFilter.sql} ${sprintProjectFilter.sql} ${typeFilter.sql}
         ORDER BY i.status, i.title`
      )
    : (startDate && endDate)
    ? db.prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time,
           i.assignee, i.closed_at
         FROM items i
         WHERE i.assignee = ? AND i.assignee IS NOT NULL
           AND i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
         ORDER BY i.status, i.title`
      )
    : null

  const membersWithItems: TeamMemberStat[] = rawMembers.map((m) => {
    let items: TeamMemberItem[] = []
    if (memberStatements) {
      if (sprintTitle) {
        items = memberStatements.all(m.assignee, sprintTitle, ...projectFilter.params, ...sprintProjectFilter.params, ...typeFilter.params) as TeamMemberItem[]
      } else if (startDate && endDate) {
        items = memberStatements.all(m.assignee, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as TeamMemberItem[]
      }
    }
    const eff = mode === 'issues' ? items.length : m.totalEffort
    const act = mode === 'issues' ? items.filter((i) => i.status === doneStatus).length : m.totalActual
    return {
      assignee: m.assignee,
      totalEffort: eff,
      totalActual: act,
      closedCount: m.closedCount,
      share: 0,
      items,
    }
  })

  const totalEffortAll = membersWithItems.reduce((s, m) => s + m.totalEffort, 0) || 1
  membersWithItems.forEach((m) => { m.share = Math.round((m.totalEffort / totalEffortAll) * 100) })

  return {
    summary: {
      activeMembers: membersWithItems.length,
      totalEffort: membersWithItems.reduce((s, m) => s + m.totalEffort, 0),
      totalActual: membersWithItems.reduce((s, m) => s + m.totalActual, 0),
      closedCount: membersWithItems.reduce((s, m) => s + m.closedCount, 0),
    },
    members: membersWithItems,
  }
}

export interface KpiReviewEntry {
  sprint: string
  deliveryRate: number
  deliveryKpi: 'Good' | 'Fair' | 'Poor'
  cycleTime: number
  cycleKpi: 'Good' | 'Fair' | 'Poor'
  defectRate: number
  defectKpi: 'Good' | 'Fair' | 'Poor'
  estimationAccuracy: number
  estimationKpi: 'Good' | 'Fair' | 'Poor'
  velocity: number
  scopeCompletionRate: number
  overallKpi: 'Good' | 'Fair' | 'Poor'
}

export interface KpiReviewData {
  sprints: KpiReviewEntry[]
  averages: {
    deliveryRate: number
    cycleTime: number
    defectRate: number
    estimationAccuracy: number
    velocity: number
    scopeCompletionRate: number
  }
}

export function buildKpiReview(projectName?: string): KpiReviewData {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)

  const allSprints = db
    .prepare(`SELECT id, title, start_date, duration FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string; start_date: string; duration: number }[]

  const sprints: KpiReviewEntry[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status, type, closed_at FROM items WHERE sprint_id = ?')
      .all(s.id) as { effort: number | null; actual_time: number | null; status: string; type: string; closed_at: string | null }[]

    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const doneItems = items.filter((i) => i.status === doneStatus)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    const cycleTimes = doneItems
      .map((i) => calcCycleTime(s.start_date, i.closed_at, s.duration))
      .filter((t): t is number => t != null)
    const cycleTime = cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
      : 0

    const bugs = items.filter((i) => i.type === 'bug').length
    const defectRate = items.length > 0 ? Math.round((bugs / items.length) * 100) : 0

    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    const velocity = Math.round(delivered * 10) / 10

    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100

    const ratings = [rateToRating(deliveryRate), kpiRating(cycleTime), defectsRating(defectRate), estimationRating(totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0)]
    const overallKpi: 'Good' | 'Fair' | 'Poor' =
      ratings.some((r) => r === 'Poor') ? 'Poor' :
      ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

    return {
      sprint: s.title,
      deliveryRate,
      deliveryKpi: rateToRating(deliveryRate),
      cycleTime,
      cycleKpi: kpiRating(cycleTime),
      defectRate,
      defectKpi: defectsRating(defectRate),
      estimationAccuracy,
      estimationKpi: estimationRating(totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0),
      velocity,
      scopeCompletionRate,
      overallKpi,
    }
  })

  const avgDeliveryRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.deliveryRate, 0) / sprints.length) : 0
  const avgCycleTime = sprints.length > 0 ? Math.round((sprints.reduce((s, e) => s + e.cycleTime, 0) / sprints.length) * 10) / 10 : 0
  const avgDefectRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.defectRate, 0) / sprints.length) : 0
  const avgEstimationAccuracy = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.estimationAccuracy, 0) / sprints.length) : 0
  const avgVelocity = sprints.length > 0 ? Math.round((sprints.reduce((s, e) => s + e.velocity, 0) / sprints.length) * 10) / 10 : 0
  const avgScopeCompletionRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.scopeCompletionRate, 0) / sprints.length) : 0

  return {
    sprints,
    averages: {
      deliveryRate: avgDeliveryRate,
      cycleTime: avgCycleTime,
      defectRate: avgDefectRate,
      estimationAccuracy: avgEstimationAccuracy,
      velocity: avgVelocity,
      scopeCompletionRate: avgScopeCompletionRate,
    },
  }
}

export interface TimesheetTask {
  title: string
  number: number
  url: string
  type: string
  status: string
  state: string
  effort: number | null
  actual_time: number | null
}

export interface TimesheetAssignee {
  assignee: string
  totalActual: number
  taskCount: number
  tasks: TimesheetTask[]
}

export interface TimesheetData {
  summary: {
    totalActual: number
    assigneesCount: number
    tasksCount: number
  }
  assignees: TimesheetAssignee[]
}

export function buildTimesheet(
  sprintTitle: string | null,
  projectName?: string,
  startDate?: string,
  endDate?: string,
  issueType?: string
): TimesheetData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)

  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let sprintFilter = ''
  let sprintParams = projectFilter.params

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT * FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined

    if (!sprint) return null
    sprintFilter = 'AND i.sprint_id = ?'
    sprintParams = [sprint.id]
  } else if (startDate && endDate) {
    sprintFilter = 'AND i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?)'
    sprintParams = [endDate + ' 23:59:59', startDate + ' 00:00:00']
  } else {
    return null
  }

  const rows = db
    .prepare(
      `SELECT
         i.assignee,
         i.title,
         i.number,
         i.url,
         i.type,
         i.status,
         i.state,
         i.effort,
         ${getActualTimeSql(doneStatus, inProgressStatus)} as actual_time
       FROM items i
       WHERE i.assignee IS NOT NULL AND i.assignee != ''
         ${sprintFilter}
         ${sprintProjectFilter.sql}
         ${typeFilter.sql}
       ORDER BY i.assignee, i.number`
    )
    .all(...sprintParams, ...sprintProjectFilter.params, ...typeFilter.params) as {
      assignee: string
      title: string
      number: number
      url: string
      type: string
      status: string
      state: string
      effort: number | null
      actual_time: number | null
    }[]

  const assigneesMap = new Map<string, TimesheetTask[]>()
  for (const row of rows) {
    if (!assigneesMap.has(row.assignee)) {
      assigneesMap.set(row.assignee, [])
    }
    assigneesMap.get(row.assignee)!.push({
      title: row.title,
      number: row.number,
      url: row.url,
      type: row.type,
      status: row.status,
      state: row.state,
      effort: row.effort,
      actual_time: row.actual_time
    })
  }

  const assignees: TimesheetAssignee[] = []
  let totalActualSum = 0
  let tasksCountSum = 0

  for (const [assigneeName, tasks] of assigneesMap.entries()) {
    const totalActual = tasks.reduce((sum, t) => sum + (t.actual_time ?? 0), 0)
    totalActualSum += totalActual
    tasksCountSum += tasks.length

    assignees.push({
      assignee: assigneeName,
      totalActual: Math.round(totalActual * 10) / 10,
      taskCount: tasks.length,
      tasks
    })
  }

  assignees.sort((a, b) => a.assignee.localeCompare(b.assignee))

  return {
    summary: {
      totalActual: Math.round(totalActualSum * 10) / 10,
      assigneesCount: assignees.length,
      tasksCount: tasksCountSum
    },
    assignees
  }
}

