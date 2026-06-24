<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
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
import { useApi } from '@/composables/useApi'
import type { StabilityResponse } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const { getStability, getSprints } = useApi()

const sprintTitle = ref('')
const sprintList = ref<string[]>([])
const data = ref<StabilityResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getStability(sprintTitle.value)
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
watch(sprintTitle, load)

function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

const chartData = computed(() => {
  if (!data.value) return { labels: [], datasets: [] }
  return {
    labels: data.value.trendLabels,
    datasets: [
      {
        label: 'Estimation Accuracy %',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        data: data.value.estimationTrend,
      },
      {
        label: 'Scope Completion %',
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        data: data.value.completionTrend,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      title: { display: true, text: 'Percentage' },
    },
  },
}))
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Stability</h2>
      <div class="sprint-selector" v-if="sprintList.length > 0">
        <label for="sprint">Sprint:</label>
        <select id="sprint" v-model="sprintTitle">
          <option v-for="s in sprintList" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <template v-if="data">
      <div class="overall-rating-card" :class="data.summary.overallRating.toLowerCase()">
        <div class="overall-label">Overall Stability</div>
        <div class="overall-value">{{ data.summary.overallRating }}</div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Estimation Accuracy</div>
          <div class="kpi-value">{{ data.summary.estimationAccuracy }}%</div>
          <div><span :class="ratingClass(data.summary.estimationKpi)">{{ data.summary.estimationKpi }}</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Scope Completed</div>
          <div class="kpi-value">{{ data.summary.scopeCompletionRate }}%</div>
          <div class="kpi-detail">Churn: {{ data.summary.scopeChurn }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Delivery Consistency</div>
          <div class="kpi-value">{{ data.summary.deliveryConsistency }}</div>
          <div><span :class="ratingClass(data.summary.deliveryConsistencyKpi)">{{ data.summary.deliveryConsistencyKpi }}</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Velocity CV</div>
          <div class="kpi-value">{{ data.summary.velocityCv }}%</div>
          <div><span :class="ratingClass(data.summary.velocityCvKpi)">{{ data.summary.velocityCvKpi }}</span></div>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <h3 class="card-title">Stability Trend</h3>
        <div style="height: 250px">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <h3 class="card-title">Sprint-by-Sprint Breakdown</h3>
        <table class="styled-table">
          <thead>
            <tr>
              <th>Sprint</th>
              <th>Est. Accuracy</th>
              <th>Scope Completion</th>
              <th>Delivery Rate</th>
              <th>Velocity (h)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in data.sprintMetrics" :key="m.sprint">
              <td>{{ m.sprint }}</td>
              <td :class="m.estimationAccuracy >= 90 ? 'text-green' : m.estimationAccuracy >= 75 ? 'text-yellow' : 'text-red'">{{ m.estimationAccuracy }}%</td>
              <td>{{ m.scopeCompletionRate }}%</td>
              <td>{{ m.deliveryRate }}%</td>
              <td>{{ m.velocity }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.overall-rating-card {
  text-align: center;
  padding: 32px;
  border-radius: 12px;
  margin-bottom: 24px;
  color: #fff;
  font-weight: 700;
}
.overall-rating-card.good { background: linear-gradient(135deg, #22c55e, #16a34a); }
.overall-rating-card.fair { background: linear-gradient(135deg, #f59e0b, #d97706); }
.overall-rating-card.poor { background: linear-gradient(135deg, #ef4444, #dc2626); }
.overall-label { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px; }
.overall-value { font-size: 48px; }
.kpi-detail { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.text-green { color: #22c55e; }
.text-yellow { color: #f59e0b; }
.text-red { color: #ef4444; }
</style>
