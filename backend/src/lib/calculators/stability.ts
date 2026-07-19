import { getDb } from '../db'
import {
  getDoneValue, getProjectFilter, getSprintProjectFilter, getIssueTypeFilter,
  consistencyCvKpi, stdDev
} from './helpers'

export interface StabilitySprintMetric {
  sprint: string
  estimationAccuracy: number
  scopeCompletionRate: number
  deliveryRate: number
  velocity: number
}

export interface StabilityData {
  sprint: string
  summary: {
    estimationAccuracy: number
    estimationKpi: 'Good' | 'Fair' | 'Poor'
    scopeCompletionRate: number
    scopeChurn: number
    deliveryConsistency: number
    deliveryConsistencyKpi: 'Good' | 'Fair' | 'Poor'
    velocityCv: number
    velocityCvKpi: 'Good' | 'Fair' | 'Poor'
    overallRating: 'Good' | 'Fair' | 'Poor'
  }
  sprintMetrics: StabilitySprintMetric[]
  trendLabels: string[]
  estimationTrend: number[]
  completionTrend: number[]
}

export function buildStability(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): StabilityData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  const allSprints = db
    .prepare(`SELECT id, title FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string }[]

  const sprintMetrics: StabilitySprintMetric[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status FROM items i WHERE i.sprint_id = ?' + typeFilter.sql)
      .all(s.id, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]

    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    const doneItems = items.filter((i) => i.status === doneStatus)
    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100

    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    return {
      sprint: s.title,
      estimationAccuracy,
      scopeCompletionRate,
      deliveryRate,
      velocity: Math.round(delivered * 10) / 10,
    }
  })

  let current: StabilitySprintMetric | undefined
  if (sprintTitle) {
    current = sprintMetrics.find((s) => s.sprint === sprintTitle)
  } else if (startDate && endDate) {
    const items = db
      .prepare(
        `SELECT effort, actual_time, status FROM items i
         WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${getSprintProjectFilter(projectName).sql} ${typeFilter.sql}`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...getSprintProjectFilter(projectName).params, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]
    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100
    const doneItems = items.filter((i) => i.status === doneStatus)
    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100
    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    current = {
      sprint: 'Custom Range',
      estimationAccuracy,
      scopeCompletionRate,
      deliveryRate,
      velocity: Math.round(delivered * 10) / 10,
    }
    sprintMetrics.push(current)
  }
  if (!current) return null

  const rates = sprintMetrics.map((s) => s.deliveryRate)
  const velocities = sprintMetrics.map((s) => s.velocity)
  const meanVel = velocities.reduce((a, b) => a + b, 0) / velocities.length

  const deliveryConsistency = stdDev(rates)
  const velocityCv = meanVel > 0 ? Math.round((stdDev(velocities) / meanVel) * 100) : 0

  const scopeChurn = 100 - current.scopeCompletionRate

  const ratings = [current.estimationAccuracy >= 90 ? 'Good' as const : current.estimationAccuracy >= 75 ? 'Fair' as const : 'Poor' as const,
    consistencyCvKpi(deliveryConsistency),
    consistencyCvKpi(velocityCv)]
  const overallRating: 'Good' | 'Fair' | 'Poor' =
    ratings.some((r) => r === 'Poor') ? 'Poor' :
    ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

  return {
    sprint: sprintTitle || 'Custom Range',
    summary: {
      estimationAccuracy: current.estimationAccuracy,
      estimationKpi: current.estimationAccuracy >= 90 ? 'Good' : current.estimationAccuracy >= 75 ? 'Fair' : 'Poor',
      scopeCompletionRate: current.scopeCompletionRate,
      scopeChurn,
      deliveryConsistency,
      deliveryConsistencyKpi: consistencyCvKpi(deliveryConsistency),
      velocityCv,
      velocityCvKpi: consistencyCvKpi(velocityCv),
      overallRating,
    },
    sprintMetrics,
    trendLabels: sprintMetrics.map((s) => s.sprint),
    estimationTrend: sprintMetrics.map((s) => s.estimationAccuracy),
    completionTrend: sprintMetrics.map((s) => s.scopeCompletionRate),
  }
}
