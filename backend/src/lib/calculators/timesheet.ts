import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql, getIsCarryOverSql
} from './helpers'

export interface TimesheetTask {
  title: string
  number: number
  url: string
  type: string
  status: string
  state: string
  effort: number | null
  actual_time: number | null
  is_carry_over?: number | boolean
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

  let startStr = ''

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT * FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined

    if (!sprint) return null
    sprintFilter = 'AND i.sprint_id = ?'
    sprintParams = [sprint.id]
    startStr = sprint.start_date
  } else if (startDate && endDate) {
    sprintFilter = 'AND i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?)'
    sprintParams = [endDate + ' 23:59:59', startDate + ' 00:00:00']
    startStr = startDate
  } else {
    return null
  }

  const atTs = getActualTimeSql(doneStatus, inProgressStatus, (!sprintTitle && startDate) ? startDate : undefined, (!sprintTitle && endDate) ? endDate : undefined)
  const coTs = getIsCarryOverSql(startStr, inProgressStatus)
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
         ${atTs.sql} as actual_time,
         ${coTs.sql} as is_carry_over
       FROM items i
       WHERE i.assignee IS NOT NULL AND i.assignee != ''
         ${sprintFilter}
         ${sprintProjectFilter.sql}
         ${typeFilter.sql}
       ORDER BY i.assignee, i.number`
    )
    .all(...atTs.params, ...coTs.params, ...sprintParams, ...sprintProjectFilter.params, ...typeFilter.params) as {
      assignee: string
      title: string
      number: number
      url: string
      type: string
      status: string
      state: string
      effort: number | null
      actual_time: number | null
      is_carry_over: number
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
      actual_time: row.actual_time,
      is_carry_over: row.is_carry_over
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
