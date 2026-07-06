<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

defineProps<{
  selectionMode: 'sprint' | 'date'
  sprint: string
  sprints: string[]
  startDate: string
  endDate: string
  allowAllSprints?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectionMode', val: 'sprint' | 'date'): void
  (e: 'update:sprint', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
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
</script>

<template>
  <div class="time-range-selector">
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
      <div v-else class="date-range-wrapper">
        <input type="date" :value="startDate" @change="onStartDateChange" />
        <span>to</span>
        <input type="date" :value="endDate" @change="onEndDateChange" />
      </div>
    </div>
  </div>
</template>
