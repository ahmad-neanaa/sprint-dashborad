<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Line, Bar } from 'vue-chartjs'
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
  Filler,
} from 'chart.js'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import { useDataTable } from '@/composables/useDataTable'
import { formatHours } from '@/utils/format'
import type { StabilityResponse, DefectResponse, BurndownItem } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const { getStability, getDefects } = useApi()

const stabilityData = ref<StabilityResponse | null>(null)
const defectsData = ref<DefectResponse | null>(null)
const error = ref('')
const loading = ref(false)

// Tabs: 'stability' or 'defects'
const activeSubTab = ref<'stability' | 'defects'>('stability')

async function loadStability() {
  try {
    stabilityData.value = await getStability(
      selectionMode.value === 'sprint' ? sprint.value : null,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
  } catch (e) {
    error.value = String(e)
  }
}

async function loadDefects() {
  try {
    defectsData.value = await getDefects(
      selectionMode.value === 'sprint' ? sprint.value : null,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
  } catch (e) {
    error.value = String(e)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  if (activeSubTab.value === 'stability') {
    await loadStability()
  } else {
    await loadDefects()
  }
  loading.value = false
}

const { sprint, sprints: sprintList, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(load)

watch(activeSubTab, load)

// DataTable for Defect Items table
const rawDefects = computed(() => defectsData.value?.items ?? [])
const {
  searchQuery: defectSearchQuery,
  sortKey: defectSortKey,
  sortDir: defectSortDir,
  currentPage: defectCurrentPage,
  processedItems: paginatedDefects,
  totalPages: defectTotalPages,
  setSort: setDefectSort,
  nextPage: nextDefectPage,
  prevPage: prevDefectPage
} = useDataTable<BurndownItem>(rawDefects, {
  searchFields: ['title', 'assignee', 'status'],
  defaultSort: { key: 'title', dir: 'asc' },
  defaultPageSize: 10
})

function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

function statusClass(s: string) {
  const normalized = s.toLowerCase()
  if (normalized === 'done' || normalized === 'closed') return 'badge badge-green'
  if (normalized === 'in progress') return 'badge badge-purple'
  return 'badge badge-gray'
}

// Stability Chart
const stabilityChartData = computed(() => {
  if (!stabilityData.value) return { labels: [], datasets: [] }
  return {
    labels: stabilityData.value.trendLabels,
    datasets: [
      {
        label: 'Estimation Accuracy %',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        data: stabilityData.value.estimationTrend,
      },
      {
        label: 'Scope Completion %',
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        data: stabilityData.value.completionTrend,
      },
    ],
  }
})

const stabilityChartOptions = computed(() => ({
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

// Defects Charts
const defectTrendChartData = computed(() => {
  if (!defectsData.value) return { labels: [], datasets: [] }
  return {
    labels: defectsData.value.trend.map((t) => t.sprint),
    datasets: [
      {
        label: 'Defect Rate %',
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3,
        data: defectsData.value.trend.map((t) => t.defectRate),
      },
    ],
  }
})

const defectTrendChartOptions = computed(() => ({
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

const defectAssigneeChartData = computed(() => {
  if (!defectsData.value) return { labels: [], datasets: [] }
  return {
    labels: defectsData.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Defect Count',
        backgroundColor: defectsData.value.assignees.map((a) =>
          a.defectRate > 30 ? '#ef4444' : a.defectRate > 15 ? '#f59e0b' : '#22c55e'
        ),
        data: defectsData.value.assignees.map((a) => a.defectCount),
      },
    ],
  }
})

const defectAssigneeChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: any) => {
          const stat = defectsData.value?.assignees[ctx.dataIndex]
          if (stat) return `Rate: ${stat.defectRate}%\nEffort: ${formatHours(stat.effortOnDefects)}`
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
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Quality &amp; Stability</h2>
      <TimeSelector
        v-model:selectionMode="selectionMode"
        v-model:sprint="sprint"
        :sprints="sprintList"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:issueType="issueType"
        :issueTypes="issueTypes"
        @change="load"
      />
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="control-row">
      <div class="tabs">
        <button :class="{ active: activeSubTab === 'stability' }" @click="activeSubTab = 'stability'">Stability Metrics</button>
        <button :class="{ active: activeSubTab === 'defects' }" @click="activeSubTab = 'defects'">Defects Breakdown</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Loading quality data...</div>

    <template v-else>
      <!-- STABILITY TAB -->
      <div v-if="activeSubTab === 'stability' && stabilityData">
        <div class="overall-rating-card" :class="stabilityData.summary.overallRating.toLowerCase()">
          <div class="overall-label">Overall Stability</div>
          <div class="overall-value">{{ stabilityData.summary.overallRating }}</div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Estimation Accuracy</div>
            <div class="kpi-value">{{ stabilityData.summary.estimationAccuracy }}%</div>
            <div><span :class="ratingClass(stabilityData.summary.estimationKpi)">{{ stabilityData.summary.estimationKpi }}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Scope Completed</div>
            <div class="kpi-value">{{ stabilityData.summary.scopeCompletionRate }}%</div>
            <div class="kpi-detail">Churn: {{ stabilityData.summary.scopeChurn }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Delivery Consistency</div>
            <div class="kpi-value">{{ stabilityData.summary.deliveryConsistency }}</div>
            <div><span :class="ratingClass(stabilityData.summary.deliveryConsistencyKpi)">{{ stabilityData.summary.deliveryConsistencyKpi }}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Velocity CV</div>
            <div class="kpi-value">{{ stabilityData.summary.velocityCv }}%</div>
            <div><span :class="ratingClass(stabilityData.summary.velocityCvKpi)">{{ stabilityData.summary.velocityCvKpi }}</span></div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">Stability Trend</h3>
          <div class="chart-wrapper">
            <Line :data="stabilityChartData" :options="stabilityChartOptions" />
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
                <th>Velocity</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in stabilityData.sprintMetrics" :key="m.sprint">
                <td><strong>{{ m.sprint }}</strong></td>
                <td :class="m.estimationAccuracy >= 90 ? 'text-green' : m.estimationAccuracy >= 75 ? 'text-yellow' : 'text-red'">{{ m.estimationAccuracy }}%</td>
                <td>{{ m.scopeCompletionRate }}%</td>
                <td>{{ m.deliveryRate }}%</td>
                <td>{{ formatHours(m.velocity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- DEFECTS TAB -->
      <div v-if="activeSubTab === 'defects' && defectsData">
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Defect Count</div>
            <div class="kpi-value">{{ defectsData.summary.defectCount }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Defect Rate</div>
            <div class="kpi-value">{{ defectsData.summary.defectRate }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">KPI</div>
            <div class="kpi-value"><span :class="ratingClass(defectsData.summary.kpiRating)">{{ defectsData.summary.kpiRating }}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Closed / Open</div>
            <div class="kpi-value">{{ defectsData.summary.closedDefects }} / {{ defectsData.summary.openDefects }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Items</div>
            <div class="kpi-value">{{ defectsData.summary.totalItems }}</div>
          </div>
        </div>

        <div class="grid-2col" style="margin-top: 24px;">
          <div class="card" v-if="defectsData.trend.length > 0">
            <h3 class="card-title">Defect Rate Trend</h3>
            <div class="chart-wrapper">
              <Line :data="defectTrendChartData" :options="defectTrendChartOptions" />
            </div>
          </div>

          <div class="card" v-if="defectsData.assignees.length > 0">
            <h3 class="card-title">Defects by Assignee</h3>
            <div class="chart-wrapper">
              <Bar :data="defectAssigneeChartData" :options="defectAssigneeChartOptions" />
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <div class="table-controls-row">
            <h3 class="card-title" style="margin-bottom: 0; padding-bottom: 0; border: none;">Defect Items</h3>
            <input
              v-if="rawDefects.length > 0"
              type="text"
              v-model="defectSearchQuery"
              placeholder="Filter defects..."
              class="search-input"
            />
          </div>

          <table class="styled-table" v-if="paginatedDefects.length > 0">
            <thead>
              <tr>
                <th @click="setDefectSort('title')" class="sort-header">
                  Title
                  <span class="sort-icon" v-if="defectSortKey === 'title'">
                    {{ defectSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
                <th @click="setDefectSort('status')" class="sort-header">
                  Status
                  <span class="sort-icon" v-if="defectSortKey === 'status'">
                    {{ defectSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
                <th @click="setDefectSort('assignee')" class="sort-header">
                  Assignee
                  <span class="sort-icon" v-if="defectSortKey === 'assignee'">
                    {{ defectSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
                <th @click="setDefectSort('effort')" class="sort-header" style="text-align: right;">
                  Effort
                  <span class="sort-icon" v-if="defectSortKey === 'effort'">
                    {{ defectSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
                <th @click="setDefectSort('actual_time')" class="sort-header" style="text-align: right;">
                  Actual
                  <span class="sort-icon" v-if="defectSortKey === 'actual_time'">
                    {{ defectSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedDefects" :key="item.number">
                <td><a :href="item.url" target="_blank" class="task-link">#{{ item.number }} - {{ item.title }}</a></td>
                <td><span :class="statusClass(item.status)">{{ item.status }}</span></td>
                <td>{{ item.assignee ?? '-' }}</td>
                <td style="text-align: right;">{{ item.effort ?? '-' }}</td>
                <td style="text-align: right; font-weight: 600;">{{ formatHours(item.actual_time) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">No defects found.</div>

          <!-- Pagination Footer -->
          <div class="pagination-controls" v-if="rawDefects.length > 0">
            <span>
              Showing {{ (defectCurrentPage - 1) * 10 + 1 }} to
              {{ Math.min(defectCurrentPage * 10, rawDefects.length) }}
              of {{ rawDefects.length }} defects
            </span>
            <div class="pagination-buttons" v-if="defectTotalPages > 1">
              <button
                @click="prevDefectPage"
                :disabled="defectCurrentPage === 1"
                class="pagination-btn"
              >
                Previous
              </button>
              <button
                v-for="page in defectTotalPages"
                :key="page"
                @click="defectCurrentPage = page"
                :disabled="defectCurrentPage === page"
                class="pagination-btn"
                :style="defectCurrentPage === page ? { backgroundColor: '#0747a6', color: '#fff' } : {}"
              >
                {{ page }}
              </button>
              <button
                @click="nextDefectPage"
                :disabled="defectCurrentPage === defectTotalPages"
                class="pagination-btn"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <h3 class="card-title">Assignee Defects Summary</h3>
          <table class="styled-table" v-if="defectsData.assignees.length > 0">
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
              <tr v-for="a in defectsData.assignees" :key="a.assignee">
                <td>{{ a.assignee }}</td>
                <td>{{ a.defectCount }}</td>
                <td>{{ a.totalItems }}</td>
                <td><span :class="ratingClass(a.defectRate > 30 ? 'Poor' : a.defectRate > 15 ? 'Fair' : 'Good')">{{ a.defectRate }}%</span></td>
                <td>{{ formatHours(a.effortOnDefects) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">No assignee defect data.</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.control-row {
  display: flex;
  margin-bottom: 20px;
}
.tabs {
  display: flex;
  background: #ebeef2;
  border-radius: 4px;
  padding: 2px;
}
.tabs button {
  border: none;
  background: none;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #505f79;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s;
}
.tabs button:hover {
  background: rgba(255, 255, 255, 0.4);
}
.tabs button.active {
  background: #fff;
  color: #0747a6;
  box-shadow: 0 1px 3px rgba(9, 30, 66, 0.08);
}
.chart-wrapper {
  height: 250px;
}
.grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 768px) {
  .grid-2col {
    grid-template-columns: 1fr;
  }
}

.table-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}
.search-input {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  width: 220px;
  outline: none;
}
.search-input:focus {
  border-color: #0747a6;
}
.sort-header {
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}
.sort-header:hover {
  background: #ebeef2;
}
.sort-icon {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  color: #0747a6;
}
.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  font-size: 13px;
  color: #5e6c84;
}
.pagination-buttons {
  display: flex;
  gap: 6px;
}
.pagination-btn {
  padding: 4px 10px;
  border: 1px solid #dfe1e6;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #505f79;
}
.pagination-btn:hover:not(:disabled) {
  background: #f4f5f7;
  color: #0747a6;
}
.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.task-link {
  color: #0747a6;
  text-decoration: none;
  font-weight: 500;
}
.task-link:hover {
  text-decoration: underline;
}
</style>
