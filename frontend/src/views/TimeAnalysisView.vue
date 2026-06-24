<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { TimeAnalysisResponse } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getTimeAnalysis } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<TimeAnalysisResponse | null>(null)
const loading = ref(false)
const error = ref('')
const expandedMembers = ref<Set<string>>(new Set())
const expandedIssues = ref(false)

function toggleMember(name: string) {
  const s = new Set(expandedMembers.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedMembers.value = s
}

function isMemberOpen(name: string): boolean {
  return expandedMembers.value.has(name)
}

const chartData = computed(() => {
  if (!data.value || data.value.members.length === 0) return null
  const labels = data.value.members.map((m) => m.assignee)
  return {
    labels,
    datasets: [
      {
        label: mode.value === 'points' ? 'Estimated (hrs)' : 'Items',
        data: data.value.members.map((m) => m.estimated),
        backgroundColor: '#0747a6',
        borderRadius: 3,
      },
      {
        label: mode.value === 'points' ? 'Actual (hrs)' : 'Closed',
        data: data.value.members.map((m) => m.actual),
        backgroundColor: '#00875a',
        borderRadius: 3,
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
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}${mode.value === 'points' ? ' hrs' : ''}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      beginAtZero: true,
      title: { display: true, text: mode.value === 'points' ? 'Hours' : 'Issues' },
    },
  },
}))

async function load() {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await getTimeAnalysis(sprint.value, mode.value, project.value || undefined)
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'closed') return 'status-done'
  if (s === 'in progress' || s === 'in review') return 'status-progress'
  if (s === 'to do' || s === 'backlog') return 'status-todo'
  return ''
}

function varianceClass(v: number | null): string {
  if (v == null) return ''
  return v > 0 ? 'var-neg' : v < 0 ? 'var-pos' : ''
}
function issuesVarianceClass(v: number | null): string {
  if (v == null) return ''
  return v < 0 ? 'var-neg' : ''
}

const { sprint, sprints, project } = useSprintSelector(load)
watch(mode, load)
</script>

<template>
  <div class="ta-page">
    <div class="ta-header">
      <h2>Time Analysis</h2>
      <div class="ta-controls">
        <div class="sprint-selector">
          <label>Sprint:</label>
          <select v-model="sprint" @change="load">
            <option v-for="s in sprints" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="mode-toggle">
          <button :class="{ active: mode === 'points' }" @click="mode = 'points'">Effort (hrs)</button>
          <button :class="{ active: mode === 'issues' }" @click="mode = 'issues'">Issues</button>
        </div>
        <button class="btn-refresh" @click="load" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
      <div class="summary-cards">
        <div class="card card--blue">
          <span class="card-label">{{ mode === 'points' ? 'Total Estimated' : 'Total Items' }}</span>
          <span class="card-value">{{ mode === 'points' ? data.summary.totalEstimated.toFixed(1) : data.summary.totalEstimated }}</span>
        </div>
        <div class="card card--green">
          <span class="card-label">{{ mode === 'points' ? 'Total Actual' : 'Total Closed' }}</span>
          <span class="card-value">{{ mode === 'points' ? data.summary.totalActual.toFixed(1) : data.summary.totalActual }}</span>
        </div>
        <div class="card" :class="data.summary.variance > 0 ? 'card--red' : 'card--green'">
          <span class="card-label">{{ mode === 'points' ? 'Variance' : 'Open Items' }}</span>
          <span class="card-value">{{ mode === 'points' ? (data.summary.variance > 0 ? '+' : '') + data.summary.variance.toFixed(1) : Math.abs(data.summary.variance) }}</span>
        </div>
        <div class="card">
          <span class="card-label">Issues Tracked</span>
          <span class="card-value">{{ data.summary.issuesTracked }}</span>
        </div>
      </div>

      <div class="chart-wrapper" v-if="chartData">
        <Bar :data="chartData" :options="chartOptions" />
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Assignee</th>
              <th>Issues</th>
              <th>{{ mode === 'points' ? 'Estimated' : 'Items' }}</th>
              <th>{{ mode === 'points' ? 'Actual' : 'Closed' }}</th>
              <th>{{ mode === 'points' ? 'Variance' : 'Open' }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in data.members" :key="m.assignee">
              <tr class="member-row" :class="{ expanded: isMemberOpen(m.assignee) }" @click="toggleMember(m.assignee)">
                <td class="expand-cell">
                  <span class="expand-icon" :class="{ open: isMemberOpen(m.assignee) }">&#9654;</span>
                </td>
                <td class="name-cell">{{ m.assignee }}</td>
                <td>{{ m.count }}</td>
                <td>{{ m.estimated.toFixed(1) }}</td>
                <td>{{ m.actual.toFixed(1) }}</td>
                <td :class="mode === 'issues' ? issuesVarianceClass(m.variance) : varianceClass(m.variance)">{{ mode === 'issues' ? m.variance : (m.variance > 0 ? '+' : '') + m.variance.toFixed(1) }}</td>
              </tr>
              <tr v-if="isMemberOpen(m.assignee) && m.items.length" class="detail-row">
                <td colspan="6">
                  <table class="sub-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Estimated</th>
                        <th>Actual</th>
                        <th>Variance</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in m.items" :key="item.number">
                        <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                        <td>{{ item.title }}</td>
                        <td><span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                        <td>{{ item.effort ?? '-' }}</td>
                        <td>{{ item.actual_time ?? '-' }}</td>
                        <td :class="varianceClass(item.variance)">{{ item.variance != null ? (item.variance > 0 ? '+' : '') + item.variance.toFixed(1) : '-' }}</td>
                        <td>
                          <span v-if="item.source === 'MAN'" class="source-badge source-man">MAN</span>
                          <span v-else-if="item.source === 'AUTO'" class="source-badge source-auto">AUTO</span>
                          <span v-else class="source-badge source-none">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="drawer">
        <button class="drawer-toggle" @click="expandedIssues = !expandedIssues">
          {{ expandedIssues ? 'Hide' : 'Show' }} All Issues ({{ data.issues.length }})
          <span class="drawer-arrow" :class="{ open: expandedIssues }">&#9654;</span>
        </button>
        <div v-if="expandedIssues" class="drawer-content">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>{{ mode === 'points' ? 'Estimated' : 'Item' }}</th>
                <th>{{ mode === 'points' ? 'Actual' : 'Closed' }}</th>
                <th>{{ mode === 'points' ? 'Variance' : 'Open' }}</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.issues" :key="item.number">
                <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                <td>{{ item.title }}</td>
                <td>{{ item.type }}</td>
                <td><span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                <td>{{ item.assignee ?? '-' }}</td>
                <td>{{ item.effort ?? '-' }}</td>
                <td>{{ item.actual_time ?? '-' }}</td>
                <td :class="mode === 'issues' ? issuesVarianceClass(item.variance) : varianceClass(item.variance)">{{ item.variance != null ? (mode === 'issues' ? (item.variance < 0 ? 'Open' : 'Done') : (item.variance > 0 ? '+' : '') + item.variance.toFixed(1)) : '-' }}</td>
                <td>
                  <span v-if="item.source === 'MAN'" class="source-badge source-man">MAN</span>
                  <span v-else-if="item.source === 'AUTO'" class="source-badge source-auto">AUTO</span>
                  <span v-else class="source-badge source-none">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <p v-else-if="!loading && !error">No data for this sprint.</p>
  </div>
</template>

<style scoped>
.ta-page { display: flex; flex-direction: column; gap: 20px; }

.ta-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }

.ta-controls { display: flex; gap: 10px; align-items: center; }

.btn-refresh { padding: 7px 14px; border: 1px solid #dfe1e6; background: #fff; border-radius: 3px; font-size: 13px; cursor: pointer; }

.btn-refresh:hover { background: #f4f5f7; }

.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

.error { color: #de350b; }

.summary-cards { display: flex; gap: 14px; flex-wrap: wrap; }

.card { flex: 1; min-width: 120px; background: #fff; border-radius: 4px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 4px; }

.card-label { font-size: 12px; text-transform: uppercase; color: #5e6c84; font-weight: 600; letter-spacing: 0.3px; }

.card-value { font-size: 22px; font-weight: 700; }

.card--blue .card-value { color: #0747a6; }
.card--green .card-value { color: #00875a; }
.card--red .card-value { color: #de350b; }

.chart-wrapper { background: #fff; border-radius: 4px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: 360px; }

.table-wrapper, .drawer { background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }

.data-table { width: 100%; border-collapse: collapse; }

.data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 13px; }

.data-table th { background: #f4f5f7; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #5e6c84; }

.member-row { cursor: pointer; transition: background 0.15s; }
.member-row:hover { background: #f4f5f7; }
.member-row.expanded { background: #eae6ff; }

.name-cell { font-weight: 600; }
.expand-cell { width: 28px; text-align: center; }
.expand-icon { font-size: 10px; display: inline-block; transition: transform 0.2s; color: #5e6c84; }
.expand-icon.open { transform: rotate(90deg); }

.detail-row td { padding: 0; background: #fafbfc; }
.sub-table { width: 100%; border-collapse: collapse; }
.sub-table th, .sub-table td { padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #e8e8e8; }
.sub-table th { background: #f0f1f3; font-size: 11px; }

.drawer-toggle { width: 100%; padding: 12px 16px; background: #f4f5f7; border: none; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.drawer-toggle:hover { background: #e9ecf0; }
.drawer-arrow { font-size: 10px; transition: transform 0.2s; }
.drawer-arrow.open { transform: rotate(90deg); }
.drawer-content { padding: 0; }

.issue-link { color: #0747a6; text-decoration: none; font-weight: 600; }
.issue-link:hover { text-decoration: underline; }

.status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
.status-done { background: #e3fcef; color: #006644; }
.status-progress { background: #eae6ff; color: #403294; }
.status-todo { background: #f4f5f7; color: #5e6c84; }

.source-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
.source-man { background: #eae6ff; color: #403294; }
.source-auto { background: #e3fcef; color: #006644; }
.source-none { background: #f4f5f7; color: #5e6c84; }

.var-pos { color: #00875a; font-weight: 600; }
.var-neg { color: #de350b; font-weight: 600; }
</style>
