import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, kpiRating
} from './helpers'

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
