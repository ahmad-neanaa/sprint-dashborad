import { getDb } from '../db'
import {
  getDoneValue, getInProgressValue, getProjectFilter, getSprintProjectFilter,
  getIssueTypeFilter, getIsCarryOverSql, defectsRating, BurndownItem
} from './helpers'

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

export function buildDefects(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): DefectData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const inProgressStatus = getInProgressValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const sprintProjectFilter = getSprintProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let items: BurndownItem[]
  let startStr: string

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id, start_date FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string } | undefined
    if (!sprint) return null
    startStr = sprint.start_date

    const coDf = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort, i.actual_time, i.assignee, i.closed_at,
            ${coDf.sql} as is_carry_over
          FROM items i
          WHERE i.sprint_id = ? ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.title`
      )
      .all(...coDf.params, sprint.id, ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
  } else if (startDate && endDate) {
    startStr = startDate
    const coDfDt = getIsCarryOverSql(startStr, inProgressStatus)
    items = db
      .prepare(
         `SELECT i.title, i.number, i.url, i.type, i.status, i.effort, i.actual_time, i.assignee, i.closed_at,
            ${coDfDt.sql} as is_carry_over
          FROM items i
          WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${sprintProjectFilter.sql} ${typeFilter.sql}
          ORDER BY i.status, i.title`
      )
      .all(...coDfDt.params, endDate + ' 23:59:59', startDate + ' 00:00:00', ...sprintProjectFilter.params, ...typeFilter.params) as BurndownItem[]
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
