import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getActualTimeSql, getIsCarryOverSql, BurndownItem
} from './helpers'

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

  const atTsAgg = getActualTimeSql(doneStatus, inProgressStatus, (startDate && !sprintTitle) ? startDate : undefined, (endDate && !sprintTitle) ? endDate : undefined)
  const rawMembers = db
    .prepare(
      `SELECT
         i.assignee,
         COALESCE(SUM(i.effort), 0) AS totalEffort,
         COALESCE(SUM(
           ${atTsAgg.sql}
         ), 0) AS totalActual,
         COUNT(CASE WHEN i.status = ? THEN 1 END) AS closedCount
       FROM items i
       LEFT JOIN sprints s ON i.sprint_id = s.id
       WHERE i.assignee IS NOT NULL ${sprintFilter} ${sprintProjectFilter.sql} ${typeFilter.sql}
       GROUP BY i.assignee
       ORDER BY i.assignee`
    )
    .all(...atTsAgg.params, doneStatus, ...sprintParams, ...sprintProjectFilter.params, ...typeFilter.params) as { assignee: string; totalEffort: number; totalActual: number; closedCount: number }[]

  let startStr = ''
  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT start_date FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { start_date: string } | undefined
    startStr = sprint?.start_date || ''
  } else if (startDate) {
    startStr = startDate
  }

  const atTsMem1 = getActualTimeSql(doneStatus, inProgressStatus)
  const coTsMem1 = getIsCarryOverSql(startStr, inProgressStatus)
  const atTsMem2 = getActualTimeSql(doneStatus, inProgressStatus, startDate, endDate)
  const coTsMem2 = getIsCarryOverSql(startStr, inProgressStatus)

  const memberStatements = sprintTitle
    ? db.prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${atTsMem1.sql} as actual_time,
           i.assignee, i.closed_at,
           ${coTsMem1.sql} as is_carry_over
         FROM items i
         JOIN sprints s ON i.sprint_id = s.id
         WHERE i.assignee = ? AND i.assignee IS NOT NULL
           AND s.title = ? ${projectFilter.sql} ${sprintProjectFilter.sql} ${typeFilter.sql}
         ORDER BY i.status, i.title`
      )
    : (startDate && endDate)
    ? db.prepare(
        `SELECT i.title, i.number, i.url, i.type, i.status, i.effort,
           ${atTsMem2.sql} as actual_time,
           i.assignee, i.closed_at,
           ${coTsMem2.sql} as is_carry_over
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
        items = memberStatements.all(...atTsMem1.params, ...coTsMem1.params, m.assignee, sprintTitle, ...projectFilter.params, ...sprintProjectFilter.params, ...typeFilter.params) as TeamMemberItem[]
      } else if (startDate && endDate) {
        items = memberStatements.all(...atTsMem2.params, ...coTsMem2.params, m.assignee, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as TeamMemberItem[]
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
