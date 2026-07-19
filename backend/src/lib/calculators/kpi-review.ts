import { getDb } from '../db'
import {
  getDoneValue, getProjectFilter, calcCycleTime, kpiRating, rateToRating,
  defectsRating, estimationRating
} from './helpers'

export interface KpiReviewEntry {
  sprint: string
  deliveryRate: number
  deliveryKpi: 'Good' | 'Fair' | 'Poor'
  cycleTime: number
  cycleKpi: 'Good' | 'Fair' | 'Poor'
  defectRate: number
  defectKpi: 'Good' | 'Fair' | 'Poor'
  estimationAccuracy: number
  estimationKpi: 'Good' | 'Fair' | 'Poor'
  velocity: number
  scopeCompletionRate: number
  overallKpi: 'Good' | 'Fair' | 'Poor'
}

export interface KpiReviewData {
  sprints: KpiReviewEntry[]
  averages: {
    deliveryRate: number
    cycleTime: number
    defectRate: number
    estimationAccuracy: number
    velocity: number
    scopeCompletionRate: number
  }
}

export function buildKpiReview(projectName?: string): KpiReviewData {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)

  const allSprints = db
    .prepare(`SELECT id, title, start_date, duration FROM sprints s WHERE 1=1 ${projectFilter.sql} ORDER BY s.start_date`)
    .all(...projectFilter.params) as { id: number; title: string; start_date: string; duration: number }[]

  const sprints: KpiReviewEntry[] = allSprints.map((s) => {
    const items = db
      .prepare('SELECT effort, actual_time, status, type, closed_at FROM items WHERE sprint_id = ?')
      .all(s.id) as { effort: number | null; actual_time: number | null; status: string; type: string; closed_at: string | null }[]

    const committed = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const doneItems = items.filter((i) => i.status === doneStatus)
    const delivered = doneItems.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const deliveryRate = committed > 0 ? Math.round((delivered / committed) * 100) : 0

    const cycleTimes = doneItems
      .map((i) => calcCycleTime(s.start_date, i.closed_at, s.duration))
      .filter((t): t is number => t != null)
    const cycleTime = cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
      : 0

    const bugs = items.filter((i) => i.type === 'bug').length
    const defectRate = items.length > 0 ? Math.round((bugs / items.length) * 100) : 0

    const totalEst = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    const totalAct = items.reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    const estimationAccuracy = totalEst > 0
      ? Math.round((1 - Math.abs(totalAct - totalEst) / totalEst) * 100)
      : 100

    const velocity = Math.round(delivered * 10) / 10

    const scopeCompletionRate = items.length > 0
      ? Math.round((doneItems.length / items.length) * 100)
      : 100

    const ratings = [rateToRating(deliveryRate), kpiRating(cycleTime), defectsRating(defectRate), estimationRating(totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0)]
    const overallKpi: 'Good' | 'Fair' | 'Poor' =
      ratings.some((r) => r === 'Poor') ? 'Poor' :
      ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

    return {
      sprint: s.title,
      deliveryRate,
      deliveryKpi: rateToRating(deliveryRate),
      cycleTime,
      cycleKpi: kpiRating(cycleTime),
      defectRate,
      defectKpi: defectsRating(defectRate),
      estimationAccuracy,
      estimationKpi: estimationRating(totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0),
      velocity,
      scopeCompletionRate,
      overallKpi,
    }
  })

  const avgDeliveryRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.deliveryRate, 0) / sprints.length) : 0
  const avgCycleTime = sprints.length > 0 ? Math.round((sprints.reduce((s, e) => s + e.cycleTime, 0) / sprints.length) * 10) / 10 : 0
  const avgDefectRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.defectRate, 0) / sprints.length) : 0
  const avgEstimationAccuracy = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.estimationAccuracy, 0) / sprints.length) : 0
  const avgVelocity = sprints.length > 0 ? Math.round((sprints.reduce((s, e) => s + e.velocity, 0) / sprints.length) * 10) / 10 : 0
  const avgScopeCompletionRate = sprints.length > 0 ? Math.round(sprints.reduce((s, e) => s + e.scopeCompletionRate, 0) / sprints.length) : 0

  return {
    sprints,
    averages: {
      deliveryRate: avgDeliveryRate,
      cycleTime: avgCycleTime,
      defectRate: avgDefectRate,
      estimationAccuracy: avgEstimationAccuracy,
      velocity: avgVelocity,
      scopeCompletionRate: avgScopeCompletionRate,
    },
  }
}
