<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import type { KpiReviewResponse, KpiReviewEntry } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getKpiReview } = useApi()

const data = ref<KpiReviewResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getKpiReview()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)

function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

function ratingBadge(rating: string) {
  if (rating === 'Good') return '\u2713'
  if (rating === 'Fair') return '\u26A0'
  return '\u2717'
}

const bestSprint = computed(() => {
  if (!data.value || data.value.sprints.length === 0) return null
  const sorted = [...data.value.sprints].sort((a, b) => {
    const scoreA = [a.deliveryKpi, a.cycleKpi, a.defectKpi, a.estimationKpi].filter((r) => r === 'Good').length
    const scoreB = [b.deliveryKpi, b.cycleKpi, b.defectKpi, b.estimationKpi].filter((r) => r === 'Good').length
    return scoreB - scoreA
  })
  return sorted[0]
})

const trendDir = computed(() => {
  if (!data.value || data.value.sprints.length < 2) return 'neutral'
  const last = data.value.sprints[data.value.sprints.length - 1]
  const prev = data.value.sprints[data.value.sprints.length - 2]
  const score = (e: KpiReviewEntry) => [e.deliveryKpi, e.cycleKpi, e.defectKpi, e.estimationKpi]
  const lastScore = score(last).filter((r) => r === 'Good' || r === 'Fair').length
  const prevScore = score(prev).filter((r) => r === 'Good' || r === 'Fair').length
  if (lastScore > prevScore) return 'up'
  if (lastScore < prevScore) return 'down'
  return 'neutral'
})

const barrChartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  return {
    labels: data.value.sprints.map((s) => s.sprint),
    datasets: [
      {
        label: 'Delivery Rate %',
        backgroundColor: '#3b82f6',
        data: data.value.sprints.map((s) => s.deliveryRate),
      },
      {
        label: 'Defect Rate %',
        backgroundColor: '#ef4444',
        data: data.value.sprints.map((s) => s.defectRate),
      },
      {
        label: 'Estimation Accuracy %',
        backgroundColor: '#22c55e',
        data: data.value.sprints.map((s) => s.estimationAccuracy),
      },
      {
        label: 'Scope Completion %',
        backgroundColor: '#a855f7',
        data: data.value.sprints.map((s) => s.scopeCompletionRate),
      },
    ],
  }
})

const chartOptions = computed(() => ({
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

function sprintTrend(entries: KpiReviewEntry[], idx: number, key: keyof Pick<KpiReviewEntry, 'deliveryRate' | 'defectRate' | 'estimationAccuracy' | 'scopeCompletionRate' | 'cycleTime' | 'velocity'>): string {
  if (idx === 0) return '\u2014'
  const curr = entries[idx][key] as number
  const prev = entries[idx - 1][key] as number
  const diff = Math.round((curr - prev) * 10) / 10
  if (diff > 0) return `\u25B2 +${diff}`
  if (diff < 0) return `\u25BC ${diff}`
  return '\u25C6'
}

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
      <h2 class="view-title">KPI Review</h2>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <template v-if="data">
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Sprints Tracked</div>
          <div class="kpi-value">{{ data.sprints.length }}</div>
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
            <span v-if="trendDir === 'up'" class="text-green">\u2191 Improving</span>
            <span v-else-if="trendDir === 'down'" class="text-red">\u2193 Declining</span>
            <span v-else>\u2192 Stable</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg Delivery</div>
          <div class="kpi-value">{{ data.averages.deliveryRate }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg Defect Rate</div>
          <div class="kpi-value">{{ data.averages.defectRate }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg Velocity</div>
          <div class="kpi-value">{{ data.averages.velocity }}h</div>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <h3 class="card-title">Sprint Comparison</h3>
        <div style="height: 300px">
          <Bar :data="barrChartData" :options="chartOptions" />
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
              <tr v-for="(s, i) in data.sprints" :key="s.sprint">
                <td class="sprint-name">{{ s.sprint }}</td>
                <td>
                  <span :class="ratingClass(s.deliveryKpi)">{{ s.deliveryRate }}%</span>
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'deliveryRate').cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'deliveryRate').label }}</span>
                </td>
                <td>
                  <span :class="ratingClass(s.cycleKpi)">{{ s.cycleTime }}d</span>
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'cycleTime', true).cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'cycleTime', true).label }}</span>
                </td>
                <td>
                  <span :class="ratingClass(s.defectKpi)">{{ s.defectRate }}%</span>
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'defectRate', true).cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'defectRate', true).label }}</span>
                </td>
                <td>
                  <span :class="ratingClass(s.estimationKpi)">{{ s.estimationAccuracy }}%</span>
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'estimationAccuracy').cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'estimationAccuracy').label }}</span>
                </td>
                <td>
                  {{ s.velocity }}h
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'velocity').cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'velocity').label }}</span>
                </td>
                <td>
                  {{ s.scopeCompletionRate }}%
                  <span v-if="i > 0" :class="cellDiff(data.sprints, i, 'scopeCompletionRate').cls" class="diff-indicator">{{ cellDiff(data.sprints, i, 'scopeCompletionRate').label }}</span>
                </td>
                <td><span :class="ratingClass(s.overallKpi)">{{ ratingBadge(s.overallKpi) }} {{ s.overallKpi }}</span></td>
              </tr>
            </tbody>
            <tfoot v-if="data.sprints.length > 0">
              <tr class="avg-row">
                <td><strong>Average</strong></td>
                <td><strong>{{ data.averages.deliveryRate }}%</strong></td>
                <td><strong>{{ data.averages.cycleTime }}d</strong></td>
                <td><strong>{{ data.averages.defectRate }}%</strong></td>
                <td><strong>{{ data.averages.estimationAccuracy }}%</strong></td>
                <td><strong>{{ data.averages.velocity }}h</strong></td>
                <td><strong>{{ data.averages.scopeCompletionRate }}%</strong></td>
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
              <span class="bar good">\u226585%</span>
              <span class="bar fair">\u226570%</span>
              <span class="bar poor">&lt;70%</span>
            </div>
          </div>
          <div class="threshold-item">
            <div class="threshold-label">Cycle Time</div>
            <div class="threshold-bars">
              <span class="bar good">\u22643d</span>
              <span class="bar fair">\u22647d</span>
              <span class="bar poor">&gt;7d</span>
            </div>
          </div>
          <div class="threshold-item">
            <div class="threshold-label">Defect Rate</div>
            <div class="threshold-bars">
              <span class="bar good">\u226415%</span>
              <span class="bar fair">\u226430%</span>
              <span class="bar poor">&gt;30%</span>
            </div>
          </div>
          <div class="threshold-item">
            <div class="threshold-label">Estimation Accuracy</div>
            <div class="threshold-bars">
              <span class="bar good">\u226510% var</span>
              <span class="bar fair">\u226525% var</span>
              <span class="bar poor">&gt;25% var</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-detail { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.text-green { color: #22c55e; }
.text-red { color: #ef4444; }
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
