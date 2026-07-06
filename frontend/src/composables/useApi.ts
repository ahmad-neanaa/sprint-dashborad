import { inject, provide, ref, type Ref } from 'vue'
import type { BurndownResponse, VelocityResponse, TeamResponse, OverviewResponse, TimeAnalysisResponse, CycleTimeResponse, CommitmentResponse, CommitAssigneeResponse, DefectResponse, ScorecardResponse, StabilityResponse, KpiReviewResponse, ConfigResponse, SprintsResponse, Project } from '@/types'

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

const BASE = '/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

function projectQuery(project?: string): string {
  return project ? `&project=${encodeURIComponent(project)}` : ''
}

function timeParams(sprint?: string | null, startDate?: string, endDate?: string): string {
  if (sprint) return `sprint=${encodeURIComponent(sprint)}`
  if (startDate && endDate) return `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  return ''
}

export function useApi() {
  function getBurndown(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string): Promise<BurndownResponse> {
    return fetchJson(`${BASE}/burndown?${timeParams(sprint, startDate, endDate)}&mode=${mode}${projectQuery(project)}`)
  }

  function getVelocity(mode: 'points' | 'issues' = 'points', project?: string): Promise<VelocityResponse> {
    return fetchJson(`${BASE}/velocity?mode=${mode}${projectQuery(project)}`)
  }

  function getTeam(sprint?: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string): Promise<TeamResponse> {
    const tp = timeParams(sprint, startDate, endDate)
    const pq = project ? `&project=${encodeURIComponent(project)}` : ''
    return fetchJson(`${BASE}/team?${tp}&mode=${mode}${pq}`)
  }

  function getCommitmentAssignee(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string): Promise<CommitAssigneeResponse> {
    return fetchJson(`${BASE}/commitment-assignee?${timeParams(sprint, startDate, endDate)}&mode=${mode}${projectQuery(project)}`)
  }

  function getKpiReview(project?: string): Promise<KpiReviewResponse> {
    return fetchJson(`${BASE}/kpi-review?${projectQuery(project)}`)
  }

  function getStability(sprint: string | null, project?: string, startDate?: string, endDate?: string): Promise<StabilityResponse> {
    return fetchJson(`${BASE}/stability?${timeParams(sprint, startDate, endDate)}${projectQuery(project)}`)
  }

  function getScorecard(sprint: string | null, project?: string, startDate?: string, endDate?: string): Promise<ScorecardResponse> {
    return fetchJson(`${BASE}/scorecard?${timeParams(sprint, startDate, endDate)}${projectQuery(project)}`)
  }

  function getDefects(sprint: string | null, project?: string, startDate?: string, endDate?: string): Promise<DefectResponse> {
    return fetchJson(`${BASE}/defects?${timeParams(sprint, startDate, endDate)}${projectQuery(project)}`)
  }

  function getCommitment(mode: 'points' | 'issues' = 'points', project?: string): Promise<CommitmentResponse> {
    return fetchJson(`${BASE}/commitment?mode=${mode}${projectQuery(project)}`)
  }

  function getCycleTime(sprint: string | null, project?: string, startDate?: string, endDate?: string): Promise<CycleTimeResponse> {
    return fetchJson(`${BASE}/cycletime?${timeParams(sprint, startDate, endDate)}${projectQuery(project)}`)
  }

  function getTimeAnalysis(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string): Promise<TimeAnalysisResponse> {
    return fetchJson(`${BASE}/timeanalysis?${timeParams(sprint, startDate, endDate)}&mode=${mode}${projectQuery(project)}`)
  }

  function getOverview(sprint: string | null, mode: 'points' | 'issues' = 'points', project?: string, startDate?: string, endDate?: string): Promise<OverviewResponse> {
    return fetchJson(`${BASE}/overview?${timeParams(sprint, startDate, endDate)}&mode=${mode}${projectQuery(project)}`)
  }

  function getSprints(project?: string): Promise<SprintsResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : ''
    return fetchJson(`${BASE}/sprints${qs}`)
  }

  function getProjects(): Promise<Project[]> {
    return fetchJson(`${BASE}/projects`)
  }

  async function createProject(data: Partial<Project> & { name: string; github_project_id: string }): Promise<Project> {
    const res = await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Create failed: ${res.status}`)
    }
    return res.json()
  }

  async function updateProject(data: Partial<Project> & { name: string }): Promise<Project> {
    const res = await fetch(`${BASE}/projects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Update failed: ${res.status}`)
    }
    return res.json()
  }

  async function deleteProject(name: string): Promise<void> {
    const res = await fetch(`${BASE}/projects?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Delete failed: ${res.status}`)
    }
  }

  function getConfig(): Promise<ConfigResponse> {
    return fetchJson(`${BASE}/config`)
  }

  async function updateConfig(key: string, value: string): Promise<void> {
    await fetch(`${BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  }

  async function putConfig(config: Record<string, string>): Promise<ConfigResponse> {
    const res = await fetch(`${BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error(`Config update failed: ${res.status}`)
    return res.json()
  }

  async function refreshData(project?: string): Promise<{ message?: string; error?: string; details?: string }> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : ''
    const res = await fetch(`${BASE}/refresh${qs}`, { method: 'POST' })
    const body = await res.json()
    if (!res.ok) throw new Error(body.details || body.error || 'Refresh failed')
    return body
  }

  return { getSprints, getBurndown, getVelocity, getTeam, getOverview, getTimeAnalysis, getCycleTime, getCommitment, getCommitmentAssignee, getDefects, getScorecard, getStability, getKpiReview, getConfig, updateConfig, putConfig, refreshData, getProjects, createProject, updateProject, deleteProject }
}
