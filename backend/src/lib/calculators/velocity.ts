import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getIssueTypeFilter,
  getActualTimeSql, getExpectedHours, BurndownItem
} from './helpers'

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
    const atVel = getActualTimeSql(doneStatus, inProgressStatus)
    countExpr = `COALESCE(SUM(CASE WHEN i.status = ? THEN 
        ${atVel.sql}
       ELSE 0 END), 0)`
    bindParams.push(doneStatus, ...atVel.params)
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
    const atVCurr = getActualTimeSql(doneStatus, inProgressStatus)
    const items = db
      .prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${atVCurr.sql} as actual_time,
           i.assignee, i.closed_at
         FROM items i
         WHERE i.sprint_id = (SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql})
           AND i.status = ? ${typeFilter.sql}
         ORDER BY i.closed_at`
      )
      .all(...atVCurr.params, latest.sprint, ...projectFilter.params, doneStatus, ...typeFilter.params) as BurndownItem[]

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
