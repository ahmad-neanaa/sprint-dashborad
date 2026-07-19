import { getDb } from '../db'
import {
  getDoneValue, getProjectFilter, getSprintProjectFilter, getIssueTypeFilter,
  rateToRating, estimationRating
} from './helpers'
import { buildCommitment } from './commitment'
import { buildCycleTime } from './cycle-time'
import { buildDefects } from './defects'
import { buildVelocity } from './velocity'
import { buildTimeAnalysis } from './time-analysis'
import { buildBurndown } from './burndown'
import { buildTeamStats } from './team'
import { buildOverview } from './overview'

export interface ScorecardKpi {
  label: string
  value: string
  rating: 'Good' | 'Fair' | 'Poor'
  detail: string
}

export interface ScorecardData {
  sprint: string
  summary: {
    overallRating: 'Good' | 'Fair' | 'Poor'
    deliveryRate: number
    deliveryKpi: 'Good' | 'Fair' | 'Poor'
    cycleTime: number
    cycleKpi: 'Good' | 'Fair' | 'Poor'
    defectRate: number
    defectKpi: 'Good' | 'Fair' | 'Poor'
    velocityCompleted: number
    velocityAverage: number
    velocityDiff: number
    estimationVariance: number
    estimationVariancePct: number
    estimationKpi: 'Good' | 'Fair' | 'Poor'
    burndownPct: number
    issuesCompleted: number
    issuesTotal: number
    daysLeft: number
    activeMembers: number
    issuesAtRisk: number
  }
  kpis: ScorecardKpi[]
}

export function buildScorecard(sprintTitle: string | null, projectName?: string, startDate?: string, endDate?: string, issueType?: string): ScorecardData | null {
  const db = getDb()
  const doneStatus = getDoneValue(projectName)
  const projectFilter = getProjectFilter(projectName)
  const typeFilter = getIssueTypeFilter(issueType)

  let startStr: string
  let duration: number

  if (sprintTitle) {
    const sprint = db
      .prepare(`SELECT id, start_date, duration FROM sprints s WHERE s.title = ? ${projectFilter.sql}`)
      .get(sprintTitle, ...projectFilter.params) as { id: number; start_date: string; duration: number } | undefined
    if (!sprint) return null
    startStr = sprint.start_date
    duration = sprint.duration
  } else if (startDate && endDate) {
    startStr = startDate
    const start = new Date(startDate)
    const end = new Date(endDate)
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  } else {
    return null
  }

  const commitment = buildCommitment('points', projectName, issueType)
  const currentSprintCommit = sprintTitle ? commitment.sprints.find((s) => s.sprint === sprintTitle) : null
  
  let deliveryRate = 0
  let committedHours = 0
  let deliveredHours = 0
  if (sprintTitle) {
    deliveryRate = currentSprintCommit?.rate ?? 0
    committedHours = currentSprintCommit?.committed ?? 0
    deliveredHours = currentSprintCommit?.delivered ?? 0
  } else {
    const items = db
      .prepare(
        `SELECT effort, actual_time, status FROM items i
         WHERE i.created_at <= ? AND (i.closed_at IS NULL OR i.closed_at >= ?) ${getSprintProjectFilter(projectName).sql} ${typeFilter.sql}`
      )
      .all(endDate + ' 23:59:59', startDate + ' 00:00:00', ...getSprintProjectFilter(projectName).params, ...typeFilter.params) as { effort: number | null; actual_time: number | null; status: string }[]
    committedHours = items.reduce((sum, i) => sum + (i.effort ?? 0), 0)
    deliveredHours = items.filter((i) => i.status === doneStatus).reduce((sum, i) => sum + (i.actual_time ?? 0), 0)
    deliveryRate = committedHours > 0 ? Math.round((deliveredHours / committedHours) * 100) : 0
  }
  const deliveryKpi = rateToRating(deliveryRate)

  const cycleData = buildCycleTime(sprintTitle, projectName, startDate, endDate, issueType)
  const cycleTime = cycleData?.summary.currentAvg ?? 0
  const cycleKpi = cycleData?.summary.kpiRating ?? 'Good'

  const defectData = buildDefects(sprintTitle, projectName, startDate, endDate, issueType)
  const defectRate = defectData?.summary.defectRate ?? 0
  const defectKpi = defectData?.summary.kpiRating ?? 'Good'

  const velocity = buildVelocity('points', projectName, issueType)
  const velocityCompleted = sprintTitle ? (velocity.currentSprint?.completed ?? 0) : deliveredHours
  const velocityAverage = velocity.average
  const velocityDiff = Math.round((velocityCompleted - velocityAverage) * 10) / 10

  const timeData = buildTimeAnalysis(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const totalEst = timeData?.summary.totalEstimated ?? 1
  const totalAct = timeData?.summary.totalActual ?? 0
  const estimationVariance = Math.round((totalAct - totalEst) * 10) / 10
  const estimationVariancePct = totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0
  const estimationKpi = estimationRating(estimationVariancePct)

  const burndown = buildBurndown(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const burndownPct = burndown?.summary.percentComplete ?? 0
  const issuesTotal = burndown?.items.length ?? 0
  const issuesCompleted = burndown?.items.filter((i) => i.status === doneStatus).length ?? 0

  const startDateObj = new Date(startStr)
  const now = new Date()
  const dayIndex = Math.min(
    Math.max(Math.floor((now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)), 0),
    duration
  )
  const daysLeft = duration - dayIndex

  const team = buildTeamStats(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const activeMembers = team.summary.activeMembers

  const overview = buildOverview(sprintTitle, 'points', projectName, startDate, endDate, issueType)
  const issuesAtRisk = overview?.stories.filter((s) => s.status === 'In Progress' || s.status === 'To Do').length ?? 0

  const ratings = [deliveryKpi, cycleKpi, defectKpi, estimationKpi]
  const overallRating: 'Good' | 'Fair' | 'Poor' =
    ratings.some((r) => r === 'Poor') ? 'Poor' :
    ratings.some((r) => r === 'Fair') ? 'Fair' : 'Good'

  const kpis: ScorecardKpi[] = [
    {
      label: 'Delivery Rate',
      value: `${deliveryRate}%`,
      rating: deliveryKpi,
      detail: `${currentSprintCommit?.delivered ?? 0}h / ${currentSprintCommit?.committed ?? 0}h delivered`,
    },
    {
      label: 'Cycle Time',
      value: `${cycleTime}d`,
      rating: cycleKpi,
      detail: `Average days to complete`,
    },
    {
      label: 'Defect Rate',
      value: `${defectRate}%`,
      rating: defectKpi,
      detail: `${defectData?.summary.defectCount ?? 0} bugs in ${defectData?.summary.totalItems ?? 0} items`,
    },
    {
      label: 'Estimation Accuracy',
      value: `${estimationVariancePct > 0 ? '+' : ''}${estimationVariancePct}%`,
      rating: estimationKpi,
      detail: `${Math.abs(estimationVariance)}h variance (est ${totalEst}h / act ${totalAct}h)`,
    },
    {
      label: 'Velocity',
      value: `${velocityCompleted}h`,
      rating: velocityDiff >= 0 ? 'Good' : 'Fair',
      detail: `Avg ${velocityAverage}h — ${velocityDiff >= 0 ? '+' : ''}${velocityDiff}h vs average`,
    },
  ]

  return {
    sprint: sprintTitle || 'Custom Range',
    summary: {
      overallRating,
      deliveryRate,
      deliveryKpi,
      cycleTime,
      cycleKpi,
      defectRate,
      defectKpi,
      velocityCompleted,
      velocityAverage,
      velocityDiff,
      estimationVariance,
      estimationVariancePct,
      estimationKpi,
      burndownPct,
      issuesCompleted,
      issuesTotal,
      daysLeft,
      activeMembers,
      issuesAtRisk,
    },
    kpis,
  }
}
