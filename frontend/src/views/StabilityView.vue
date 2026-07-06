<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { StabilityResponse } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const { getStability } = useApi()

const data = ref<StabilityResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getStability(
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
.view-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.view-title {
  font-size: 24px;
  font-weight: 600;
  color: #172b4d;
}

.error-banner {
  background: #ffebe6;
  color: #de350b;
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 14px;
  border: 1px solid #ffbdad;
}

.overall-rating-card {
  text-align: center;
  padding: 36px;
  border-radius: 12px;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.overall-rating-card.good { background: linear-gradient(135deg, #22c55e, #16a34a); }
.overall-rating-card.fair { background: linear-gradient(135deg, #f59e0b, #d97706); }
.overall-rating-card.poor { background: linear-gradient(135deg, #ef4444, #dc2626); }

.overall-label {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.overall-value {
  font-size: 52px;
  letter-spacing: 2px;
}

.kpi-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.kpi-card {
  flex: 1;
  min-width: 180px;
  background: #fff;
  border-radius: 6px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 3px solid transparent;
  transition: box-shadow 0.2s, transform 0.2s;
}

.kpi-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
}

.kpi-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: #172b4d;
}

.kpi-detail {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.badge-green { background: #dcfce7; color: #16a34a; }
.badge-yellow { background: #fef3c7; color: #d97706; }
.badge-red { background: #fee2e2; color: #dc2626; }

.card {
  background: #fff;
  border-radius: 6px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #172b4d;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
}

.styled-table th,
.styled-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
}

.styled-table th {
  background: #f4f5f7;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
  white-space: nowrap;
}

.styled-table tbody tr:hover {
  background: #f8f9ff;
}

.styled-table tbody tr:last-child td {
  border-bottom: none;
}

.text-green { color: #22c55e; font-weight: 600; }
.text-yellow { color: #f59e0b; font-weight: 600; }
.text-red { color: #ef4444; font-weight: 600; }
</style>
