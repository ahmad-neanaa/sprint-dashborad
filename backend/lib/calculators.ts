import { getDb } from './db'

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

export function buildBurndown(sprintTitle: string, mode: 'points' | 'issues' = 'points'): BurndownData | null {
  const db = getDb()
  const sprint = db
    .prepare('SELECT * FROM sprints WHERE title = ?')
    .get(sprintTitle) as { start_date: string; duration: number } | undefined

  if (!sprint) return null

  const items = db
    .prepare(
      `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
       FROM items
       WHERE sprint_id = (SELECT id FROM sprints WHERE title = ?)`
    )
    .all(sprintTitle) as BurndownItem[]

  const config = db
    .prepare("SELECT value FROM config WHERE key = 'expected_hours'")
    .get() as { value: string } | undefined

  const expectedHours = config ? parseFloat(config.value) : 0
  const startDate = new Date(sprint.start_date)
  const totalDays = sprint.duration

  const now = new Date()
  const dayIndex = Math.min(
    Math.max(
      Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      0
    ),
    totalDays
  )
  const daysLeft = totalDays - dayIndex

  const total = mode === 'points' ? expectedHours : items.length
  const closedItems = items.filter((i) => i.status === 'Done')
  const completed = mode === 'points'
    ? closedItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    : closedItems.length
  const remaining = total - completed
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0

  const points: BurndownPoint[] = []
  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDate)
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

export function buildVelocity(mode: 'points' | 'issues' = 'points'): VelocityData {
  const db = getDb()

  const sumExpr = mode === 'points'
    ? "COALESCE(SUM(i.actual_time), 0)"
    : "COUNT(CASE WHEN i.status = 'Done' THEN 1 END)"

  const rows = db
    .prepare(
      `SELECT s.title AS sprint, ${sumExpr} AS completed
       FROM sprints s
       LEFT JOIN items i ON i.sprint_id = s.id
       GROUP BY s.id
       ORDER BY s.start_date`
    )
    .all() as VelocityEntry[]

  const config = db
    .prepare("SELECT value FROM config WHERE key = 'expected_hours'")
    .get() as { value: string } | undefined

  const target = config ? parseFloat(config.value) : 0
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
        `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
         FROM items
         WHERE sprint_id = (SELECT id FROM sprints WHERE title = ?)
           AND status = 'Done'
         ORDER BY closed_at`
      )
      .all(latest.sprint) as BurndownItem[]

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

export function buildOverview(sprintTitle: string): OverviewData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT start_date, duration FROM sprints WHERE title = ?')
    .get(sprintTitle) as { start_date: string; duration: number } | undefined

  if (!sprint) return null

  const stories = db
    .prepare(
      `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
       FROM items
       WHERE sprint_id = (SELECT id FROM sprints WHERE title = ?)
       ORDER BY status, type, title`
    )
    .all(sprintTitle) as OverviewStory[]

  const doneStories = stories.filter((s) => s.status === 'Done')
  const inProgress = stories.filter((s) => s.status !== 'Done' && s.status !== 'To Do')
  const toDo = stories.filter((s) => s.status === 'To Do')

  const effortDelivered = doneStories.reduce((sum, s) => sum + (s.actual_time ?? 0), 0)

  const config = db
    .prepare("SELECT value FROM config WHERE key = 'expected_hours'")
    .get() as { value: string } | undefined

  const expectedHours = config ? parseFloat(config.value) : 0

  const startDate = new Date(sprint.start_date)
  const now = new Date()
  const dayIndex = Math.min(
    Math.max(Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)), 0),
    sprint.duration
  )

  return {
    summary: {
      totalStories: stories.length,
      doneStories: doneStories.length,
      inProgress: inProgress.length,
      toDo: toDo.length,
      effortDelivered,
      effortTotal: expectedHours,
      daysLeft: sprint.duration - dayIndex,
      daysTotal: sprint.duration,
      percentComplete: expectedHours > 0
        ? Math.round((effortDelivered / expectedHours) * 100)
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

export function buildTimeAnalysis(sprintTitle: string): TimeAnalysisData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT id FROM sprints WHERE title = ?')
    .get(sprintTitle) as { id: number } | undefined

  if (!sprint) return null

  const items = db
    .prepare(
      `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
       FROM items
       WHERE sprint_id = ?
       ORDER BY assignee, title`
    )
    .all(sprint.id) as {
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

  const issues: TimeAnalysisIssue[] = items.map((i) => {
    const source = i.actual_time != null ? 'MAN' as const : (i.status === 'Done' ? 'AUTO' as const : null)
    const variance = i.effort != null && i.actual_time != null
      ? Math.round((i.actual_time - i.effort) * 10) / 10
      : null
    return {
      title: i.title,
      number: i.number,
      url: i.url,
      type: i.type,
      status: i.status,
      assignee: i.assignee,
      effort: i.effort,
      actual_time: i.actual_time,
      variance,
      source,
    }
  })

  const totalEstimated = items.reduce((s, i) => s + (i.effort ?? 0), 0)
  const totalActual = items.reduce((s, i) => s + (i.actual_time ?? 0), 0)
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

export function buildCycleTime(sprintTitle: string): CycleTimeData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT start_date, duration FROM sprints WHERE title = ?')
    .get(sprintTitle) as { start_date: string; duration: number } | undefined

  if (!sprint) return null

  const items = db
    .prepare(
      `SELECT title, number, url, assignee, closed_at
       FROM items
       WHERE sprint_id = (SELECT id FROM sprints WHERE title = ?) AND status = 'Done'`
    )
    .all(sprintTitle) as { title: string; number: number; url: string; assignee: string | null; closed_at: string | null }[]

  const cycleTimes = items.map((i) => ({
    ...i,
    cycleTime: calcCycleTime(sprint.start_date, i.closed_at, sprint.duration),
  })).filter((i) => i.cycleTime != null)

  const currentAvg = cycleTimes.length > 0
    ? Math.round((cycleTimes.reduce((s, i) => s + i.cycleTime!, 0) / cycleTimes.length) * 10) / 10
    : 0

  // Per-assignee aggregation
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

  // All-sprint trend
  const allSprints = db
    .prepare('SELECT id, title, start_date, duration FROM sprints ORDER BY start_date')
    .all() as { id: number; title: string; start_date: string; duration: number }[]

  const trend: { sprint: string; avgCycleTime: number }[] = []
  let totalAllAvg = 0
  let sprintCount = 0
  for (const s of allSprints) {
    const sprintItems = db
      .prepare("SELECT closed_at FROM items WHERE sprint_id = ? AND status = 'Done'")
      .all(s.id) as { closed_at: string | null }[]

    const times = sprintItems
      .map((i) => calcCycleTime(s.start_date, i.closed_at, s.duration))
      .filter((t): t is number => t != null)

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

export function buildCommitment(mode: 'points' | 'issues' = 'points'): CommitmentData {
  const db = getDb()

  const sprints = db
    .prepare('SELECT id, title FROM sprints ORDER BY start_date')
    .all() as { id: number; title: string }[]

  const config = db
    .prepare("SELECT value FROM config WHERE key = 'expected_hours'")
    .get() as { value: string } | undefined
  const expectedHours = config ? parseFloat(config.value) : 0

  const sprintRows: CommitmentSprint[] = []
  for (const s of sprints) {
    const items = db
      .prepare('SELECT effort, actual_time, status FROM items WHERE sprint_id = ?')
      .all(s.id) as { effort: number | null; actual_time: number | null; status: string }[]

    const committed = mode === 'points'
      ? items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
      : items.length

    const deliveredItems = items.filter((i) => i.status === 'Done')
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
  sprintTitle: string,
  mode: 'points' | 'issues' = 'points'
): CommitAssigneeData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT id FROM sprints WHERE title = ?')
    .get(sprintTitle) as { id: number } | undefined
  if (!sprint) return null

  const items = db
    .prepare(
      `SELECT title, number, url, type, status, effort, actual_time, assignee
       FROM items
       WHERE sprint_id = ? AND assignee IS NOT NULL
       ORDER BY assignee, title`
    )
    .all(sprint.id) as CommitAssigneeItem[]

  const assigneeMap = new Map<string, { estimated: number; actual: number; count: number; items: CommitAssigneeItem[] }>()

  for (const i of items) {
    const name = i.assignee!
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { estimated: 0, actual: 0, count: 0, items: [] })
    }
    const m = assigneeMap.get(name)!
    m.estimated += mode === 'points' ? (i.effort ?? 0) : 1
    m.actual += (i.status === 'Done') ? (mode === 'points' ? (i.actual_time ?? 0) : 1) : 0
    m.count++
    m.items.push(i)
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

export function buildDefects(sprintTitle: string): DefectData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT id FROM sprints WHERE title = ?')
    .get(sprintTitle) as { id: number } | undefined
  if (!sprint) return null

  // Current sprint items
  const items = db
    .prepare(
      `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
       FROM items
       WHERE sprint_id = ?
       ORDER BY status, title`
    )
    .all(sprint.id) as BurndownItem[]

  const bugItems = items.filter((i) => i.type === 'bug')
  const closedBugs = bugItems.filter((i) => i.status === 'Done')
  const openBugs = bugItems.filter((i) => i.status !== 'Done')

  const defectCount = bugItems.length
  const totalItems = items.length
  const defectRate = totalItems > 0 ? Math.round((defectCount / totalItems) * 100) : 0

  // Per-assignee breakdown
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

  // Trend across all sprints
  const allSprints = db
    .prepare('SELECT id, title FROM sprints ORDER BY start_date')
    .all() as { id: number; title: string }[]

  const trend: DefectTrendEntry[] = allSprints.map((s) => {
    const sprintItems = db
      .prepare('SELECT type FROM items WHERE sprint_id = ?')
      .all(s.id) as { type: string }[]
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

export function buildScorecard(sprintTitle: string): ScorecardData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT id, start_date, duration FROM sprints WHERE title = ?')
    .get(sprintTitle) as { id: number; start_date: string; duration: number } | undefined
  if (!sprint) return null

  // 1. Delivery rate (commitment - points mode)
  const commitment = buildCommitment('points')
  const currentSprintCommit = commitment.sprints.find((s) => s.sprint === sprintTitle)
  const deliveryRate = currentSprintCommit?.rate ?? 0
  const deliveryKpi = rateToRating(deliveryRate)

  // 2. Cycle time
  const cycleData = buildCycleTime(sprintTitle)
  const cycleTime = cycleData?.summary.currentAvg ?? 0
  const cycleKpi = cycleData?.summary.kpiRating ?? 'Good'

  // 3. Defect rate
  const defectData = buildDefects(sprintTitle)
  const defectRate = defectData?.summary.defectRate ?? 0
  const defectKpi = defectData?.summary.kpiRating ?? 'Good'

  // 4. Velocity: current sprint vs all-sprint average
  const velocity = buildVelocity('points')
  const currentV = velocity.currentSprint
  const velocityCompleted = currentV?.completed ?? 0
  const velocityAverage = velocity.average
  const velocityDiff = Math.round((velocityCompleted - velocityAverage) * 10) / 10

  // 5. Estimation variance (from time analysis)
  const timeData = buildTimeAnalysis(sprintTitle)
  const totalEst = timeData?.summary.totalEstimated ?? 1
  const totalAct = timeData?.summary.totalActual ?? 0
  const estimationVariance = Math.round((totalAct - totalEst) * 10) / 10
  const estimationVariancePct = totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0
  const estimationKpi = estimationRating(estimationVariancePct)

  // 6. Burndown percentage and issues
  const burndown = buildBurndown(sprintTitle, 'points')
  const burndownPct = burndown?.summary.percentComplete ?? 0
  const issuesTotal = burndown?.items.length ?? 0
  const issuesCompleted = burndown?.items.filter((i) => i.status === 'Done').length ?? 0

  // 7. Days left
  const startDate = new Date(sprint.start_date)
  const now = new Date()
  const dayIndex = Math.min(
    Math.max(Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)), 0),
    sprint.duration
  )
  const daysLeft = sprint.duration - dayIndex

  // 8. Active members
  const team = buildTeamStats(sprintTitle)
  const activeMembers = team.summary.activeMembers

  // 9. At-risk issues (in progress that should be done)
  const overview = buildOverview(sprintTitle)
  const issuesAtRisk = overview?.stories.filter((s) => s.status === 'In Progress' || s.status === 'To Do').length ?? 0

  // Overall rating = worst of the 4 primary KPIs
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
    sprint: sprintTitle,
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

export function buildStability(sprintTitle: string): StabilityData | null {
  const db = getDb()

  const sprint = db
    .prepare('SELECT id FROM sprints WHERE title = ?')
    .get(sprintTitle) as { id: number } | undefined
  if (!sprint) return null

  const allSprints = db
    .prepare('SELECT id, title FROM sprints ORDER BY start_date')
    .all() as { id: number; title: string }[]

  const sprintMetrics: StabilitySprintMetric[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status FROM items WHERE sprint_id = ?')
      .all(s.id) as { effort: number | null; actual_time: number | null; status: string }[]

    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    const doneItems = items.filter((i) => i.status === 'Done')
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

  const current = sprintMetrics.find((s) => s.sprint === sprintTitle)
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
    sprint: sprintTitle,
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

export function buildTeamStats(sprintTitle?: string): TeamData {
  const db = getDb()

  const sprintFilter = sprintTitle
    ? "AND sprint_id = (SELECT id FROM sprints WHERE title = ?)"
    : ""

  const members = db
    .prepare(
      `SELECT
         assignee,
         COALESCE(SUM(effort), 0) AS totalEffort,
         COALESCE(SUM(actual_time), 0) AS totalActual,
         COUNT(CASE WHEN status = 'Done' THEN 1 END) AS closedCount
       FROM items
       WHERE assignee IS NOT NULL ${sprintFilter}
       GROUP BY assignee
       ORDER BY assignee`
    )
    .all(sprintTitle ? [sprintTitle] : []) as { assignee: string; totalEffort: number; totalActual: number; closedCount: number }[]

  const totalEffortAll = members.reduce((s, m) => s + m.totalEffort, 0) || 1

  const memberStatements = sprintTitle
    ? db.prepare(
        `SELECT title, number, url, type, status, effort, actual_time, assignee, closed_at
         FROM items
         WHERE assignee = ? AND assignee IS NOT NULL
           AND sprint_id = (SELECT id FROM sprints WHERE title = ?)
         ORDER BY status, title`
      )
    : null

  const membersWithItems: TeamMemberStat[] = members.map((m) => {
    let items: TeamMemberItem[] = []
    if (memberStatements) {
      items = memberStatements.all(m.assignee, sprintTitle) as TeamMemberItem[]
    }
    return {
      ...m,
      share: Math.round((m.totalEffort / totalEffortAll) * 100),
      items,
    }
  })

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

export function buildKpiReview(): KpiReviewData {
  const db = getDb()

  const allSprints = db
    .prepare('SELECT id, title, start_date, duration FROM sprints ORDER BY start_date')
    .all() as { id: number; title: string; start_date: string; duration: number }[]

  const sprints: KpiReviewEntry[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status, type, closed_at FROM items WHERE sprint_id = ?')
      .all(s.id) as { effort: number | null; actual_time: number | null; status: string; type: string; closed_at: string | null }[]

    // Delivery rate (points mode)
    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const doneItems = items.filter((i) => i.status === 'Done')
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    // Cycle time
    const cycleTimes = doneItems
      .map((i) => calcCycleTime(s.start_date, i.closed_at, s.duration))
      .filter((t): t is number => t != null)
    const cycleTime = cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
      : 0

    // Defect rate
    const bugs = items.filter((i) => i.type === 'bug').length
    const defectRate = items.length > 0 ? Math.round((bugs / items.length) * 100) : 0

    // Estimation accuracy
    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    // Velocity
    const velocity = Math.round(delivered * 10) / 10

    // Scope completion
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
