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
}

export interface BurndownResponse {
  sprint: string
  mode: 'points' | 'issues'
  summary: BurndownSummary
  points: BurndownPoint[]
  items: BurndownItem[]
}

export interface VelocityEntry {
  sprint: string
  completed: number
}

export interface VelocityResponse {
  mode: 'points' | 'issues'
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

export interface TeamMemberStat {
  assignee: string
  totalEffort: number
  totalActual: number
  closedCount: number
  share: number
  items: BurndownItem[]
}

export interface TeamSummary {
  activeMembers: number
  totalEffort: number
  totalActual: number
  closedCount: number
}

export interface TeamResponse {
  summary: TeamSummary
  members: TeamMemberStat[]
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

export interface OverviewResponse {
  sprint: string
  summary: OverviewSummary
  stories: BurndownItem[]
}

export interface TimeAnalysisIssue {
  title: string
  number: number
  url: string
  type: string
  status: string
  assignee: string | null
  effort: number | null
  actual_time: number | null
  variance: number | null
  source: 'MAN' | 'AUTO' | null
}

export interface TimeAnalysisMember {
  assignee: string
  estimated: number
  actual: number
  variance: number
  count: number
  items: TimeAnalysisIssue[]
}

export interface TimeAnalysisSummary {
  totalEstimated: number
  totalActual: number
  variance: number
  issuesTracked: number
}

export interface TimeAnalysisResponse {
  sprint: string
  summary: TimeAnalysisSummary
  members: TimeAnalysisMember[]
  issues: TimeAnalysisIssue[]
}

export interface CycleTimeTrend {
  sprint: string
  avgCycleTime: number
}

export interface CycleTimeAssignee {
  assignee: string
  avgCycleTime: number
  count: number
  rating: 'Good' | 'Fair' | 'Poor'
  items: { title: string; number: number; url: string; cycleTime: number }[]
}

export interface CycleTimeSummary {
  currentAvg: number
  allSprintAvg: number
  kpiRating: 'Good' | 'Fair' | 'Poor'
  issuesMeasured: number
}

export interface CycleTimeResponse {
  sprint: string
  summary: CycleTimeSummary
  trend: CycleTimeTrend[]
  assignees: CycleTimeAssignee[]
}

export interface CommitmentSprint {
  sprint: string
  committed: number
  delivered: number
  rate: number
  rating: 'Good' | 'Fair' | 'Poor'
}

export interface CommitmentSummary {
  effortRate: number
  issueRate: number
  kpiRating: 'Good' | 'Fair' | 'Poor'
  deliveryVsTarget: number
}

export interface CommitmentResponse {
  mode: 'points' | 'issues'
  summary: CommitmentSummary
  sprints: CommitmentSprint[]
}

export interface CommitAssigneeItem {
  title: string
  number: number
  url: string
  type: string
  status: string
  effort: number | null
  actual_time: number | null
}

export interface CommitAssigneeStat {
  assignee: string
  estimated: number
  actual: number
  rate: number
  count: number
  rating: 'Good' | 'Fair' | 'Poor'
  items: CommitAssigneeItem[]
}

export interface CommitAssigneeSummary {
  totalEstimated: number
  totalActual: number
  overallRate: number
  kpiRating: 'Good' | 'Fair' | 'Poor'
  assigneesCount: number
}

export interface CommitAssigneeResponse {
  sprint: string
  mode: 'points' | 'issues'
  summary: CommitAssigneeSummary
  assignees: CommitAssigneeStat[]
}

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

export interface DefectSummary {
  defectCount: number
  totalItems: number
  defectRate: number
  closedDefects: number
  openDefects: number
  kpiRating: 'Good' | 'Fair' | 'Poor'
}

export interface DefectResponse {
  sprint: string
  summary: DefectSummary
  trend: DefectTrendEntry[]
  assignees: DefectAssigneeStat[]
  items: BurndownItem[]
}

export interface ScorecardKpi {
  label: string
  value: string
  rating: 'Good' | 'Fair' | 'Poor'
  detail: string
}

export interface ScorecardSummary {
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

export interface ScorecardResponse {
  sprint: string
  summary: ScorecardSummary
  kpis: ScorecardKpi[]
}

export interface StabilitySprintMetric {
  sprint: string
  estimationAccuracy: number
  scopeCompletionRate: number
  deliveryRate: number
  velocity: number
}

export interface StabilitySummary {
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

export interface StabilityResponse {
  sprint: string
  summary: StabilitySummary
  sprintMetrics: StabilitySprintMetric[]
  trendLabels: string[]
  estimationTrend: number[]
  completionTrend: number[]
}

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

export interface KpiReviewAverages {
  deliveryRate: number
  cycleTime: number
  defectRate: number
  estimationAccuracy: number
  velocity: number
  scopeCompletionRate: number
}

export interface KpiReviewResponse {
  sprints: KpiReviewEntry[]
  averages: KpiReviewAverages
}

export interface ConfigResponse {
  [key: string]: string
}

export interface SprintsResponse {
  sprints: string[]
}
