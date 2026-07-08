<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

defineProps<{
  selectionMode: 'sprint' | 'date'
  sprint: string
  sprints: string[]
  startDate: string
  endDate: string
  allowAllSprints?: boolean
  issueType: string
  issueTypes: string[]
}>()

const emit = defineEmits<{
  (e: 'update:selectionMode', val: 'sprint' | 'date'): void
  (e: 'update:sprint', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:issueType', val: string): void
  (e: 'change'): void
}>()

function changeMode(mode: 'sprint' | 'date') {
  emit('update:selectionMode', mode)
  emit('change')
}

function onSprintChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  emit('update:sprint', val)
  emit('change')
}

function onStartDateChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:startDate', val)
  emit('change')
}

function onEndDateChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:endDate', val)
  emit('change')
}

function onIssueTypeChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  emit('update:issueType', val)
  emit('change')
}

function applyPreset(days: number) {
  const today = new Date()
  const start = new Date()
  start.setDate(today.getDate() - days)
  
  const formatDateStr = (d: Date) => d.toISOString().split('T')[0]
  
  emit('update:startDate', formatDateStr(start))
  emit('update:endDate', formatDateStr(today))
  emit('change')
}
</script>

<template>
  <div class="time-range-selector">
    <div class="selector-left-group">
      <div class="selector-mode-toggle">
        <button 
          type="button" 
          :class="{ active: selectionMode === 'sprint' }" 
          @click="changeMode('sprint')"
        >
          Sprint
        </button>
        <button 
          type="button" 
          :class="{ active: selectionMode === 'date' }" 
          @click="changeMode('date')"
        >
          Date Range
        </button>
      </div>

      <div class="selector-inputs">
        <div v-if="selectionMode === 'sprint'" class="sprint-select-wrapper">
          <select :value="sprint" @change="onSprintChange">
            <option v-if="allowAllSprints" value="">All Sprints</option>
            <option v-for="s in sprints" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div v-else class="date-range-container">
          <div class="date-range-wrapper">
            <input type="date" :value="startDate" :max="endDate" @change="onStartDateChange" />
            <span>to</span>
            <input type="date" :value="endDate" :min="startDate" @change="onEndDateChange" />
          </div>
          <div class="preset-pills">
            <button type="button" class="preset-pill" @click="applyPreset(7)">7d</button>
            <button type="button" class="preset-pill" @click="applyPreset(14)">14d</button>
            <button type="button" class="preset-pill" @click="applyPreset(30)">30d</button>
            <button type="button" class="preset-pill" @click="applyPreset(90)">90d</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Issue Type Filter Dropdown -->
    <div class="issue-type-filter-wrapper">
      <label for="issue-type-select">Type:</label>
      <select id="issue-type-select" :value="issueType" @change="onIssueTypeChange">
        <option value="">All Types</option>
        <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.time-range-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.selector-left-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.selector-mode-toggle {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
}

.selector-mode-toggle button {
  background: transparent;
  border: none;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.selector-mode-toggle button.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.selector-inputs select,
.issue-type-filter-wrapper select,
.date-range-wrapper input {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  background-color: #ffffff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.selector-inputs select:focus,
.issue-type-filter-wrapper select:focus,
.date-range-wrapper input:focus {
  border-color: #3b82f6;
}

.date-range-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-range-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-range-wrapper span {
  font-size: 14px;
  color: #64748b;
}

.preset-pills {
  display: flex;
  gap: 4px;
}

.preset-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-pill:hover {
  background: #cbd5e1;
  border-color: #94a3b8;
  color: #0f172a;
}

.issue-type-filter-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue-type-filter-wrapper label {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}

.issue-type-filter-wrapper select {
  min-width: 120px;
}
</style>
