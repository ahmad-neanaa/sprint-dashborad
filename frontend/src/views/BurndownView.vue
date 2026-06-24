<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { BurndownResponse } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const { getBurndown } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<BurndownResponse | null>(null)
const loading = ref(false)
const drawerOpen = ref(false)
const error = ref('')

const chartData = computed(() => {
  if (!data.value) return null
  const labels = data.value.points.map((p) => {
    const d = new Date(p.date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  return {
    labels,
    datasets: [
      {
        label: 'Ideal',
        data: data.value.points.map((p) => p.ideal),
        borderColor: '#0747a6',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0,
      },
      {
        label: 'Actual (remaining)',
        data: data.value.points.map((p) => p.actual),
        borderColor: '#de350b',
        backgroundColor: 'rgba(222, 53, 11, 0.08)',
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#de350b',
        tension: 0.1,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const label = ctx.dataset.label || ''
          const val = ctx.parsed.y
          return `${label}: ${val}${mode.value === 'points' ? ' hrs' : ''}`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
    },
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
    data.value = await getBurndown(sprint.value, mode.value, project.value || undefined)
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

const { sprint, sprints, project } = useSprintSelector(load)
watch(mode, load)
</script>

<template>
  <div class="burndown-page">
    <div class="burndown-header">
      <h2>Burndown</h2>
      <div class="burndown-controls">
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
        <div class="card">
          <span class="card-label">Total {{ mode === 'points' ? 'Hours' : 'Issues' }}</span>
          <span class="card-value">{{ data.summary.total }}</span>
        </div>
        <div class="card card--green">
          <span class="card-label">Completed</span>
          <span class="card-value">{{ data.summary.completed }}</span>
        </div>
        <div class="card card--red">
          <span class="card-label">Remaining</span>
          <span class="card-value">{{ data.summary.remaining.toFixed(1) }}</span>
        </div>
        <div class="card">
          <span class="card-label">Days Left</span>
          <span class="card-value">{{ data.summary.daysLeft }} / {{ data.summary.daysTotal }}</span>
        </div>
        <div class="card card--blue">
          <span class="card-label">Delivery</span>
          <span class="card-value">{{ data.summary.percentComplete }}%</span>
        </div>
      </div>

      <div class="chart-wrapper" v-if="chartData">
        <Line :data="chartData" :options="chartOptions" />
      </div>

      <div class="drawer">
        <button class="drawer-toggle" @click="drawerOpen = !drawerOpen">
          {{ drawerOpen ? 'Hide' : 'Show' }} Sprint Items ({{ data.items.length }})
          <span class="drawer-arrow" :class="{ open: drawerOpen }">&#9654;</span>
        </button>
        <div v-if="drawerOpen" class="drawer-content">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th>Type</th>
                <th>Effort</th>
                <th>Actual</th>
                <th>Assignee</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.number">
                <td>
                  <a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a>
                </td>
                <td>{{ item.title }}</td>
                <td>
                  <span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span>
                </td>
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
    </template>

    <p v-else-if="!loading && !error">No data for this sprint.</p>
  </div>
</template>

<style scoped>
.burndown-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.burndown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.burndown-controls {
  display: flex;
  align-items: center;
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
  gap: 6px;
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

.card--green .card-value { color: #00875a; }
.card--red .card-value   { color: #de350b; }
.card--blue .card-value  { color: #0747a6; }

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
  position: sticky;
  top: 0;
}

.issue-link {
  color: #0747a6;
  text-decoration: none;
  font-weight: 600;
}

.issue-link:hover {
  text-decoration: underline;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  background: #f4f5f7;
  color: #42526e;
}

.status-done     { background: #e3fcef; color: #006644; }
.status-progress { background: #eae6ff; color: #403294; }
.status-todo     { background: #f4f5f7; color: #5e6c84; }
</style>
