import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql, getIsCarryOverSql, getExpectedHours,
  rateToRating
} from './helpers'

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
  is_carry_over?: number | boolean
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

  let startStr: string
  let items: CommitAssigneeItem[]

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id, start_date FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string } | undefined
    if (!sprint) return null
    startStr = sprint.start_date

    const atCa = getActualTimeSql(doneStatus, inProgressStatus)
    const coCa = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atCa.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coCa.sql} as is_carry_over
          FROM items i
          WHERE i.sprint_id = ? AND i.assignee IS NOT NULL ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(...atCa.params, ...coCa.params, sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as any[]
  } else if (startDate && endDate) {
    startStr = startDate
    const atCaDt = getActualTimeSql(doneStatus, inProgressStatus, startDate, endDate)
    const coCaDt = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atCaDt.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coCaDt.sql} as is_carry_over
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) AND i.assignee IS NOT NULL ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(...atCaDt.params, ...coCaDt.params, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as any[]
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
