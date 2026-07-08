<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import { useApi } from '@/composables/useApi'
import { useProjectWatcher } from '@/composables/useSprintSelector'
import type { VelocityResponse, BurndownItem } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const { getVelocity, getIssueTypes } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<VelocityResponse | null>(null)
const loading = ref(false)
const error = ref('')
const drawerOpen = ref(false)
const issueType = ref('')
const issueTypes = ref<string[]>([])

async function loadIssueTypes() {
  try {
    const r = await getIssueTypes(project.value || undefined)
    issueTypes.value = r.types
  } catch {
    issueTypes.value = []
  }
}

const chartData = computed(() => {
  if (!data.value || data.value.velocity.length === 0) return null
  const labels = data.value.velocity.map((v) => v.sprint)
  const unit = mode.value === 'points' ? 'hrs' : ''

  const datasets: any[] = [
    {
      type: 'bar',
      label: `Completed (${unit})`,
      backgroundColor: '#0747a6',
      borderRadius: 3,
      data: data.value.velocity.map((v) => v.completed),
      yAxisID: 'y',
      order: 2,
    },
  ]

  if (data.value.average > 0) {
    datasets.push({
      type: 'line',
      label: `Average (${data.value.average}${unit})`,
      data: Array(labels.length).fill(data.value.average),
      borderColor: '#00875a',
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderDash: [6, 4],
      borderWidth: 2,
      yAxisID: 'y',
      order: 1,
    })
  }

  if (data.value.target > 0) {
    datasets.push({
      type: 'line',
      label: `Target (${data.value.target}${unit})`,
      data: Array(labels.length).fill(data.value.target),
      borderColor: '#de350b',
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderDash: [2, 3],
      borderWidth: 2,
      yAxisID: 'y',
      order: 1,
    })
  }

  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const val = ctx.parsed.y
          return `${ctx.dataset.label}: ${val}${mode.value === 'points' ? ' hrs' : ''}`
        },
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: mode.value === 'points' ? 'Hours' : 'Issue Count',
      },
    },
  },
}

async function load() {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await getVelocity(mode.value, project.value || undefined, issueType.value || undefined)
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function diffClass(val: number): string {
  if (val > 0) return 'diff-pos'
  if (val < 0) return 'diff-neg'
  return ''
}

const { project } = useProjectWatcher(async () => {
  issueType.value = ''
  await loadIssueTypes()
  await load()
})

watch(mode, load)
watch(issueType, load)
</script>

<template>
  <div class="velocity-page">
    <div class="velocity-header">
      <h2>Velocity</h2>
      <div class="velocity-controls">
        <div class="type-filter">
          <label for="type-select">Type:</label>
          <select id="type-select" v-model="issueType">
            <option value="">All Types</option>
            <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
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
          <span class="card-label">Avg Velocity</span>
          <span class="card-value">{{ data.average }}</span>
        </div>
        <div class="card" v-if="data.currentSprint">
          <span class="card-label">Current ({{ data.currentSprint.title }})</span>
          <span class="card-value">{{ data.currentSprint.completed }}</span>
        </div>
        <div class="card card--green" v-if="data.bestSprint">
          <span class="card-label">Best Sprint</span>
          <span class="card-value">{{ data.bestSprint.completed }}</span>
          <span class="card-sub">{{ data.bestSprint.sprint }}</span>
        </div>
        <div class="card">
          <span class="card-label">Sprints Tracked</span>
          <span class="card-value">{{ data.sprintCount }}</span>
        </div>
      </div>

      <div class="chart-wrapper" v-if="chartData">
        <Bar :data="chartData" :options="chartOptions" />
      </div>

      <div class="drawer" v-if="data.currentSprint && data.currentSprint.items.length">
        <button class="drawer-toggle" @click="drawerOpen = !drawerOpen">
          {{ drawerOpen ? 'Hide' : 'Show' }} Completed Stories – {{ data.currentSprint.title }}
          ({{ data.currentSprint.items.length }})
          <span class="drawer-arrow" :class="{ open: drawerOpen }">&#9654;</span>
        </button>
        <div v-if="drawerOpen" class="drawer-content">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Type</th>
                <th>Effort</th>
                <th>Actual</th>
                <th>Assignee</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.currentSprint.items" :key="item.number">
                <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                <td>{{ item.title }}</td>
                <td>{{ item.type }}</td>
                <td>{{ item.effort ?? '-' }}</td>
                <td>{{ item.actual_time ?? '-' }}</td>
                <td>{{ item.assignee ?? '-' }}</td>
                <td>{{ item.closed_at ? item.closed_at.slice(0, 10) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="sprint-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sprint</th>
              <th>Completed ({{ mode === 'points' ? 'hrs' : 'issues' }})</th>
              <th>vs Avg</th>
              <th>vs Target</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in data.velocity" :key="v.sprint">
              <td class="sprint-name">{{ v.sprint }}</td>
              <td>{{ v.completed }}</td>
              <td :class="diffClass(v.completed - data.average)">
                {{ (v.completed - data.average) > 0 ? '+' : '' }}{{ (v.completed - data.average).toFixed(1) }}
              </td>
              <td :class="diffClass(v.completed - data.target)">
                {{ data.target > 0 ? ((v.completed - data.target) > 0 ? '+' : '') + (v.completed - data.target).toFixed(1) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p v-else-if="!loading && !error">No sprint data available.</p>
  </div>
</template>

<style scoped>
.velocity-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.velocity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.velocity-controls {
  display: flex;
  gap: 10px;
}

.btn-refresh {
  padding: 7px 14px;
  border: 1px solid #dfe1e6;
  background: #fff;
  border-radius: 3px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-refresh:hover {
  background: #f4f5f7;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #de350b;
}

.summary-cards {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.card {
  flex: 1;
  min-width: 130px;
  background: #fff;
  border-radius: 4px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.card-value {
  font-size: 24px;
  font-weight: 700;
}

.card-sub {
  font-size: 12px;
  color: #5e6c84;
}

.card--blue .card-value { color: #0747a6; }
.card--green .card-value { color: #00875a; }

.chart-wrapper {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  height: 360px;
}

.drawer {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.drawer-toggle {
  width: 100%;
  padding: 12px 16px;
  background: #f4f5f7;
  border: none;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-toggle:hover {
  background: #e9ecf0;
}

.drawer-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.drawer-arrow.open {
  transform: rotate(90deg);
}

.drawer-content {
  padding: 0;
}

.sprint-table-wrapper {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
}

.data-table th {
  background: #f4f5f7;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
}

.issue-link {
  color: #0747a6;
  text-decoration: none;
  font-weight: 600;
}

.issue-link:hover {
  text-decoration: underline;
}

.sprint-name {
  font-weight: 600;
}

.diff-pos { color: #00875a; }
.diff-neg { color: #de350b; }

.velocity-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-filter label {
  font-size: 13px;
  font-weight: 600;
  color: #5e6c84;
  text-transform: uppercase;
}

.type-filter select {
  padding: 6px 12px;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  font-size: 13px;
  background: #fff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
  min-width: 120px;
}
</style>
