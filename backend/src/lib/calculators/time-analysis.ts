import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql
} from './helpers'

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

    const atTa = getActualTimeSql(doneStatus, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atTa.sql} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(...atTa.params, sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
  } else if (startDate && endDate) {
    const atTaDt = getActualTimeSql(doneStatus, inProgressStatus, startDate, endDate)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atTaDt.sql} as actual_time,
            i.assignee, i.closed_at
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.assignee, i.title`
      )
      .all(...atTaDt.params, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as typeof items
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
