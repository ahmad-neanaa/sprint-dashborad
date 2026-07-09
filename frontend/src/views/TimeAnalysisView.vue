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
import { Bar, Line } from 'vue-chartjs'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import { useDataTable } from '@/composables/useDataTable'
import { formatHours, formatVariance } from '@/utils/format'
import type { TimeAnalysisResponse, CycleTimeResponse, TimeAnalysisIssue } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend)

const { getTimeAnalysis, getCycleTime } = useApi()

// Tabs: 'effort' (Time Analysis / Variance) or 'cycle' (Cycle Time)
const activeSubTab = ref<'effort' | 'cycle'>('effort')

const mode = ref<'points' | 'issues'>('points')
const effortData = ref<TimeAnalysisResponse | null>(null)
const cycleData = ref<CycleTimeResponse | null>(null)
const loading = ref(false)
const error = ref('')

const expandedMembers = ref<Set<string>>(new Set())
const expandedIssues = ref(false)
const expandedCycleAssignees = ref<Set<string>>(new Set())

function toggleMember(name: string) {
  const s = new Set(expandedMembers.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedMembers.value = s
}

function isMemberOpen(name: string): boolean {
  return expandedMembers.value.has(name)
}

function toggleCycleAssignee(name: string) {
  const s = new Set(expandedCycleAssignees.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedCycleAssignees.value = s
}

function isCycleAssigneeOpen(name: string): boolean {
  return expandedCycleAssignees.value.has(name)
}

// DataTable setup for All Issues in Effort view
const rawIssues = computed(() => effortData.value?.issues ?? [])
const {
  searchQuery: issueSearchQuery,
  sortKey: issueSortKey,
  sortDir: issueSortDir,
  currentPage: issueCurrentPage,
  processedItems: paginatedIssues,
  totalPages: issueTotalPages,
  setSort: setIssueSort,
  nextPage: nextIssuePage,
  prevPage: prevIssuePage
} = useDataTable<TimeAnalysisIssue>(rawIssues, {
  searchFields: ['title', 'assignee', 'status', 'type'],
  defaultSort: { key: 'number', dir: 'asc' },
  defaultPageSize: 10
})

// Time Analysis Chart Data
const effortChartData = computed(() => {
  if (!effortData.value || effortData.value.members.length === 0) return null
  const labels = effortData.value.members.map((m) => m.assignee)
  return {
    labels,
    datasets: [
      {
        label: mode.value === 'points' ? 'Estimated (hrs)' : 'Items',
        data: effortData.value.members.map((m) => m.estimated),
        backgroundColor: '#0747a6',
        borderRadius: 3,
      },
      {
        label: mode.value === 'points' ? 'Actual (hrs)' : 'Closed',
        data: effortData.value.members.map((m) => m.actual),
        backgroundColor: '#00875a',
        borderRadius: 3,
      },
    ],
  }
})

const effortChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${mode.value === 'points' ? formatHours(ctx.parsed.y) : ctx.parsed.y}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      beginAtZero: true,
      title: { display: true, text: mode.value === 'points' ? 'Hours' : 'Issues' },
    },
  },
}))

// Cycle Time Chart Data
const cycleTrendChartData = computed(() => {
  if (!cycleData.value || cycleData.value.trend.length === 0) return null
  const labels = cycleData.value.trend.map((t) => t.sprint)
  return {
    labels,
    datasets: [
      {
        label: 'Avg Cycle Time (days)',
        data: cycleData.value.trend.map((t) => t.avgCycleTime),
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

const cycleTrendOptions = {
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

const cycleAssigneeChartData = computed(() => {
  if (!cycleData.value || cycleData.value.assignees.length === 0) return null
  return {
    labels: cycleData.value.assignees.map((a) => a.assignee),
    datasets: [
      {
        label: 'Avg Cycle Time (days)',
        data: cycleData.value.assignees.map((a) => a.avgCycleTime),
        backgroundColor: cycleData.value.assignees.map((a) =>
          a.rating === 'Good' ? '#00875a' : a.rating === 'Fair' ? '#ff8b00' : '#de350b'
        ),
        borderRadius: 3,
      },
    ],
  }
})

const cycleAssigneeOptions = {
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

async function loadEffort() {
  try {
    effortData.value = await getTimeAnalysis(
      selectionMode.value === 'sprint' ? sprint.value : null,
      mode.value,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
  } catch (e) {
    error.value = String(e)
  }
}

async function loadCycle() {
  try {
    cycleData.value = await getCycleTime(
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
  if (activeSubTab.value === 'effort') {
    await loadEffort()
  } else {
    await loadCycle()
  }
  loading.value = false
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'closed') return 'status-done'
  if (s === 'in progress' || s === 'in review') return 'status-progress'
  if (s === 'to do' || s === 'backlog') return 'status-todo'
  return ''
}

function varianceClass(v: number | null): string {
  if (v == null) return ''
  return v > 0 ? 'var-neg' : v < 0 ? 'var-pos' : ''
}

function issuesVarianceClass(v: number | null): string {
  if (v == null) return ''
  return v < 0 ? 'var-neg' : ''
}

function ratingClass(rating: string) {
  return `rating-${rating.toLowerCase()}`
}

const { sprint, sprints, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(load)

watch(mode, load)
watch(activeSubTab, load)
</script>

<template>
  <div class="ta-page">
    <div class="ta-header">
      <h2>Time &amp; Cycle Analysis</h2>
      <div class="ta-controls">
        <TimeSelector
          v-model:selectionMode="selectionMode"
          v-model:sprint="sprint"
          :sprints="sprints"
          v-model:startDate="startDate"
          v-model:endDate="endDate"
          v-model:issueType="issueType"
          :issueTypes="issueTypes"
          @change="load"
        />
        <!-- Mode toggle only relevant for effort view -->
        <div v-if="activeSubTab === 'effort'" class="mode-toggle">
          <button :class="{ active: mode === 'points' }" @click="mode = 'points'">Effort (hrs)</button>
          <button :class="{ active: mode === 'issues' }" @click="mode = 'issues'">Issues</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="control-row" style="margin-bottom: 20px;">
      <div class="tabs">
        <button :class="{ active: activeSubTab === 'effort' }" @click="activeSubTab = 'effort'">Effort &amp; Actual</button>
        <button :class="{ active: activeSubTab === 'cycle' }" @click="activeSubTab = 'cycle'">Cycle Time (days)</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Loading time analytics...</div>

    <template v-else>
      <!-- EFFORT & ACTUAL TIME ANALYSIS -->
      <div v-if="activeSubTab === 'effort' && effortData">
        <div class="summary-cards">
          <div class="card card--blue">
            <span class="card-label">{{ mode === 'points' ? 'Total Estimated' : 'Total Items' }}</span>
            <span class="card-value">{{ mode === 'points' ? formatHours(effortData.summary.totalEstimated) : effortData.summary.totalEstimated }}</span>
          </div>
          <div class="card card--green">
            <span class="card-label">{{ mode === 'points' ? 'Total Actual' : 'Total Closed' }}</span>
            <span class="card-value">{{ mode === 'points' ? formatHours(effortData.summary.totalActual) : effortData.summary.totalActual }}</span>
          </div>
          <div class="card" :class="effortData.summary.variance > 0 ? 'card--red' : 'card--green'">
            <span class="card-label">{{ mode === 'points' ? 'Variance' : 'Open Items' }}</span>
            <span class="card-value">
              {{ mode === 'points' ? formatVariance(effortData.summary.variance) : Math.abs(effortData.summary.variance) }}
            </span>
          </div>
          <div class="card">
            <span class="card-label">Issues Tracked</span>
            <span class="card-value">{{ effortData.summary.issuesTracked }}</span>
          </div>
        </div>

        <div class="chart-wrapper effort-chart" v-if="effortChartData">
          <Bar :data="effortChartData" :options="effortChartOptions" />
        </div>

        <div class="table-wrapper" style="margin-top: 24px">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px"></th>
                <th>Assignee</th>
                <th>Issues</th>
                <th>{{ mode === 'points' ? 'Estimated' : 'Items' }}</th>
                <th>{{ mode === 'points' ? 'Actual' : 'Closed' }}</th>
                <th>{{ mode === 'points' ? 'Variance' : 'Open' }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="m in effortData.members" :key="m.assignee">
                <tr class="member-row" :class="{ expanded: isMemberOpen(m.assignee) }" @click="toggleMember(m.assignee)">
                  <td class="expand-cell">
                    <span class="expand-icon" :class="{ open: isMemberOpen(m.assignee) }">&#9654;</span>
                  </td>
                  <td class="name-cell">{{ m.assignee }}</td>
                  <td>{{ m.count }}</td>
                  <td>{{ mode === 'points' ? formatHours(m.estimated) : m.estimated }}</td>
                  <td>{{ mode === 'points' ? formatHours(m.actual) : m.actual }}</td>
                  <td :class="mode === 'issues' ? issuesVarianceClass(m.variance) : varianceClass(m.variance)">
                    {{ mode === 'issues' ? m.variance : formatVariance(m.variance) }}
                  </td>
                </tr>
                <tr v-if="isMemberOpen(m.assignee) && m.items.length" class="detail-row">
                  <td colspan="6">
                    <table class="sub-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Title</th>
                          <th>Status</th>
                          <th>Estimated</th>
                          <th>Actual</th>
                          <th>Variance</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in m.items" :key="item.number">
                          <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                          <td>{{ item.title }}</td>
                          <td><span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                          <td>{{ item.effort != null ? formatHours(item.effort) : '-' }}</td>
                          <td>{{ item.actual_time != null ? formatHours(item.actual_time) : '-' }}</td>
                          <td :class="varianceClass(item.variance)">{{ item.variance != null ? formatVariance(item.variance) : '-' }}</td>
                          <td>
                            <span v-if="item.source === 'MAN'" class="source-badge source-man">MAN</span>
                            <span v-else-if="item.source === 'AUTO'" class="source-badge source-auto">AUTO</span>
                            <span v-else class="source-badge source-none">—</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="drawer" style="margin-top: 24px">
          <button class="drawer-toggle" @click="expandedIssues = !expandedIssues">
            {{ expandedIssues ? 'Hide' : 'Show' }} All Issues ({{ effortData.issues.length }})
            <span class="drawer-arrow" :class="{ open: expandedIssues }">&#9654;</span>
          </button>
          <div v-if="expandedIssues" class="drawer-content">
            <div style="padding: 12px 16px; display: flex; justify-content: flex-end; background: #f4f5f7; border-bottom: 1px solid #e0e0e0;">
              <input
                type="text"
                v-model="issueSearchQuery"
                placeholder="Filter issues..."
                class="search-input"
              />
            </div>
            
            <table class="data-table">
              <thead>
                <tr>
                  <th @click="setIssueSort('number')" class="sort-header">
                    #
                    <span class="sort-icon" v-if="issueSortKey === 'number'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('title')" class="sort-header">
                    Title
                    <span class="sort-icon" v-if="issueSortKey === 'title'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('type')" class="sort-header">
                    Type
                    <span class="sort-icon" v-if="issueSortKey === 'type'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('status')" class="sort-header">
                    Status
                    <span class="sort-icon" v-if="issueSortKey === 'status'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('assignee')" class="sort-header">
                    Assignee
                    <span class="sort-icon" v-if="issueSortKey === 'assignee'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('effort')" class="sort-header" style="text-align: right;">
                    {{ mode === 'points' ? 'Estimated' : 'Item' }}
                    <span class="sort-icon" v-if="issueSortKey === 'effort'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('actual_time')" class="sort-header" style="text-align: right;">
                    {{ mode === 'points' ? 'Actual' : 'Closed' }}
                    <span class="sort-icon" v-if="issueSortKey === 'actual_time'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setIssueSort('variance')" class="sort-header" style="text-align: right;">
                    {{ mode === 'points' ? 'Variance' : 'Open' }}
                    <span class="sort-icon" v-if="issueSortKey === 'variance'">
                      {{ issueSortDir === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in paginatedIssues" :key="item.number">
                  <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                  <td>{{ item.title }}</td>
                  <td>{{ item.type }}</td>
                  <td><span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                  <td>{{ item.assignee ?? '-' }}</td>
                  <td style="text-align: right;">{{ item.effort != null ? (mode === 'points' ? formatHours(item.effort) : item.effort) : '-' }}</td>
                  <td style="text-align: right;">{{ item.actual_time != null ? (mode === 'points' ? formatHours(item.actual_time) : item.actual_time) : '-' }}</td>
                  <td style="text-align: right;" :class="mode === 'issues' ? issuesVarianceClass(item.variance) : varianceClass(item.variance)">
                    {{ item.variance != null ? (mode === 'issues' ? (item.variance < 0 ? 'Open' : 'Done') : formatVariance(item.variance)) : '-' }}
                  </td>
                  <td>
                    <span v-if="item.source === 'MAN'" class="source-badge source-man">MAN</span>
                    <span v-else-if="item.source === 'AUTO'" class="source-badge source-auto">AUTO</span>
                    <span v-else class="source-badge source-none">—</span>
                  </td>
                </tr>
                <tr v-if="paginatedIssues.length === 0">
                  <td colspan="9" class="empty-state">No issues matched the filter criteria.</td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination controls for drawer -->
            <div style="padding: 12px 16px; border-top: 1px solid #e0e0e0;" class="pagination-controls" v-if="rawIssues.length > 0">
              <span>
                Showing {{ (issueCurrentPage - 1) * 10 + 1 }} to
                {{ Math.min(issueCurrentPage * 10, rawIssues.length) }}
                of {{ rawIssues.length }} issues
              </span>
              <div class="pagination-buttons" v-if="issueTotalPages > 1">
                <button
                  @click="prevIssuePage"
                  :disabled="issueCurrentPage === 1"
                  class="pagination-btn"
                >
                  Previous
                </button>
                <button
                  v-for="page in issueTotalPages"
                  :key="page"
                  @click="issueCurrentPage = page"
                  :disabled="issueCurrentPage === page"
                  class="pagination-btn"
                  :style="issueCurrentPage === page ? { backgroundColor: '#0747a6', color: '#fff' } : {}"
                >
                  {{ page }}
                </button>
                <button
                  @click="nextIssuePage"
                  :disabled="issueCurrentPage === issueTotalPages"
                  class="pagination-btn"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CYCLE TIME ANALYSIS -->
      <div v-if="activeSubTab === 'cycle' && cycleData">
        <div class="summary-cards">
          <div class="card" :class="cycleData.summary.kpiRating === 'Good' ? 'card--green' : cycleData.summary.kpiRating === 'Fair' ? 'card--yellow' : 'card--red'">
            <span class="card-label">Avg Cycle Time</span>
            <span class="card-value">{{ cycleData.summary.currentAvg }}d</span>
          </div>
          <div class="card">
            <span class="card-label">KPI Rating</span>
            <span class="card-value rating-badge" :class="ratingClass(cycleData.summary.kpiRating)">{{ cycleData.summary.kpiRating }}</span>
          </div>
          <div class="card card--blue">
            <span class="card-label">All-Sprint Avg</span>
            <span class="card-value">{{ cycleData.summary.allSprintAvg }}d</span>
          </div>
          <div class="card">
            <span class="card-label">Issues Measured</span>
            <span class="card-value">{{ cycleData.summary.issuesMeasured }}</span>
          </div>
        </div>

        <div class="chart-row" style="margin-top: 24px">
          <div class="chart-wrapper" v-if="cycleTrendChartData">
            <h3 class="chart-title">Cycle Time Trend (days)</h3>
            <div class="chart-inner-wrapper">
              <Line :data="cycleTrendChartData" :options="cycleTrendOptions" />
            </div>
          </div>
          <div class="chart-wrapper" v-if="cycleAssigneeChartData">
            <h3 class="chart-title">Avg Cycle Time Per Assignee</h3>
            <div class="chart-inner-wrapper">
              <Bar :data="cycleAssigneeChartData" :options="cycleAssigneeOptions" />
            </div>
          </div>
        </div>

        <div class="table-wrapper" style="margin-top: 24px">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px"></th>
                <th>Assignee</th>
                <th>Avg Cycle (days)</th>
                <th>Issues</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="a in cycleData.assignees" :key="a.assignee">
                <tr class="member-row" :class="{ expanded: isCycleAssigneeOpen(a.assignee) }" @click="toggleCycleAssignee(a.assignee)">
                  <td class="expand-cell">
                    <span class="expand-icon" :class="{ open: isCycleAssigneeOpen(a.assignee) }">&#9654;</span>
                  </td>
                  <td class="name-cell">{{ a.assignee }}</td>
                  <td>{{ a.avgCycleTime }}</td>
                  <td>{{ a.count }}</td>
                  <td><span class="rating-badge" :class="ratingClass(a.rating)">{{ a.rating }}</span></td>
                </tr>
                <tr v-if="isCycleAssigneeOpen(a.assignee) && a.items.length" class="detail-row">
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.ta-page { display: flex; flex-direction: column; gap: 20px; }
.ta-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.ta-controls { display: flex; gap: 10px; align-items: center; }

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

.chart-wrapper { background: #fff; border-radius: 4px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: 360px; }
.effort-chart { height: 360px; }
.chart-row { display: flex; gap: 20px; flex-wrap: wrap; }
.chart-wrapper { flex: 1; min-width: 300px; }
.chart-inner-wrapper { height: 280px; }
.chart-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #172b4d; }

.table-wrapper, .drawer { background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
.data-table th { background: #f4f5f7; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #5e6c84; }

.member-row { cursor: pointer; transition: background 0.15s; }
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

.drawer-toggle { width: 100%; padding: 12px 16px; background: #f4f5f7; border: none; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.drawer-toggle:hover { background: #e9ecf0; }
.drawer-arrow { font-size: 10px; transition: transform 0.2s; }
.drawer-arrow.open { transform: rotate(90deg); }
.drawer-content { padding: 0; }

.issue-link { color: #0747a6; text-decoration: none; font-weight: 600; }
.issue-link:hover { text-decoration: underline; }

.status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
.status-done { background: #e3fcef; color: #006644; }
.status-progress { background: #eae6ff; color: #403294; }
.status-todo { background: #f4f5f7; color: #5e6c84; }

.source-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
.source-man { background: #eae6ff; color: #403294; }
.source-auto { background: #e3fcef; color: #006644; }
.source-none { background: #f4f5f7; color: #5e6c84; }

.var-pos { color: #00875a; font-weight: 600; }
.var-neg { color: #de350b; font-weight: 600; }

.search-input {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  width: 200px;
  outline: none;
}
.search-input:focus {
  border-color: #0747a6;
}

.sort-header {
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.sort-header:hover {
  background: #e9ecf0;
}
.sort-icon {
  display: inline-block;
  margin-left: 4px;
  font-size: 10px;
  color: #0747a6;
}

.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #5e6c84;
}
.pagination-buttons {
  display: flex;
  gap: 4px;
}
.pagination-btn {
  padding: 3px 8px;
  border: 1px solid #dfe1e6;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
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
</style>
