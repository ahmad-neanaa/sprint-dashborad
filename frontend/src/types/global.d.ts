import type { 
  BurndownResponse, VelocityResponse, TeamResponse, OverviewResponse, 
  TimeAnalysisResponse, CycleTimeResponse, CommitmentResponse, 
  CommitAssigneeResponse, DefectResponse, ScorecardResponse, 
  StabilityResponse, KpiReviewResponse, ConfigResponse, 
  SprintsResponse, Project, TimesheetResponse 
} from './index'

declare global {
  interface Window {
    api: {
      getBurndown(args: any): Promise<BurndownResponse>
      getVelocity(args: any): Promise<VelocityResponse>
      getTeam(args: any): Promise<TeamResponse>
      getCommitmentAssignee(args: any): Promise<CommitAssigneeResponse>
      getKpiReview(args: any): Promise<KpiReviewResponse>
      getStability(args: any): Promise<StabilityResponse>
      getScorecard(args: any): Promise<ScorecardResponse>
      getDefects(args: any): Promise<DefectResponse>
      getCommitment(args: any): Promise<CommitmentResponse>
      getCycleTime(args: any): Promise<CycleTimeResponse>
      getTimeAnalysis(args: any): Promise<TimeAnalysisResponse>
      getOverview(args: any): Promise<OverviewResponse>
      getTimesheet(args: any): Promise<TimesheetResponse>
      getSprints(args: any): Promise<SprintsResponse>
      getIssueTypes(args: any): Promise<{ types: string[] }>
      getProjects(): Promise<Project[]>
      createProject(args: any): Promise<Project>
      updateProject(args: any): Promise<Project>
      deleteProject(args: any): Promise<void>
      getConfig(): Promise<ConfigResponse>
      updateConfig(args: any): Promise<void>
      putConfig(args: any): Promise<ConfigResponse>
      refreshData(args: any): Promise<{ message?: string; error?: string; details?: string }>
    }
  }
}
