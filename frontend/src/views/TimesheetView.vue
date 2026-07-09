<script setup lang="ts">
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import { useDataTable } from '@/composables/useDataTable'
import { formatHours } from '@/utils/format'
import type { TimesheetResponse, TimesheetAssignee } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

const { getTimesheet } = useApi()

const data = ref<TimesheetResponse | null>(null)
const error = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await getTimesheet(
      selectionMode.value === 'sprint' ? sprint.value : null,
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

const { sprint, sprints: sprintList, project, selectionMode, startDate, endDate, issueType, issueTypes } = useSprintSelector(load)

// DataTable setup for Assignees list
const rawAssignees = computed(() => data.value?.assignees ?? [])
const {
  searchQuery,
  sortKey,
  sortDir,
  currentPage,
  pageSize,
  processedItems: paginatedAssignees,
  totalPages,
  setSort,
  nextPage,
  prevPage
} = useDataTable<TimesheetAssignee>(rawAssignees, {
  searchFields: ['assignee'],
  defaultSort: { key: 'assignee', dir: 'asc' },
  defaultPageSize: 10
})

const expandedAssignees = ref<Set<string>>(new Set())

function toggle(name: string) {
  if (expandedAssignees.value.has(name)) {
    expandedAssignees.value.delete(name)
  } else {
    expandedAssignees.value.add(name)
  }
}

function statusClass(s: string) {
  const normalized = s.toLowerCase()
  if (normalized === 'done' || normalized === 'closed' || normalized === 'completed') return 'badge badge-green'
  if (normalized === 'in progress' || normalized === 'dev' || normalized === 'active') return 'badge badge-purple'
  return 'badge badge-gray'
}
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">HR Timesheet</h2>
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

    <div v-if="loading" class="empty-state">Loading timesheet data...</div>

    <template v-else-if="data">
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Total Actual Hours</div>
          <div class="kpi-value">{{ formatHours(data.summary.totalActual) }}</div>
          <div class="kpi-detail">Logged by team members</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active Members</div>
          <div class="kpi-value">{{ data.summary.assigneesCount }}</div>
          <div class="kpi-detail">Assigned to tasks</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tasks Tracked</div>
          <div class="kpi-value">{{ data.summary.tasksCount }}</div>
          <div class="kpi-detail">Total issues in this period</div>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <div class="table-controls-row">
          <h3 class="card-title" style="margin-bottom: 0; padding-bottom: 0; border: none;">Assignee Time Breakdown</h3>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by assignee..."
            class="search-input"
          />
        </div>

        <table class="styled-table">
          <thead>
            <tr>
              <th style="width: 40px"></th>
              <th @click="setSort('assignee')" class="sort-header">
                Assignee
                <span class="sort-icon" v-if="sortKey === 'assignee'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('totalActual')" class="sort-header" style="text-align: right;">
                Total Hours Spent
                <span class="sort-icon" v-if="sortKey === 'totalActual'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('taskCount')" class="sort-header" style="text-align: right;">
                Task Count
                <span class="sort-icon" v-if="sortKey === 'taskCount'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="a in paginatedAssignees" :key="a.assignee">
              <tr @click="toggle(a.assignee)" class="clickable assignee-row">
                <td>
                  <span class="toggle-icon">{{ expandedAssignees.has(a.assignee) ? '▼' : '▶' }}</span>
                </td>
                <td class="assignee-name">{{ a.assignee }}</td>
                <td style="text-align: right;" class="assignee-hours">{{ formatHours(a.totalActual) }}</td>
                <td style="text-align: right;" class="assignee-count">{{ a.taskCount }} tasks</td>
              </tr>
              <tr v-if="expandedAssignees.has(a.assignee)">
                <td :colspan="4" style="padding: 0; background: #fafbfc;">
                  <div class="nested-table-container">
                    <table class="nested-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th style="text-align: right;">Effort Est.</th>
                          <th style="text-align: right;">Time Logged</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="task in a.tasks" :key="task.number">
                          <td>
                            <a :href="task.url" target="_blank" class="task-link">
                              #{{ task.number }} - {{ task.title }}
                            </a>
                          </td>
                          <td>
                            <span class="badge badge-gray">{{ task.type }}</span>
                          </td>
                          <td>
                            <span :class="statusClass(task.status)">{{ task.status }}</span>
                          </td>
                          <td style="text-align: right;">
                            {{ task.effort != null ? formatHours(task.effort) : '—' }}
                          </td>
                          <td style="text-align: right; font-weight: 600;" class="text-green">
                            {{ formatHours(task.actual_time) }}
                          </td>
                        </tr>
                        <tr v-if="a.tasks.length === 0">
                          <td colspan="5" class="empty-state">No tasks recorded for this assignee.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="rawAssignees.length === 0 || paginatedAssignees.length === 0">
              <td colspan="4" class="empty-state">No time logs found for the selected filter.</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination Footer -->
        <div class="pagination-controls" v-if="rawAssignees.length > 0">
          <span>
            Showing {{ (currentPage - 1) * pageSize + 1 }} to
            {{ Math.min(currentPage * pageSize, rawAssignees.length) }}
            of {{ rawAssignees.length }} assignees
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

.assignee-row:hover {
  background: #f8f9ff;
}
.assignee-name {
  font-weight: 600;
  color: #172b4d;
}
.assignee-hours {
  font-weight: 700;
  color: #0747a6;
}
.assignee-count {
  color: #5e6c84;
}
.toggle-icon {
  font-size: 10px;
  color: #6b778c;
  display: inline-block;
  transition: transform 0.2s;
}
.nested-table-container {
  padding: 12px 24px 16px 40px;
  border-bottom: 1px solid #dfe1e6;
  background: #fafbfc;
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
