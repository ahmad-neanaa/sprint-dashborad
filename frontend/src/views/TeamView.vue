<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import { useDataTable } from '@/composables/useDataTable'
import { formatHours } from '@/utils/format'
import type { TeamResponse, TeamMemberStat } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

const { getTeam } = useApi()

const mode = ref<'points' | 'issues'>('points')
const data = ref<TeamResponse | null>(null)
const loading = ref(false)
const error = ref('')
const expanded = ref<Set<string>>(new Set())

function toggleRow(name: string) {
  const s = new Set(expanded.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expanded.value = s
}

function isOpen(name: string): boolean {
  return expanded.value.has(name)
}

async function load() {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await getTeam(
      selectionMode.value === 'sprint' ? (sprint.value || undefined) : undefined,
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

// DataTable setup for team members
const rawMembers = computed(() => data.value?.members ?? [])
const {
  searchQuery,
  sortKey,
  sortDir,
  currentPage,
  processedItems: paginatedMembers,
  totalPages,
  setSort,
  nextPage,
  prevPage
} = useDataTable<TeamMemberStat>(rawMembers, {
  searchFields: ['assignee'],
  defaultSort: { key: 'assignee', dir: 'asc' },
  defaultPageSize: 10
})

watch(mode, load)
</script>

<template>
  <div class="team-page">
    <div class="team-header">
      <h2>Team Performance</h2>
      <div class="team-controls">
        <TimeSelector
          v-model:selectionMode="selectionMode"
          v-model:sprint="sprint"
          :sprints="sprints"
          v-model:startDate="startDate"
          v-model:endDate="endDate"
          v-model:issueType="issueType"
          :issueTypes="issueTypes"
          allowAllSprints
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

    <div v-if="loading" class="empty-state">Loading team performance...</div>

    <template v-else-if="data">
      <div class="summary-cards">
        <div class="card">
          <span class="card-label">Active Members</span>
          <span class="card-value">{{ data.summary.activeMembers }}</span>
        </div>
        <div class="card card--blue">
          <span class="card-label">{{ mode === 'points' ? 'Total Effort' : 'Total Items' }}</span>
          <span class="card-value">{{ mode === 'points' ? formatHours(data.summary.totalEffort) : data.summary.totalEffort }}</span>
        </div>
        <div class="card card--green">
          <span class="card-label">{{ mode === 'points' ? 'Total Actual' : 'Total Closed' }}</span>
          <span class="card-value">{{ mode === 'points' ? formatHours(data.summary.totalActual) : data.summary.totalActual }}</span>
        </div>
        <div class="card">
          <span class="card-label">Items Closed</span>
          <span class="card-value">{{ data.summary.closedCount }}</span>
        </div>
      </div>

      <div class="table-wrapper">
        <div class="table-controls-row">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search assignee..."
            class="search-input"
          />
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px"></th>
              <th @click="setSort('assignee')" class="sort-header">
                Assignee
                <span class="sort-icon" v-if="sortKey === 'assignee'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('totalEffort')" class="sort-header">
                {{ mode === 'points' ? 'Effort' : 'Items' }}
                <span class="sort-icon" v-if="sortKey === 'totalEffort'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('totalActual')" class="sort-header">
                {{ mode === 'points' ? 'Actual' : 'Closed' }}
                <span class="sort-icon" v-if="sortKey === 'totalActual'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('closedCount')" class="sort-header">
                Closed
                <span class="sort-icon" v-if="sortKey === 'closedCount'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th @click="setSort('share')" class="sort-header">
                {{ mode === 'points' ? 'Share' : 'Share %' }}
                <span class="sort-icon" v-if="sortKey === 'share'">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in paginatedMembers" :key="m.assignee">
              <tr class="member-row" @click="toggleRow(m.assignee)" :class="{ expanded: isOpen(m.assignee) }">
                <td class="expand-cell">
                  <span v-if="m.items.length" class="expand-icon" :class="{ open: isOpen(m.assignee) }">&#9654;</span>
                </td>
                <td class="name-cell">{{ m.assignee }}</td>
                <td>{{ mode === 'points' ? formatHours(m.totalEffort) : m.totalEffort }}</td>
                <td>{{ mode === 'points' ? formatHours(m.totalActual) : m.totalActual }}</td>
                <td>{{ m.closedCount }}</td>
                <td>{{ m.share }}%</td>
                <td class="progress-cell">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: m.share + '%' }"></div>
                  </div>
                </td>
              </tr>
              <tr v-if="isOpen(m.assignee) && m.items.length" class="detail-row">
                <td colspan="7">
                  <table class="sub-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Effort</th>
                        <th>Actual</th>
                        <th>Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in m.items" :key="item.number">
                        <td><a :href="item.url" target="_blank" class="issue-link">#{{ item.number }}</a></td>
                        <td>{{ item.title }}</td>
                        <td><span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                        <td>{{ item.type }}</td>
                        <td>{{ item.effort != null ? (mode === 'points' ? formatHours(item.effort) : item.effort) : '-' }}</td>
                        <td>{{ item.actual_time != null ? (mode === 'points' ? formatHours(item.actual_time) : item.actual_time) : '-' }}</td>
                        <td>{{ item.closed_at ? item.closed_at.slice(0, 10) : '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
            <tr v-if="rawMembers.length === 0 || paginatedMembers.length === 0">
              <td colspan="7" class="empty-state">No team statistics found.</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination Controls -->
        <div class="pagination-controls" v-if="rawMembers.length > 0" style="padding: 12px 16px; border-top: 1px solid #e0e0e0;">
          <span>
            Showing {{ (currentPage - 1) * 10 + 1 }} to
            {{ Math.min(currentPage * 10, rawMembers.length) }}
            of {{ rawMembers.length }} team members
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
.team-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.team-controls {
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
  gap: 6px;
}

.card-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #5e6c84;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.card-value {
  font-size: 24px;
  font-weight: 700;
}

.card--blue .card-value { color: #0747a6; }
.card--green .card-value { color: #00875a; }

.table-wrapper {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
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

.member-row {
  cursor: pointer;
  transition: background 0.15s;
}

.member-row:hover {
  background: #f4f5f7;
}

.member-row.expanded {
  background: #eae6ff;
}

.name-cell {
  font-weight: 600;
}

.expand-cell {
  width: 28px;
  text-align: center;
}

.expand-icon {
  font-size: 10px;
  display: inline-block;
  transition: transform 0.2s;
  color: #5e6c84;
}

.expand-icon.open {
  transform: rotate(90deg);
}

.progress-cell {
  width: 160px;
}

.progress-bar {
  height: 8px;
  background: #f4f5f7;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #0747a6;
  border-radius: 4px;
  transition: width 0.3s;
}

.detail-row td {
  padding: 0;
  background: #fafbfc;
}

.sub-table {
  width: 100%;
  border-collapse: collapse;
}

.sub-table th,
.sub-table td {
  padding: 7px 12px;
  font-size: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.sub-table th {
  background: #f0f1f3;
  font-size: 11px;
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
