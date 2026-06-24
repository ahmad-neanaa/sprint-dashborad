<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar } from 'vue-chartjs'
import { useApi } from '@/composables/useApi'
import type { CycleTimeResponse } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

const { getCycleTime, getSprints } = useApi()

const sprint = ref('')
const sprints = ref<string[]>([])
const data = ref<CycleTimeResponse | null>(null)
const loading = ref(false)
const error = ref('')
const expanded = ref<Set<string>>(new Set())

function toggleRow(name: string) {
  const s = new Set(expanded.value)
  if (s.has(name)) s.delete(name); else s.add(name)
  expanded.value = s
}

function isOpen(name: string) { return expanded.value.has(name) }

const trendChart = computed(() => {
  if (!data.value || data.value.trend.length === 0) return null
  const labels = data.value.trend.map((t) => t.sprint)
  return {
    labels,
    datasets: [
      {
        label: 'Avg Cycle Time (days)',
        data: data.value.trend.map((t) => t.avgCycleTime),
        borderColor: '#0747a6',
        backgroundColor: 'rgba(7, 71, 166, 0.08)',
        fill: true,
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: '#0747a6',
      },
      {
        label: 'Target (3 days)',
        data: Array(labels.length).fill(3),
        borderColor: '#00875a',
        borderDash: [6, 4],
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }
})

const trendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, title: { display: true, text: 'Days' } },
  },
}

const assigneeChart = computed(() => {
  if (!data.value || data.value.assignees.length === 0) return null
  return {
    labels: data.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Avg Cycle Time (days)',
        data: data.value.assignees.map((a) => a.avgCycleTime),
        backgroundColor: data.value.assignees.map((a) =>
          a.rating === 'Good' ? '#00875a' : a.rating === 'Fair' ? '#ff8b00' : '#de350b'
        ),
        borderRadius: 3,
      },
    ],
  }
})

const assigneeOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, title: { display: true, text: 'Days' } },
  },
}

function ratingClass(rating: string) {
  return `rating-${rating.toLowerCase()}`
}

async function load() {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await getCycleTime(sprint.value)
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const r = await getSprints()
    sprints.value = r.sprints
    if (r.sprints.length) sprint.value = r.sprints[0]
  } catch {}
  await load()
})
</script>

<template>
  <div class="ct-page">
    <div class="ct-header">
      <h2>Cycle Time</h2>
      <div class="ct-controls">
        <label class="sprint-label">
          Sprint
          <select v-model="sprint" class="sprint-input" @change="load">
            <option v-for="s in sprints" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <button class="btn-refresh" @click="load" :disabled="loading">{{ loading ? 'Loading...' : 'Refresh' }}</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
      <div class="summary-cards">
        <div class="card" :class="data.summary.kpiRating === 'Good' ? 'card--green' : data.summary.kpiRating === 'Fair' ? 'card--yellow' : 'card--red'">
          <span class="card-label">Avg Cycle Time</span>
          <span class="card-value">{{ data.summary.currentAvg }}d</span>
        </div>
        <div class="card">
          <span class="card-label">KPI Rating</span>
          <span class="card-value rating-badge" :class="ratingClass(data.summary.kpiRating)">{{ data.summary.kpiRating }}</span>
        </div>
        <div class="card card--blue">
          <span class="card-label">All-Sprint Avg</span>
          <span class="card-value">{{ data.summary.allSprintAvg }}d</span>
        </div>
        <div class="card">
          <span class="card-label">Issues Measured</span>
          <span class="card-value">{{ data.summary.issuesMeasured }}</span>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-wrapper" v-if="trendChart">
          <h3 class="chart-title">Trend</h3>
          <Line :data="trendChart" :options="trendOptions" />
        </div>
        <div class="chart-wrapper" v-if="assigneeChart">
          <h3 class="chart-title">Per Assignee</h3>
          <Bar :data="assigneeChart" :options="assigneeOptions" />
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Assignee</th>
              <th>Avg Cycle (days)</th>
              <th>Issues</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="a in data.assignees" :key="a.assignee">
              <tr class="member-row" :class="{ expanded: isOpen(a.assignee) }" @click="toggleRow(a.assignee)">
                <td class="expand-cell">
                  <span class="expand-icon" :class="{ open: isOpen(a.assignee) }">&#9654;</span>
                </td>
                <td class="name-cell">{{ a.assignee }}</td>
                <td>{{ a.avgCycleTime }}</td>
                <td>{{ a.count }}</td>
                <td><span class="rating-badge" :class="ratingClass(a.rating)">{{ a.rating }}</span></td>
              </tr>
              <tr v-if="isOpen(a.assignee) && a.items.length" class="detail-row">
                <td colspan="5">
                  <table class="sub-table">
                    <thead>
                      <tr><th>#</th><th>Title</th><th>Cycle Time (days)</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in a.items" :key="item.number">
                        <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                        <td>{{ item.title }}</td>
                        <td>{{ item.cycleTime }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <p v-else-if="!loading && !error">No data for this sprint.</p>
  </div>
</template>

<style scoped>
.ct-page { display: flex; flex-direction: column; gap: 20px; }
.ct-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.ct-controls { display: flex; gap: 10px; align-items: center; }
.sprint-label { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.sprint-input { padding: 6px 10px; border: 1px solid #dfe1e6; border-radius: 3px; font-size: 14px; width: 160px; outline: none; }
.sprint-input:focus { border-color: #0747a6; }
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
.card--yellow .card-value { color: #ff8b00; }
.card--red .card-value { color: #de350b; }

.rating-badge { display: inline-block; padding: 2px 10px; border-radius: 3px; font-size: 13px; font-weight: 700; }
.rating-good { background: #e3fcef; color: #006644; }
.rating-fair { background: #fff0b3; color: #7a5a00; }
.rating-poor { background: #ffebe6; color: #bf2600; }

.chart-row { display: flex; gap: 20px; flex-wrap: wrap; }
.chart-wrapper { flex: 1; min-width: 300px; background: #fff; border-radius: 4px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: 320px; }
.chart-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #172b4d; }

.table-wrapper { background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
.data-table th { background: #f4f5f7; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #5e6c84; }
.member-row { cursor: pointer; }
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
.issue-link { color: #0747a6; text-decoration: none; font-weight: 600; }
.issue-link:hover { text-decoration: underline; }
</style>
