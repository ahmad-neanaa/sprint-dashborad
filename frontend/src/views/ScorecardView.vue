<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { ScorecardResponse, KpiReviewResponse, KpiReviewEntry } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getScorecard, getKpiReview } = useApi()

const data = ref<ScorecardResponse | null>(null)
const historyData = ref<KpiReviewResponse | null>(null)
const error = ref('')
const loading = ref(false)

// Tabs: 'sprint' (Current Sprint Scorecard) or 'history' (Historical KPI Review)
const activeSubView = ref<'sprint' | 'history'>('sprint')

async function loadScorecard() {
  try {
    data.value = await getScorecard(
      selectionMode.value === 'sprint' ? sprint.value : null,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
  } catch (e) {
    error.value = String(e)
  }
}

async function loadHistory() {
  try {
    historyData.value = await getKpiReview(project.value || undefined)
  } catch (e) {
    console.error('Failed to load KPI history:', e)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  await Promise.all([loadScorecard(), loadHistory()])
  loading.value = false
}

const { sprint, sprints: sprintList, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(load)

// Helper ratings
function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

function ratingIcon(rating: string) {
  if (rating === 'Good') return '\u2713'
  if (rating === 'Fair') return '\u26A0'
  return '\u2717'
}

// History Computations
const bestSprint = computed(() => {
  if (!historyData.value || historyData.value.sprints.length === 0) return null
  const sorted = [...historyData.value.sprints].sort((a, b) => {
    const scoreA = [a.deliveryKpi, a.cycleKpi, a.defectKpi, a.estimationKpi].filter((r) => r === 'Good').length
    const scoreB = [b.deliveryKpi, b.cycleKpi, b.defectKpi, b.estimationKpi].filter((r) => r === 'Good').length
    return scoreB - scoreA
  })
  return sorted[0]
})

const trendDir = computed(() => {
  if (!historyData.value || historyData.value.sprints.length < 2) return 'neutral'
  const last = historyData.value.sprints[historyData.value.sprints.length - 1]
  const prev = historyData.value.sprints[historyData.value.sprints.length - 2]
  const score = (e: KpiReviewEntry) => [e.deliveryKpi, e.cycleKpi, e.defectKpi, e.estimationKpi]
  const lastScore = score(last).filter((r) => r === 'Good' || r === 'Fair').length
  const prevScore = score(prev).filter((r) => r === 'Good' || r === 'Fair').length
  if (lastScore > prevScore) return 'up'
  if (lastScore < prevScore) return 'down'
  return 'neutral'
})

const historyChartData = computed(() => {
  if (!historyData.value) return { labels: [], datasets: [] }
  return {
    labels: historyData.value.sprints.map((s) => s.sprint),
    datasets: [
      {
        label: 'Delivery Rate %',
        backgroundColor: '#3b82f6',
        data: historyData.value.sprints.map((s) => s.deliveryRate),
      },
      {
        label: 'Defect Rate %',
        backgroundColor: '#ef4444',
        data: historyData.value.sprints.map((s) => s.defectRate),
      },
      {
        label: 'Estimation Accuracy %',
        backgroundColor: '#22c55e',
        data: historyData.value.sprints.map((s) => s.estimationAccuracy),
      },
      {
        label: 'Scope Completion %',
        backgroundColor: '#a855f7',
        data: historyData.value.sprints.map((s) => s.scopeCompletionRate),
      },
    ],
  }
})

const historyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      title: { display: true, text: 'Percentage' },
    },
  },
}))

function trendClass(diff: number, inverse: boolean = false): string {
  if (diff > 0) return inverse ? 'text-red' : 'text-green'
  if (diff < 0) return inverse ? 'text-green' : 'text-red'
  return ''
}

function cellDiff(entries: KpiReviewEntry[], idx: number, key: keyof Pick<KpiReviewEntry, 'deliveryRate' | 'defectRate' | 'estimationAccuracy' | 'scopeCompletionRate' | 'cycleTime' | 'velocity'>, inverse: boolean = false): { diff: number; cls: string; label: string } {
  if (idx === 0) return { diff: 0, cls: '', label: '' }
  const curr = entries[idx][key] as number
  const prev = entries[idx - 1][key] as number
  const diff = Math.round((curr - prev) * 10) / 10
  const sign = diff > 0 ? '+' : ''
  return { diff, cls: trendClass(diff, inverse), label: `${sign}${diff}` }
}
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Scorecard &amp; KPIs</h2>
      
      <!-- TimeSelector only relevant when showing single sprint scorecard -->
      <TimeSelector
        v-if="activeSubView === 'sprint'"
        v-model:selectionMode="selectionMode"
        v-model:sprint="sprint"
        :sprints="sprintList"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:issueType="issueType"
        :issueTypes="issueTypes"
        @change="loadScorecard"
      />
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="control-row">
      <div class="tabs">
        <button :class="{ active: activeSubView === 'sprint' }" @click="activeSubView = 'sprint'">Sprint Scorecard</button>
        <button :class="{ active: activeSubView === 'history' }" @click="activeSubView = 'history'">Historical Review</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Loading metrics...</div>

    <template v-else>
      <!-- SPRINT SCORECARD -->
      <div v-if="activeSubView === 'sprint' && data">
        <div class="overall-rating-card" :class="data.summary.overallRating.toLowerCase()">
          <div class="overall-label">Overall Health</div>
          <div class="overall-value">{{ data.summary.overallRating }}</div>
        </div>

        <div class="kpi-grid">
          <div v-for="kpi in data.kpis" :key="kpi.label" class="kpi-card scorecard-kpi" :class="kpi.rating.toLowerCase()">
            <div class="kpi-header">
              <span class="kpi-icon">{{ ratingIcon(kpi.rating) }}</span>
              <span class="kpi-label">{{ kpi.label }}</span>
            </div>
            <div class="kpi-value">{{ kpi.value }}</div>
            <div class="kpi-detail">{{ kpi.detail }}</div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">Sprint Details</h3>
          <table class="styled-table">
            <tbody>
              <tr><td>Burndown Progress</td><td>{{ data.summary.burndownPct }}%</td></tr>
              <tr><td>Issues Completed</td><td>{{ data.summary.issuesCompleted }} / {{ data.summary.issuesTotal }}</td></tr>
              <tr><td>Days Left</td><td>{{ data.summary.daysLeft }}</td></tr>
              <tr><td>Active Members</td><td>{{ data.summary.activeMembers }}</td></tr>
              <tr><td>Issues at Risk</td><td>{{ data.summary.issuesAtRisk }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- HISTORICAL REVIEW -->
      <div v-if="activeSubView === 'history' && historyData">
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Sprints Tracked</div>
            <div class="kpi-value">{{ historyData.sprints.length }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Best Sprint</div>
            <div class="kpi-value">{{ bestSprint?.sprint ?? '-' }}</div>
            <div class="kpi-detail" v-if="bestSprint">
              <span :class="ratingClass(bestSprint.overallKpi)">{{ bestSprint.overallKpi }}</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Trend</div>
            <div class="kpi-value">
              <span v-if="trendDir === 'up'" class="text-green">↑ Improving</span>
              <span v-else-if="trendDir === 'down'" class="text-red">↓ Declining</span>
              <span v-else>→ Stable</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg Delivery</div>
            <div class="kpi-value">{{ historyData.averages.deliveryRate }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg Defect Rate</div>
            <div class="kpi-value">{{ historyData.averages.defectRate }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg Velocity</div>
            <div class="kpi-value">{{ historyData.averages.velocity }}h</div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">Sprint Comparison Trend</h3>
          <div style="height: 300px">
            <Bar :data="historyChartData" :options="historyChartOptions" />
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">All Sprints</h3>
          <div class="table-wrapper">
            <table class="styled-table compact">
              <thead>
                <tr>
                  <th>Sprint</th>
                  <th>Delivery Rate</th>
                  <th>Cycle Time</th>
                  <th>Defect Rate</th>
                  <th>Est. Accuracy</th>
                  <th>Velocity</th>
                  <th>Scope Done</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in historyData.sprints" :key="s.sprint">
                  <td class="sprint-name">{{ s.sprint }}</td>
                  <td>
                    <span :class="ratingClass(s.deliveryKpi)">{{ s.deliveryRate }}%</span>
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'deliveryRate').cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'deliveryRate').label }}</span>
                  </td>
                  <td>
                    <span :class="ratingClass(s.cycleKpi)">{{ s.cycleTime }}d</span>
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'cycleTime', true).cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'cycleTime', true).label }}</span>
                  </td>
                  <td>
                    <span :class="ratingClass(s.defectKpi)">{{ s.defectRate }}%</span>
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'defectRate', true).cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'defectRate', true).label }}</span>
                  </td>
                  <td>
                    <span :class="ratingClass(s.estimationKpi)">{{ s.estimationAccuracy }}%</span>
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'estimationAccuracy').cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'estimationAccuracy').label }}</span>
                  </td>
                  <td>
                    {{ s.velocity }}h
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'velocity').cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'velocity').label }}</span>
                  </td>
                  <td>
                    {{ s.scopeCompletionRate }}%
                    <span v-if="i > 0" :class="cellDiff(historyData.sprints, i, 'scopeCompletionRate').cls" class="diff-indicator">{{ cellDiff(historyData.sprints, i, 'scopeCompletionRate').label }}</span>
                  </td>
                  <td><span :class="ratingClass(s.overallKpi)">{{ ratingIcon(s.overallKpi) }} {{ s.overallKpi }}</span></td>
                </tr>
              </tbody>
              <tfoot v-if="historyData.sprints.length > 0">
                <tr class="avg-row">
                  <td><strong>Average</strong></td>
                  <td><strong>{{ historyData.averages.deliveryRate }}%</strong></td>
                  <td><strong>{{ historyData.averages.cycleTime }}d</strong></td>
                  <td><strong>{{ historyData.averages.defectRate }}%</strong></td>
                  <td><strong>{{ historyData.averages.estimationAccuracy }}%</strong></td>
                  <td><strong>{{ historyData.averages.velocity }}h</strong></td>
                  <td><strong>{{ historyData.averages.scopeCompletionRate }}%</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">KPI Thresholds</h3>
          <div class="thresholds-grid">
            <div class="threshold-item">
              <div class="threshold-label">Delivery Rate</div>
              <div class="threshold-bars">
                <span class="bar good">≥85%</span>
                <span class="bar fair">≥70%</span>
                <span class="bar poor">&lt;70%</span>
              </div>
            </div>
            <div class="threshold-item">
              <div class="threshold-label">Cycle Time</div>
              <div class="threshold-bars">
                <span class="bar good">≤3d</span>
                <span class="bar fair">≤7d</span>
                <span class="bar poor">&gt;7d</span>
              </div>
            </div>
            <div class="threshold-item">
              <div class="threshold-label">Defect Rate</div>
              <div class="threshold-bars">
                <span class="bar good">≤15%</span>
                <span class="bar fair">≤30%</span>
                <span class="bar poor">&gt;30%</span>
              </div>
            </div>
            <div class="threshold-item">
              <div class="threshold-label">Estimation Accuracy</div>
              <div class="threshold-bars">
                <span class="bar good">≤10% var</span>
                <span class="bar fair">≤25% var</span>
                <span class="bar poor">&gt;25% var</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.control-row {
  display: flex;
  margin-bottom: 20px;
}
.tabs {
  display: flex;
  background: #ebeef2;
  border-radius: 4px;
  padding: 2px;
}
.tabs button {
  border: none;
  background: none;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #505f79;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s;
}
.tabs button:hover {
  background: rgba(255, 255, 255, 0.4);
}
.tabs button.active {
  background: #fff;
  color: #0747a6;
  box-shadow: 0 1px 3px rgba(9, 30, 66, 0.08);
}

/* Scorecard styles */
.overall-rating-card {
  text-align: center;
  padding: 36px;
  border-radius: 12px;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  margin-bottom: 20px;
}
.overall-rating-card.good { background: linear-gradient(135deg, #22c55e, #16a34a); }
.overall-rating-card.fair { background: linear-gradient(135deg, #f59e0b, #d97706); }
.overall-rating-card.poor { background: linear-gradient(135deg, #ef4444, #dc2626); }
.overall-label { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px; }
.overall-value { font-size: 52px; letter-spacing: 2px; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.scorecard-kpi {
  border-left: 4px solid #555;
}
.scorecard-kpi.good { border-left-color: #22c55e; }
.scorecard-kpi.fair { border-left-color: #f59e0b; }
.scorecard-kpi.poor { border-left-color: #ef4444; }
.kpi-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.kpi-icon { font-size: 18px; }
.kpi-detail { font-size: 12px; color: #94a3b8; margin-top: 4px; }

/* History styles */
.table-wrapper { overflow-x: auto; }
.styled-table.compact td, .styled-table.compact th { padding: 8px 10px; font-size: 13px; }
.styled-table.compact tbody tr:hover { background: #f0f4ff; }
.sprint-name { font-weight: 600; color: #0747a6; }
.diff-indicator { font-size: 11px; margin-left: 4px; font-weight: 500; }
.avg-row { background: #f0f4ff; }
.avg-row td { border-top: 2px solid #0747a6; }

.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.threshold-item {
  background: #f8f9fb;
  border-radius: 8px;
  padding: 12px 16px;
}
.threshold-label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: #475569;
}
.threshold-bars {
  display: flex;
  gap: 6px;
}
.threshold-bars .bar {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}
.bar.good { background: #dcfce7; color: #16a34a; }
.bar.fair { background: #fef3c7; color: #d97706; }
.bar.poor { background: #fee2e2; color: #dc2626; }
</style>
