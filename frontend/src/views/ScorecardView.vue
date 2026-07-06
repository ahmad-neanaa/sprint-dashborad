<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { useSprintSelector } from '@/composables/useSprintSelector'
import type { ScorecardResponse } from '@/types'
import TimeSelector from '@/components/TimeSelector.vue'

const { getScorecard } = useApi()

const data = ref<ScorecardResponse | null>(null)
const error = ref('')

async function load() {
  try {
    data.value = await getScorecard(
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

function ratingIcon(rating: string) {
  if (rating === 'Good') return '\u2713'
  if (rating === 'Fair') return '\u26A0'
  return '\u2717'
}
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">Scorecard</h2>
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
        <div class="overall-label">Overall Health</div>
        <div class="overall-value">{{ data.summary.overallRating }}</div>
      </div>

      <div class="kpi-grid">
        <div v-for="kpi in data.kpis" :key="kpi.label" class="kpi-card scorecard-kpi" :class="kpi.rating.toLowerCase()">
          <div class="kpi-header">
            <span class="kpi-icon">{{ ratingIcon(kpi.rating) }}</span>
            <span class="kpi-label">{{ kpi.label }}</span>
          </div>
          <div class="kpi-value">{{ kpi.value }}</div>
          <div class="kpi-detail">{{ kpi.detail }}</div>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <h3 class="card-title">Sprint Details</h3>
        <table class="styled-table">
          <tbody>
            <tr><td>Burndown Progress</td><td>{{ data.summary.burndownPct }}%</td></tr>
            <tr><td>Issues Completed</td><td>{{ data.summary.issuesCompleted }} / {{ data.summary.issuesTotal }}</td></tr>
            <tr><td>Days Left</td><td>{{ data.summary.daysLeft }}</td></tr>
            <tr><td>Active Members</td><td>{{ data.summary.activeMembers }}</td></tr>
            <tr><td>Issues at Risk</td><td>{{ data.summary.issuesAtRisk }}</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
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
.overall-label { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px; }
.overall-value { font-size: 52px; letter-spacing: 2px; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.scorecard-kpi {
  border-left: 4px solid #555;
}
.scorecard-kpi.good { border-left-color: #22c55e; }
.scorecard-kpi.fair { border-left-color: #f59e0b; }
.scorecard-kpi.poor { border-left-color: #ef4444; }
.kpi-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.kpi-icon { font-size: 18px; }
.kpi-detail { font-size: 12px; color: #94a3b8; margin-top: 4px; }
</style>
