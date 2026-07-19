import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql, getIsCarryOverSql, getExpectedHours,
  BurndownItem
} from './helpers'

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
    const atCommon = getActualTimeSql(doneStatus, inProgressStatus)
    const coCommon = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atCommon.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coCommon.sql} as is_carry_over
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(...atCommon.params, ...coCommon.params, sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const atDt = getActualTimeSql(doneStatus, inProgressStatus, startDate, endDate)
    const coDt = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atDt.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coDt.sql} as is_carry_over
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}`
      )
      .all(...atDt.params, ...coDt.params, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
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
