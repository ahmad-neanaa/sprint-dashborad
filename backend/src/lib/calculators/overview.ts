import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql, getIsCarryOverSql, getExpectedHours
} from './helpers'

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
  is_carry_over?: number | boolean
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
    const atOv = getActualTimeSql(doneStatus, inProgressStatus)
    const coOv = getIsCarryOverSql(startStr, inProgressStatus)
    stories = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atOv.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coOv.sql} as is_carry_over
          FROM items i
          WHERE i.sprint_id = (SELECT id FROM sprints s WHERE s.title = ? ${projectFilter.sql}) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.type, i.title`
      )
      .all(...atOv.params, ...coOv.params, sprintTitle, ...projectFilter.params, ...sprintProjectFilter.params, ...typeFilter.params) as OverviewStory[]
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const atOvDt = getActualTimeSql(doneStatus, inProgressStatus, startDate, endDate)
    const coOvDt = getIsCarryOverSql(startStr, inProgressStatus)
    stories = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
            ${atOvDt.sql} as actual_time,
            i.assignee, i.closed_at,
            ${coOvDt.sql} as is_carry_over
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.type, i.title`
      )
      .all(...atOvDt.params, ...coOvDt.params, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as OverviewStory[]
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
