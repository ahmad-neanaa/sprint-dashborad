<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useApi, useProvideRefresh, useProvideProject } from '@/composables/useApi'

const { refreshData, getProjects } = useApi()
const { bump } = useProvideRefresh()
const { project } = useProvideProject()
const refreshing = ref(false)
const msg = ref('')
const projects = ref<{ name: string }[]>([])
const error = ref('')

async function loadProjects() {
  try {
    projects.value = await getProjects()
    if (projects.value.length > 0 && !project.value) {
      project.value = projects.value[0].name
    }
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function handleRefresh() {
  refreshing.value = true
  msg.value = ''
  try {
    const r = await refreshData(project.value || undefined)
    msg.value = `\u2713 ${r.message || 'Refreshed'}`
    bump()
  } catch (e) {
    msg.value = `\u2717 ${e}`
  } finally {
    refreshing.value = false
    setTimeout(() => { msg.value = '' }, 4000)
  }
}

watch(project, () => {
  bump()
})

onMounted(loadProjects)
</script>

<template>
  <div class="app">
    <nav class="nav">
      <RouterLink to="/burndown" class="nav-link">Burndown</RouterLink>
      <RouterLink to="/velocity" class="nav-link">Velocity</RouterLink>
      <RouterLink to="/overview" class="nav-link">Overview</RouterLink>
      <RouterLink to="/cycle-time" class="nav-link">Cycle</RouterLink>
      <RouterLink to="/time-analysis" class="nav-link">Time</RouterLink>
      <RouterLink to="/team" class="nav-link">Team</RouterLink>
      <RouterLink to="/stability" class="nav-link">Stability</RouterLink>
      <RouterLink to="/scorecard" class="nav-link">Scorecard</RouterLink>
      <RouterLink to="/kpi-review" class="nav-link">KPI Review</RouterLink>
      <RouterLink to="/defects" class="nav-link">Defects</RouterLink>
      <RouterLink to="/commitment" class="nav-link">Commit</RouterLink>
      <RouterLink to="/commitment-assignee" class="nav-link">Commit/Asgn</RouterLink>
      <RouterLink to="/config" class="nav-link">Config</RouterLink>
      <div class="project-selector">
        <select v-model="project">
          <option v-for="p in projects" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>
      </div>
      <button
        class="nav-link refresh-btn"
        :disabled="refreshing"
        @click="handleRefresh"
      >
        {{ refreshing ? '\u27F3' : '\u21BB' }}
      </button>
      <span v-if="msg" class="refresh-msg">{{ msg }}</span>
    </nav>
    <p v-if="error && projects.length === 0" class="error-banner" style="margin: 12px 24px 0">
      No projects configured. Add one in Config.
    </p>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.refresh-btn {
  cursor: pointer;
  font-size: 1.2em;
  background: none;
  border: none;
  color: inherit;
  padding: 0.25rem 0.5rem;
}
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.refresh-msg {
  font-size: 0.85em;
  margin-left: 0.25rem;
}
.project-selector {
  display: flex;
  align-items: center;
  margin-left: auto;
}
.project-selector select {
  padding: 4px 8px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 3px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.project-selector select option {
  background: #0747a6;
  color: #fff;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f4f5f7;
  color: #172b4d;
}

.app {
  min-height: 100vh;
}

.nav {
  display: flex;
  gap: 0;
  background: #0747a6;
  padding: 0 24px;
}

.nav-link {
  color: #fff;
  text-decoration: none;
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  transition: background 0.2s, border-color 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.router-link-active {
  border-bottom-color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.main {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Shared utility classes */
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

.sprint-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.sprint-selector select {
  padding: 6px 10px;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  font-size: 14px;
  width: 200px;
  outline: none;
  background: #fff;
}

.sprint-selector select:focus {
  border-color: #0747a6;
}

.error-banner {
  background: #ffebe6;
  color: #de350b;
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 14px;
  border: 1px solid #ffbdad;
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
.badge-purple { background: #eae6ff; color: #403294; }
.badge-gray { background: #f4f5f7; color: #5e6c84; }

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

.mode-toggle {
  display: flex;
  gap: 0;
  background: #f4f5f7;
  border-radius: 4px;
  overflow: hidden;
  align-self: flex-start;
}

.mode-toggle button {
  padding: 7px 16px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: #5e6c84;
  transition: background 0.2s, color 0.2s;
}

.mode-toggle button.active {
  background: #0747a6;
  color: #fff;
}

.mode-toggle button:not(.active):hover {
  background: #e4e7ec;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: #f4f5f7;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.nested-table {
  width: 100%;
  border-collapse: collapse;
}

.nested-table th,
.nested-table td {
  padding: 7px 12px;
  font-size: 12px;
  border-bottom: 1px solid #e8e8e8;
  text-align: left;
}

.nested-table th {
  background: #f0f1f3;
  font-size: 11px;
  text-transform: uppercase;
  color: #5e6c84;
}
</style>
