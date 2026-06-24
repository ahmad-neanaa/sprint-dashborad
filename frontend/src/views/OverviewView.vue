<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { OverviewResponse } from '@/types'

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
    data.value = await getOverview(sprint.value, mode.value, project.value || undefined)
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

const { sprint, sprints, project } = useSprintSelector(load)
watch(mode, load)
</script>

<template>
  <div class="overview-page">
    <div class="overview-header">
      <h2>Sprint Overview</h2>
      <div class="overview-controls">
        <div class="sprint-selector">
          <label>Sprint:</label>
          <select v-model="sprint" @change="load">
            <option v-for="s in sprints" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
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

    <template v-if="data">
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
          <span class="card-value">{{ mode === 'points' ? data.summary.effortDelivered.toFixed(0) : data.summary.doneStories }} / {{ mode === 'points' ? data.summary.effortTotal : data.summary.totalStories }}</span>
          <span class="card-sub">{{ data.summary.percentComplete }}%</span>
        </div>
        <div class="card">
          <span class="card-label">Days Left</span>
          <span class="card-value">{{ data.summary.daysLeft }} / {{ data.summary.daysTotal }}</span>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Type</th>
              <th>Effort</th>
              <th>Actual</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in data.stories" :key="s.number">
              <td>
                <a :href="s.url" target="_blank" class="issue-link">#{{ s.number }}</a>
              </td>
              <td class="title-cell">{{ s.title }}</td>
              <td>
                <span class="status-badge" :class="statusClass(s.status)">{{ s.status }}</span>
              </td>
              <td>{{ s.type }}</td>
              <td>{{ s.effort ?? '-' }}</td>
              <td>{{ s.actual_time ?? '-' }}</td>
              <td>{{ s.assignee ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p v-else-if="!loading && !error">No data for this sprint.</p>
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
  padding: 8px 12px;
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
</style>
