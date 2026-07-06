<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bar, Line } from 'vue-chartjs'
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
  Filler,
} from 'chart.js'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { DefectResponse } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const { getDefects } = useApi()

const data = ref<DefectResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getDefects(
      selectionMode.value === 'sprint' ? sprint.value : null,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined
    )
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

const { sprint, sprints: sprintList, project, selectionMode, startDate, endDate } = useSprintSelector(load)

const trendChartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  return {
    labels: data.value.trend.map((t) => t.sprint),
    datasets: [
      {
        label: 'Defect Rate %',
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3,
        data: data.value.trend.map((t) => t.defectRate),
      },
    ],
  }
})

const trendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      title: { display: true, text: 'Defect Rate %' },
    },
  },
}))

const assigneeChartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  return {
    labels: data.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Defect Count',
        backgroundColor: data.value.assignees.map((a) =>
          a.defectRate > 30 ? '#ef4444' : a.defectRate > 15 ? '#f59e0b' : '#22c55e'
        ),
        data: data.value.assignees.map((a) => a.defectCount),
      },
    ],
  }
})

const assigneeChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: any) => {
          const stat = data.value?.assignees[ctx.dataIndex]
          if (stat) return `Rate: ${stat.defectRate}%\nEffort: ${stat.effortOnDefects}h`
          return ''
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Defects' },
    },
  },
}))

function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

function statusClass(s: string) {
  if (s === 'Done') return 'badge badge-green'
  if (s === 'In Progress') return 'badge badge-purple'
  return 'badge badge-gray'
}
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Defects</h2>
      <TimeSelector
        v-model:selectionMode="selectionMode"
        v-model:sprint="sprint"
        :sprints="sprintList"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        @change="load"
      />
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div v-if="data" class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Defect Count</div>
        <div class="kpi-value">{{ data.summary.defectCount }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Defect Rate</div>
        <div class="kpi-value">{{ data.summary.defectRate }}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">KPI</div>
        <div class="kpi-value"><span :class="ratingClass(data.summary.kpiRating)">{{ data.summary.kpiRating }}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Closed / Open</div>
        <div class="kpi-value">{{ data.summary.closedDefects }} / {{ data.summary.openDefects }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Items</div>
        <div class="kpi-value">{{ data.summary.totalItems }}</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data && data.trend.length > 0">
      <h3 class="card-title">Defect Rate Trend</h3>
      <div class="chart-wrapper">
        <Line :data="trendChartData" :options="trendChartOptions" />
      </div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data && data.assignees.length > 0">
      <h3 class="card-title">Defects by Assignee</h3>
      <div class="chart-wrapper">
        <Bar :data="assigneeChartData" :options="assigneeChartOptions" />
      </div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data">
      <h3 class="card-title">Defect Items</h3>
      <table class="styled-table" v-if="data.items.length > 0">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Effort</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data.items" :key="item.number">
            <td><a :href="item.url" target="_blank">{{ item.title }}</a></td>
            <td><span :class="statusClass(item.status)">{{ item.status }}</span></td>
            <td>{{ item.assignee ?? '-' }}</td>
            <td>{{ item.effort ?? '-' }}</td>
            <td>{{ item.actual_time ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">No defects found in this sprint.</div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data">
      <h3 class="card-title">Assignee Breakdown</h3>
      <table class="styled-table" v-if="data.assignees.length > 0">
        <thead>
          <tr>
            <th>Assignee</th>
            <th>Defects</th>
            <th>Total Items</th>
            <th>Defect Rate</th>
            <th>Effort on Defects</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data.assignees" :key="a.assignee">
            <td>{{ a.assignee }}</td>
            <td>{{ a.defectCount }}</td>
            <td>{{ a.totalItems }}</td>
            <td><span :class="ratingClass(a.defectRate > 30 ? 'Poor' : a.defectRate > 15 ? 'Fair' : 'Good')">{{ a.defectRate }}%</span></td>
            <td>{{ a.effortOnDefects }}h</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">No assignee data.</div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  height: 250px;
}
</style>
