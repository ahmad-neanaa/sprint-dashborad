import { getDb } from '../db'

export function getActualTimeSql(
  doneStatus: string,
  inProgressStatus: string,
  boundaryStartDate?: string,
  boundaryEndDate?: string
): { sql: string; params: unknown[] } {
  const params: unknown[] = []

  const bEndSql = boundaryEndDate ? '?' : 'NULL'
  const bStartSql = boundaryStartDate ? '?' : 'NULL'

  params.push(inProgressStatus)
  if (boundaryEndDate) params.push(boundaryEndDate + ' 23:59:59')
  if (boundaryStartDate) params.push(boundaryStartDate + ' 00:00:00')
  params.push(inProgressStatus)
  params.push(doneStatus)
  if (boundaryEndDate) params.push(boundaryEndDate + ' 23:59:59')
  if (boundaryStartDate) params.push(boundaryStartDate + ' 00:00:00')

  return {
    sql: `
    COALESCE(
      i.actual_time,
      CASE 
        WHEN (SELECT COUNT(*) FROM item_transitions t WHERE t.item_id = i.id AND t.status = ?) > 0 THEN
          COALESCE(
            (
              SELECT SUM(
                MAX(0, 
                  julianday(MIN(COALESCE(t.end_date, i.closed_at, datetime('now')), COALESCE(${bEndSql}, datetime('now')))) - 
                  julianday(MAX(t.start_date, COALESCE(${bStartSql}, (SELECT s.start_date || ' 00:00:00' FROM sprints s WHERE s.id = i.sprint_id), t.start_date)))
                )
              ) * 8
              FROM item_transitions t 
              WHERE t.item_id = i.id AND t.status = ?
            ),
            0
          )
        WHEN i.status = ? THEN
          MAX(0,
            julianday(MIN(COALESCE(i.closed_at, datetime('now')), COALESCE(${bEndSql}, datetime('now')))) - 
            julianday(MAX(i.created_at, COALESCE(${bStartSql}, (SELECT s.start_date || ' 00:00:00' FROM sprints s WHERE s.id = i.sprint_id), i.created_at)))
          ) * 8
        ELSE 0
      END
    )`,
    params
  }
}

export function getIsCarryOverSql(sprintStartDate: string, inProgressStatus: string): { sql: string; params: unknown[] } {
  return {
    sql: `
    CASE WHEN i.created_at < ? || ' 00:00:00'
         OR EXISTS (
           SELECT 1 FROM item_transitions t 
           WHERE t.item_id = i.id 
             AND t.status = ? 
             AND t.start_date < ? || ' 00:00:00'
         )
         THEN 1 ELSE 0 END
    `,
    params: [sprintStartDate, inProgressStatus, sprintStartDate]
  }
}

export function getProjectId(projectName?: string): number | null {
  if (!projectName) return null
  const row = getDb().prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined
  return row?.id ?? null
}

export function getProjectFilter(projectName?: string): { sql: string; params: unknown[] } {
  const pid = getProjectId(projectName)
  if (pid === null) return { sql: '', params: [] }
  return { sql: 'AND s.project_id = ?', params: [pid] }
}

export function getSprintProjectFilter(projectName?: string): { sql: string; params: unknown[] } {
  const pid = getProjectId(projectName)
  if (pid === null) return { sql: '', params: [] }
  return { sql: 'AND i.project_id = ?', params: [pid] }
}

export function getIssueTypeFilter(issueType?: string, prefix = 'i'): { sql: string; params: unknown[] } {
  if (!issueType) return { sql: '', params: [] }
  const field = prefix ? `${prefix}.type` : 'type'
  return { sql: ` AND ${field} = ?`, params: [issueType] }
}

export function getDoneValue(projectName?: string): string {
  if (projectName) {
    const row = getDb().prepare("SELECT done_value FROM projects WHERE name = ?").get(projectName) as { done_value: string } | undefined
    if (row?.done_value) return row.done_value
  }
  return 'Done'
}

export function getInProgressValue(projectName?: string): string {
  if (projectName) {
    const row = getDb().prepare("SELECT in_progress_value FROM projects WHERE name = ?").get(projectName) as { in_progress_value: string } | undefined
    if (row?.in_progress_value) return row.in_progress_value
  }
  return 'In Progress'
}

export function getExpectedHours(projectName?: string): number {
  if (projectName) {
    const row = getDb().prepare("SELECT expected_hours FROM projects WHERE name = ?").get(projectName) as { expected_hours: number } | undefined
    if (row) return row.expected_hours
  }
  return 0
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
  is_carry_over?: number | boolean
}

export function calcCycleTime(startDate: string, closedAt: string | null, duration: number): number | null {
  if (!closedAt) return null
  const start = new Date(startDate)
  const closed = new Date(closedAt)
  const days = (closed.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(days, duration))
}

export function kpiRating(days: number): 'Good' | 'Fair' | 'Poor' {
  if (days <= 3) return 'Good'
  if (days <= 7) return 'Fair'
  return 'Poor'
}

export function rateToRating(rate: number): 'Good' | 'Fair' | 'Poor' {
  if (rate >= 85) return 'Good'
  if (rate >= 70) return 'Fair'
  return 'Poor'
}

export function defectsRating(rate: number): 'Good' | 'Fair' | 'Poor' {
  if (rate <= 15) return 'Good'
  if (rate <= 30) return 'Fair'
  return 'Poor'
}

export function estimationRating(varPct: number): 'Good' | 'Fair' | 'Poor' {
  const abs = Math.abs(varPct)
  if (abs <= 10) return 'Good'
  if (abs <= 25) return 'Fair'
  return 'Poor'
}

export function consistencyCvKpi(cv: number): 'Good' | 'Fair' | 'Poor' {
  if (cv <= 15) return 'Good'
  if (cv <= 30) return 'Fair'
  return 'Poor'
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  return Math.round(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}
