<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
import { useSprintSelector, useProjectWatcher } from '@/composables/useSprintSelector'
import type { CommitmentResponse, CommitAssigneeResponse } from '@/types'
import { formatHours } from '@/utils/format'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { getCommitment, getCommitmentAssignee, getIssueTypes } = useApi()

// Tabs: 'trend' (Sprint Trend) or 'assignee' (By Assignee)
const activeTab = ref<'trend' | 'assignee'>('trend')
const mode = ref<'points' | 'issues'>('points')
const error = ref('')
const loading = ref(false)

// Data state
const trendData = ref<CommitmentResponse | null>(null)
const assigneeData = ref<CommitAssigneeResponse | null>(null)

// For Trend Tab
async function loadTrend() {
  loading.value = true
  try {
    trendData.value = await getCommitment(mode.value, project.value || undefined, issueType.value || undefined)
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

// For Assignee Tab
async function loadAssignee() {
  loading.value = true
  try {
    assigneeData.value = await getCommitmentAssignee(
      selectionMode.value === 'sprint' ? sprint.value : null,
      mode.value,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

// Watchers and hooks
const { sprint, sprints: sprintList, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(async () => {
  if (activeTab.value === 'trend') {
    await loadTrend()
  } else {
    await loadAssignee()
  }
})

watch(activeTab, async () => {
  if (activeTab.value === 'trend') {
    await loadTrend()
  } else {
    await loadAssignee()
  }
})

watch(mode, async () => {
  if (activeTab.value === 'trend') {
    await loadTrend()
  } else {
    await loadAssignee()
  }
})

// Charts Data
const trendChartData = computed(() => {
  if (!trendData.value) return { labels: [], datasets: [] }
  const labels = trendData.value.sprints.map((s) => s.sprint)
  return {
    labels,
    datasets: [
      {
        label: 'Committed',
        backgroundColor: '#94a3b8',
        data: trendData.value.sprints.map((s) => s.committed),
      },
      {
        label: 'Delivered',
        backgroundColor: '#22c55e',
        data: trendData.value.sprints.map((s) => s.delivered),
      },
    ],
  }
})

const assigneeChartData = computed(() => {
  if (!assigneeData.value) return { labels: [], datasets: [] }
  return {
    labels: assigneeData.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Estimated',
        backgroundColor: '#94a3b8',
        data: assigneeData.value.assignees.map((a) => a.estimated),
      },
      {
        label: 'Actual',
        backgroundColor: '#22c55e',
        data: assigneeData.value.assignees.map((a) => a.actual),
      },
    ],
  }
})

const trendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: any) => {
          const sprint = trendData.value?.sprints[ctx.dataIndex]
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

const assigneeChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: any) => {
          const stat = assigneeData.value?.assignees[ctx.dataIndex]
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

// Helper ratings
function ratingClass(rating: string) {
  if (rating === 'Good') return 'badge badge-green'
  if (rating === 'Fair') return 'badge badge-yellow'
  return 'badge badge-red'
}

const expandedAssignees = ref<Set<string>>(new Set())
function toggleAssignee(name: string) {
  if (expandedAssignees.value.has(name)) {
    expandedAssignees.value.delete(name)
  } else {
    expandedAssignees.value.add(name)
  }
}

function format(v: number) {
  return mode.value === 'points' ? formatHours(v) : `${v}`
}

function statusClass(s: string) {
  const normalized = s.toLowerCase()
  if (normalized === 'done' || normalized === 'closed') return 'badge badge-green'
  if (normalized === 'in progress') return 'badge badge-purple'
  return 'badge badge-gray'
}
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Commitment Tracking</h2>
      
      <!-- Show TimeSelector only on Assignee tab -->
      <TimeSelector
        v-if="activeTab === 'assignee'"
        v-model:selectionMode="selectionMode"
        v-model:sprint="sprint"
        :sprints="sprintList"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:issueType="issueType"
        :issueTypes="issueTypes"
        @change="loadAssignee"
      />
      <!-- Type Filter for Trend tab since it doesn't use TimeSelector -->
      <div v-else class="type-filter">
        <label for="type-select">Type:</label>
        <select id="type-select" v-model="issueType" @change="loadTrend">
          <option value="">All Types</option>
          <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="control-row">
      <div class="tabs">
        <button :class="{ active: activeTab === 'trend' }" @click="activeTab = 'trend'">Sprint Trend</button>
        <button :class="{ active: activeTab === 'assignee' }" @click="activeTab = 'assignee'">By Assignee</button>
      </div>

      <div class="mode-toggle">
        <button :class="{ active: mode === 'points' }" @click="mode = 'points'">Estimated Hours</button>
        <button :class="{ active: mode === 'issues' }" @click="mode = 'issues'">Number of Issues</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Loading commitment metrics...</div>

    <template v-else>
      <!-- SPRINT TREND TAB -->
      <div v-if="activeTab === 'trend' && trendData">
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Delivery Rate</div>
            <div class="kpi-value">{{ trendData.summary.effortRate }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">KPI Rating</div>
            <div class="kpi-value"><span :class="ratingClass(trendData.summary.kpiRating)">{{ trendData.summary.kpiRating }}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Delivery vs Target</div>
            <div class="kpi-value">{{ trendData.summary.deliveryVsTarget }}%</div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <div style="height: 350px">
            <Bar :data="trendChartData" :options="trendChartOptions" />
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <table class="styled-table">
            <thead>
              <tr>
                <th>Sprint</th>
                <th>Committed</th>
                <th>Delivered</th>
                <th>Rate</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in trendData.sprints" :key="s.sprint">
                <td><strong>{{ s.sprint }}</strong></td>
                <td>{{ format(s.committed) }}</td>
                <td>{{ format(s.delivered) }}</td>
                <td style="font-weight: 600;">{{ s.rate }}%</td>
                <td><span :class="ratingClass(s.rating)">{{ s.rating }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- BY ASSIGNEE TAB -->
      <div v-if="activeTab === 'assignee' && assigneeData">
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Overall Rate</div>
            <div class="kpi-value">{{ assigneeData.summary.overallRate }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">KPI Rating</div>
            <div class="kpi-value"><span :class="ratingClass(assigneeData.summary.kpiRating)">{{ assigneeData.summary.kpiRating }}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Estimated</div>
            <div class="kpi-value">{{ format(assigneeData.summary.totalEstimated) }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Actual</div>
            <div class="kpi-value">{{ format(assigneeData.summary.totalActual) }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Assignees</div>
            <div class="kpi-value">{{ assigneeData.summary.assigneesCount }}</div>
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <div style="height: 350px">
            <Bar :data="assigneeChartData" :options="assigneeChartOptions" />
          </div>
        </div>

        <div class="card" style="margin-top: 24px">
          <table class="styled-table">
            <thead>
              <tr>
                <th style="width: 40px"></th>
                <th>Assignee</th>
                <th>Estimated</th>
                <th>Actual</th>
                <th>Rate</th>
                <th>Items</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="a in assigneeData.assignees" :key="a.assignee">
                <tr @click="toggleAssignee(a.assignee)" class="clickable">
                  <td>{{ expandedAssignees.has(a.assignee) ? '▼' : '▶' }}</td>
                  <td><strong>{{ a.assignee }}</strong></td>
                  <td>{{ format(a.estimated) }}</td>
                  <td>{{ format(a.actual) }}</td>
                  <td style="font-weight: 600;">{{ a.rate }}%</td>
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
                          <td>
                            <a :href="item.url" target="_blank">{{ item.title }}</a>
                            <span v-if="item.is_carry_over" class="badge badge-orange" style="margin-left: 8px; font-size: 10px; padding: 2px 6px; text-transform: uppercase;">Carry Over</span>
                          </td>
                          <td>{{ item.type }}</td>
                          <td><span :class="statusClass(item.status)">{{ item.status }}</span></td>
                          <td>{{ item.effort != null ? formatHours(item.effort) : '-' }}</td>
                          <td>{{ item.actual_time != null ? formatHours(item.actual_time) : '-' }}</td>
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
  </div>
</template>

<style scoped>
.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
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
.type-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}
.type-filter label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}
.type-filter select {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  background-color: #ffffff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
}
</style>
