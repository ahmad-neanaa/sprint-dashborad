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
import { useProjectWatcher } from '@/composables/useSprintSelector'
import type { CommitmentResponse, CommitmentSprint } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getCommitment } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<CommitmentResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getCommitment(mode.value, project.value || undefined)
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

const { project } = useProjectWatcher(load)
watch(mode, load)

const chartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  const labels = data.value.sprints.map((s) => s.sprint)
  return {
    labels,
    datasets: [
      {
        label: 'Committed',
        backgroundColor: '#94a3b8',
        data: data.value.sprints.map((s) => s.committed),
      },
      {
        label: 'Delivered',
        backgroundColor: '#22c55e',
        data: data.value.sprints.map((s) => s.delivered),
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
          const sprint = data.value?.sprints[ctx.dataIndex]
          if (sprint) return `Rate: ${sprint.rate}%\nRating: ${sprint.rating}`
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

const expandedSprints = ref<Set<string>>(new Set())

function toggle(sprint: string) {
  if (expandedSprints.value.has(sprint)) {
    expandedSprints.value.delete(sprint)
  } else {
    expandedSprints.value.add(sprint)
  }
}

function format(v: number) {
  return mode.value === 'points' ? `${v}h` : `${v}`
}
</script>

<template>
  <div class="view-container">
    <h2 class="view-title">Commitment Rate</h2>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'points' }" @click="mode = 'points'">Points</button>
      <button :class="{ active: mode === 'issues' }" @click="mode = 'issues'">Issues</button>
    </div>

    <div v-if="data" class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Delivery Rate</div>
        <div class="kpi-value">{{ data.summary.effortRate }}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">KPI Rating</div>
        <div class="kpi-value"><span :class="ratingClass(data.summary.kpiRating)">{{ data.summary.kpiRating }}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Delivery vs Target</div>
        <div class="kpi-value">{{ data.summary.deliveryVsTarget }}%</div>
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
            <th>Sprint</th>
            <th>Committed</th>
            <th>Delivered</th>
            <th>Rate</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in data.sprints" :key="s.sprint" @click="toggle(s.sprint)" class="clickable">
            <td>{{ expandedSprints.has(s.sprint) ? '▼' : '▶' }}</td>
            <td>{{ s.sprint }}</td>
            <td>{{ format(s.committed) }}</td>
            <td>{{ format(s.delivered) }}</td>
            <td>{{ s.rate }}%</td>
            <td><span :class="ratingClass(s.rating)">{{ s.rating }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
