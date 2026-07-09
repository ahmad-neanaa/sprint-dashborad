<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import { useDataTable } from '@/composables/useDataTable'
import { formatHours } from '@/utils/format'
import type { OverviewResponse, BurndownItem } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

const { getOverview } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<OverviewResponse | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await getOverview(
      selectionMode.value === 'sprint' ? sprint.value : null,
      mode.value,
      project.value || undefined,
      selectionMode.value === 'date' ? startDate.value : undefined,
      selectionMode.value === 'date' ? endDate.value : undefined,
      issueType.value || undefined
    )
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

const { sprint, sprints, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(load)

// DataTable setup for stories
const rawStories = computed(() => data.value?.stories ?? [])
const {
  searchQuery,
  sortKey,
  sortDir,
  currentPage,
  processedItems: paginatedStories,
  totalPages,
  setSort,
  nextPage,
  prevPage
} = useDataTable<BurndownItem>(rawStories, {
  searchFields: ['title', 'assignee', 'status', 'type'],
  defaultSort: { key: 'number', dir: 'asc' },
  defaultPageSize: 10
})

watch(mode, load)
</script>

<template>
  <div class="overview-page">
    <div class="overview-header">
      <h2>Sprint Overview</h2>
      <div class="overview-controls">
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

    <div v-if="loading" class="empty-state">Loading sprint overview...</div>

    <template v-else-if="data">
      <div class="summary-cards">
        <div class="card">
          <span class="card-label">Total Stories</span>
          <span class="card-value">{{ data.summary.totalStories }}</span>
        </div>
        <div class="card card--green">
          <span class="card-label">Done</span>
          <span class="card-value">{{ data.summary.doneStories }}</span>
        </div>
        <div class="card card--blue">
          <span class="card-label">In Progress</span>
          <span class="card-value">{{ data.summary.inProgress }}</span>
        </div>
        <div class="card">
          <span class="card-label">To Do</span>
          <span class="card-value">{{ data.summary.toDo }}</span>
        </div>
        <div class="card card--green">
          <span class="card-label">{{ mode === 'points' ? 'Delivered / Target' : 'Done / Total' }}</span>
          <span class="card-value">
            {{ mode === 'points' ? formatHours(data.summary.effortDelivered) : data.summary.doneStories }} /
            {{ mode === 'points' ? formatHours(data.summary.effortTotal) : data.summary.totalStories }}
          </span>
          <span class="card-sub">{{ data.summary.percentComplete }}%</span>
        </div>
        <div class="card">
          <span class="card-label">Days Left</span>
          <span class="card-value">{{ data.summary.daysLeft }} / {{ data.summary.daysTotal }}</span>
        </div>
      </div>

      <div class="table-wrapper">
        <div class="table-controls-row">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search stories..."
            class="search-input"
          />
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th @click="setSort('number')" class="sort-header">
                #
                <span class="sort-icon" v-if="sortKey === 'number'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('title')" class="sort-header">
                Title
                <span class="sort-icon" v-if="sortKey === 'title'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('status')" class="sort-header">
                Status
                <span class="sort-icon" v-if="sortKey === 'status'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('type')" class="sort-header">
                Type
                <span class="sort-icon" v-if="sortKey === 'type'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('effort')" class="sort-header" style="text-align: right;">
                Effort
                <span class="sort-icon" v-if="sortKey === 'effort'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('actual_time')" class="sort-header" style="text-align: right;">
                Actual
                <span class="sort-icon" v-if="sortKey === 'actual_time'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('assignee')" class="sort-header">
                Assignee
                <span class="sort-icon" v-if="sortKey === 'assignee'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in paginatedStories" :key="s.number">
              <td>
                <a :href="s.url" target="_blank" class="issue-link">#{{ s.number }}</a>
              </td>
              <td class="title-cell">
                {{ s.title }}
                <span v-if="s.is_carry_over" class="badge badge-orange" style="margin-left: 8px; font-size: 10px; padding: 2px 6px; text-transform: uppercase;">Carry Over</span>
              </td>
              <td>
                <span class="status-badge" :class="statusClass(s.status)">{{ s.status }}</span>
              </td>
              <td>{{ s.type }}</td>
              <td style="text-align: right;">{{ s.effort != null ? formatHours(s.effort) : '-' }}</td>
              <td style="text-align: right; font-weight: 600;">{{ s.actual_time != null ? formatHours(s.actual_time) : '-' }}</td>
              <td>{{ s.assignee ?? '-' }}</td>
            </tr>
            <tr v-if="rawStories.length === 0 || paginatedStories.length === 0">
              <td colspan="7" class="empty-state">No stories found.</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination Controls -->
        <div class="pagination-controls" v-if="rawStories.length > 0" style="padding: 12px 16px; border-top: 1px solid #e0e0e0;">
          <span>
            Showing {{ (currentPage - 1) * 10 + 1 }} to
            {{ Math.min(currentPage * 10, rawStories.length) }}
            of {{ rawStories.length }} stories
          </span>
          <div class="pagination-buttons" v-if="totalPages > 1">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="pagination-btn"
            >
              Previous
            </button>
            <button
              v-for="page in totalPages"
              :key="page"
              @click="currentPage = page"
              :disabled="currentPage === page"
              class="pagination-btn"
              :style="currentPage === page ? { backgroundColor: '#0747a6', color: '#fff' } : {}"
            >
              {{ page }}
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.overview-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.overview-controls {
  display: flex;
  gap: 10px;
  align-items: center;
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
  gap: 4px;
}

.card-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
}

.card-sub {
  font-size: 13px;
  color: #5e6c84;
}

.card--green .card-value { color: #00875a; }
.card--blue .card-value  { color: #0747a6; }

.table-wrapper {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
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
}

.title-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.status-done     { background: #e3fcef; color: #006644; }
.status-progress { background: #eae6ff; color: #403294; }
.status-todo     { background: #f4f5f7; color: #5e6c84; }

.table-controls-row {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  background: #f4f5f7;
  border-bottom: 1px solid #e0e0e0;
}

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
