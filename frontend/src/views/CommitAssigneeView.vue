<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
import type { CommitAssigneeResponse, CommitAssigneeStat } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getCommitmentAssignee, getSprints } = useApi()

const mode = ref<'points' | 'issues'>('points')
const sprintTitle = ref('')
const data = ref<CommitAssigneeResponse | null>(null)
const error = ref('')
const sprintList = ref<string[]>([])

async function load() {
  if (!sprintTitle.value) return
  try {
    data.value = await getCommitmentAssignee(sprintTitle.value, mode.value)
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(async () => {
  try {
    const r = await getSprints()
    sprintList.value = r.sprints
    if (r.sprints.length) sprintTitle.value = r.sprints[0]
  } catch {}
  await load()
})
watch([mode, sprintTitle], load)

const chartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  return {
    labels: data.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Estimated',
        backgroundColor: '#94a3b8',
        data: data.value.assignees.map((a) => a.estimated),
      },
      {
        label: 'Actual',
        backgroundColor: '#22c55e',
        data: data.value.assignees.map((a) => a.actual),
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: any) => {
          const stat = data.value?.assignees[ctx.dataIndex]
          if (stat) return `Rate: ${stat.rate}%\nRating: ${stat.rating}`
          return ''
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: mode.value === 'points' ? 'Hours' : 'Issues' },
    },
  },
}))

function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

const expandedAssignees = ref<Set<string>>(new Set())

function toggle(name: string) {
  if (expandedAssignees.value.has(name)) {
    expandedAssignees.value.delete(name)
  } else {
    expandedAssignees.value.add(name)
  }
}

function format(v: number) {
  return mode.value === 'points' ? `${v}h` : `${v}`
}

function statusClass(s: string) {
  if (s === 'Done') return 'badge badge-green'
  if (s === 'In Progress') return 'badge badge-purple'
  return 'badge badge-gray'
}
</script>

<template>
  <div class="view-container">
    <h2 class="view-title">Commitment by Assignee</h2>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'points' }" @click="mode = 'points'">Points</button>
      <button :class="{ active: mode === 'issues' }" @click="mode = 'issues'">Issues</button>
    </div>

    <div class="sprint-selector" v-if="sprintList.length > 0">
      <label>Sprint:</label>
      <select v-model="sprintTitle">
        <option v-for="s in sprintList" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div v-if="data" class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Overall Rate</div>
        <div class="kpi-value">{{ data.summary.overallRate }}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">KPI Rating</div>
        <div class="kpi-value"><span :class="ratingClass(data.summary.kpiRating)">{{ data.summary.kpiRating }}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Estimated</div>
        <div class="kpi-value">{{ format(data.summary.totalEstimated) }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Actual</div>
        <div class="kpi-value">{{ format(data.summary.totalActual) }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Assignees</div>
        <div class="kpi-value">{{ data.summary.assigneesCount }}</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data">
      <div style="height: 350px">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div class="card" style="margin-top: 24px" v-if="data">
      <table class="styled-table">
        <thead>
          <tr>
            <th></th>
            <th>Assignee</th>
            <th>Estimated</th>
            <th>Actual</th>
            <th>Rate</th>
            <th>Items</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="a in data.assignees" :key="a.assignee">
            <tr @click="toggle(a.assignee)" class="clickable">
              <td>{{ expandedAssignees.has(a.assignee) ? '▼' : '▶' }}</td>
              <td>{{ a.assignee }}</td>
              <td>{{ format(a.estimated) }}</td>
              <td>{{ format(a.actual) }}</td>
              <td>{{ a.rate }}%</td>
              <td>{{ a.count }}</td>
              <td><span :class="ratingClass(a.rating)">{{ a.rating }}</span></td>
            </tr>
            <tr v-if="expandedAssignees.has(a.assignee)">
              <td :colspan="7" style="padding: 0">
                <table class="nested-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Est.</th>
                      <th>Act.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in a.items" :key="item.title">
                      <td><a :href="item.url" target="_blank">{{ item.title }}</a></td>
                      <td>{{ item.type }}</td>
                      <td><span :class="statusClass(item.status)">{{ item.status }}</span></td>
                      <td>{{ item.effort ?? '-' }}</td>
                      <td>{{ item.actual_time ?? '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
