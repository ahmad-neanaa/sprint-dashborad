import { inject, provide, ref, type Ref } from 'vue'
import type { BurndownResponse, VelocityResponse, TeamResponse, OverviewResponse, TimeAnalysisResponse, CycleTimeResponse, CommitmentResponse, CommitAssigneeResponse, DefectResponse, ScorecardResponse, StabilityResponse, KpiReviewResponse, ConfigResponse, SprintsResponse, Project, TimesheetResponse } from '@/types'

export const REFRESH_KEY = Symbol('refresh')
export const PROJECT_KEY = Symbol('selectedProject')

export function useProvideRefresh() {
  const signal = ref(0)
  provide(REFRESH_KEY, signal)
  function bump() { signal.value++ }
  return { bump }
}

export function useRefreshSignal(): Ref<number> {
  return inject(REFRESH_KEY, ref(0))
}

export function useProvideProject() {
  const project = ref('')
  provide(PROJECT_KEY, project)
  return { project }
}

export function useSelectedProject(): Ref<string> {
  return inject(PROJECT_KEY, ref(''))
}

export function useApi() {
  function getBurndown(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<BurndownResponse> {
    return window.api.getBurndown({ sprint, mode, project, startDate, endDate, issueType })
  }

  function getVelocity(mode: 'points' | 'issues' = 'points', project?: string, issueType?: string): Promise<VelocityResponse> {
    return window.api.getVelocity({ mode, project, issueType })
  }

  function getTeam(sprint?: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<TeamResponse> {
    return window.api.getTeam({ sprint, mode, project, startDate, endDate, issueType })
  }

  function getCommitmentAssignee(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<CommitAssigneeResponse> {
    return window.api.getCommitmentAssignee({ sprint, mode, project, startDate, endDate, issueType })
  }

  function getKpiReview(project?: string): Promise<KpiReviewResponse> {
    return window.api.getKpiReview({ project })
  }

  function getStability(sprint: string | null, project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<StabilityResponse> {
    return window.api.getStability({ sprint, project, startDate, endDate, issueType })
  }

  function getScorecard(sprint: string | null, project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<ScorecardResponse> {
    return window.api.getScorecard({ sprint, project, startDate, endDate, issueType })
  }

  function getDefects(sprint: string | null, project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<DefectResponse> {
    return window.api.getDefects({ sprint, project, startDate, endDate, issueType })
  }

  function getCommitment(mode: 'points' | 'issues' = 'points', project?: string, issueType?: string): Promise<CommitmentResponse> {
    return window.api.getCommitment({ mode, project, issueType })
  }

  function getCycleTime(sprint: string | null, project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<CycleTimeResponse> {
    return window.api.getCycleTime({ sprint, project, startDate, endDate, issueType })
  }

  function getTimeAnalysis(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<TimeAnalysisResponse> {
    return window.api.getTimeAnalysis({ sprint, mode, project, startDate, endDate, issueType })
  }

  function getOverview(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<OverviewResponse> {
    return window.api.getOverview({ sprint, mode, project, startDate, endDate, issueType })
  }

  function getTimesheet(sprint: string | null, project?: string, startDate?: string, endDate?: string, issueType?: string): Promise<TimesheetResponse> {
    return window.api.getTimesheet({ sprint, project, startDate, endDate, issueType })
  }

  function getSprints(project?: string): Promise<SprintsResponse> {
    return window.api.getSprints({ project })
  }

  function getIssueTypes(project?: string): Promise<{ types: string[] }> {
    return window.api.getIssueTypes({ project })
  }

  function getProjects(): Promise<Project[]> {
    return window.api.getProjects()
  }

  async function createProject(data: Partial<Project> & { name: string; github_project_id: string }): Promise<Project> {
    return window.api.createProject(data)
  }

  async function updateProject(data: Partial<Project> & { name: string }): Promise<Project> {
    return window.api.updateProject(data)
  }

  async function deleteProject(name: string): Promise<void> {
    return window.api.deleteProject({ name })
  }

  function getConfig(): Promise<ConfigResponse> {
    return window.api.getConfig()
  }

  async function updateConfig(key: string, value: string): Promise<void> {
    return window.api.updateConfig({ key, value })
  }

  async function putConfig(config: Record<string, string>): Promise<ConfigResponse> {
    return window.api.putConfig(config)
  }

  async function refreshData(project?: string): Promise<{ message?: string; error?: string; details?: string }> {
    return window.api.refreshData({ project })
  }

  return { getSprints, getIssueTypes, getBurndown, getVelocity, getTeam, getOverview, getTimeAnalysis, getCycleTime, getCommitment, getCommitmentAssignee, getDefects, getScorecard, getStability, getKpiReview, getConfig, updateConfig, putConfig, refreshData, getProjects, createProject, updateProject, deleteProject, getTimesheet }
}
