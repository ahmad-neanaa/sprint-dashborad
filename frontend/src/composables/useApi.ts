import type { BurndownResponse, VelocityResponse, TeamResponse, OverviewResponse, TimeAnalysisResponse, CycleTimeResponse, CommitmentResponse, CommitAssigneeResponse, DefectResponse, ScorecardResponse, StabilityResponse, KpiReviewResponse, ConfigResponse, SprintsResponse } from '@/types'


const BASE = '/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function useApi() {
  function getBurndown(sprint: string, mode: 'points' | 'issues' = 'points'): Promise<BurndownResponse> {
    return fetchJson(`${BASE}/burndown?sprint=${encodeURIComponent(sprint)}&mode=${mode}`)
  }

  function getVelocity(mode: 'points' | 'issues' = 'points'): Promise<VelocityResponse> {
    return fetchJson(`${BASE}/velocity?mode=${mode}`)
  }

  function getTeam(sprint?: string): Promise<TeamResponse> {
    const qs = sprint ? `?sprint=${encodeURIComponent(sprint)}` : ''
    return fetchJson(`${BASE}/team${qs}`)
  }

  function getCommitmentAssignee(sprint: string, mode: 'points' | 'issues' = 'points'): Promise<CommitAssigneeResponse> {
    return fetchJson(`${BASE}/commitment-assignee?sprint=${encodeURIComponent(sprint)}&mode=${mode}`)
  }

  function getKpiReview(): Promise<KpiReviewResponse> {
    return fetchJson(`${BASE}/kpi-review`)
  }

  function getStability(sprint: string): Promise<StabilityResponse> {
    return fetchJson(`${BASE}/stability?sprint=${encodeURIComponent(sprint)}`)
  }

  function getScorecard(sprint: string): Promise<ScorecardResponse> {
    return fetchJson(`${BASE}/scorecard?sprint=${encodeURIComponent(sprint)}`)
  }

  function getDefects(sprint: string): Promise<DefectResponse> {
    return fetchJson(`${BASE}/defects?sprint=${encodeURIComponent(sprint)}`)
  }

  function getCommitment(mode: 'points' | 'issues' = 'points'): Promise<CommitmentResponse> {
    return fetchJson(`${BASE}/commitment?mode=${mode}`)
  }

  function getCycleTime(sprint: string): Promise<CycleTimeResponse> {
    return fetchJson(`${BASE}/cycletime?sprint=${encodeURIComponent(sprint)}`)
  }

  function getTimeAnalysis(sprint: string): Promise<TimeAnalysisResponse> {
    return fetchJson(`${BASE}/timeanalysis?sprint=${encodeURIComponent(sprint)}`)
  }

  function getOverview(sprint: string): Promise<OverviewResponse> {
    return fetchJson(`${BASE}/overview?sprint=${encodeURIComponent(sprint)}`)
  }

  function getSprints(): Promise<SprintsResponse> {
    return fetchJson(`${BASE}/sprints`)
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

  async function refreshData(): Promise<void> {
    await fetch(`${BASE}/refresh`, { method: 'POST' })
  }

  return { getSprints, getBurndown, getVelocity, getTeam, getOverview, getTimeAnalysis, getCycleTime, getCommitment, getCommitmentAssignee, getDefects, getScorecard, getStability, getKpiReview, getConfig, updateConfig, putConfig, refreshData }
}
