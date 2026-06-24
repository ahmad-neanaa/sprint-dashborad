<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const { getConfig, putConfig } = useApi()

interface FormFields {
  github_token: string
  github_project_id: string
  expected_hours: string
  status_field: string
  effort_field: string
  actual_time_field: string
  assignee_field: string
  sprint_field: string
  type_field: string
}

const form = ref<FormFields>({
  github_token: '',
  github_project_id: '',
  expected_hours: '120',
  status_field: 'Status',
  effort_field: 'Effort',
  actual_time_field: 'Actual time',
  assignee_field: 'Assignee',
  sprint_field: 'Sprint',
  type_field: 'Type',
})

const loading = ref(false)
const saving = ref(false)
const message = ref('')

async function load() {
  loading.value = true
  try {
    const config = await getConfig()
    for (const key of Object.keys(form.value) as (keyof FormFields)[]) {
      if (config[key] !== undefined) {
        form.value[key] = config[key] as string
      }
    }
  } catch (e) {
    message.value = `Failed to load config: ${e}`
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  try {
    const updated = await putConfig({ ...form.value })
    for (const key of Object.keys(form.value) as (keyof FormFields)[]) {
      if (updated[key] !== undefined) {
        form.value[key] = updated[key] as string
      }
    }
    message.value = 'Configuration saved.'
  } catch (e) {
    message.value = `Failed to save: ${e}`
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="config-page">
    <h2>Configuration</h2>
    <p v-if="loading">Loading...</p>
    <form v-else @submit.prevent="save" class="config-form">
      <p v-if="message" class="message">{{ message }}</p>

      <fieldset>
        <legend>GitHub</legend>
        <label>
          Token
          <input v-model="form.github_token" type="password" placeholder="ghp_..." />
        </label>
        <label>
          Project ID
          <input v-model="form.github_project_id" placeholder="PVT_kwxxxx" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Sprint Target</legend>
        <label>
          Expected hours per sprint
          <input v-model="form.expected_hours" type="number" min="1" step="1" />
        </label>
      </fieldset>

      <fieldset>
        <legend>GitHub Field Mappings</legend>
        <p class="hint">
          Map your GitHub project field names to the dashboard fields.
        </p>
        <label>
          Status field
          <input v-model="form.status_field" />
        </label>
        <label>
          Effort field
          <input v-model="form.effort_field" />
        </label>
        <label>
          Actual time field
          <input v-model="form.actual_time_field" />
        </label>
        <label>
          Assignee field
          <input v-model="form.assignee_field" />
        </label>
        <label>
          Sprint field
          <input v-model="form.sprint_field" />
        </label>
        <label>
          Type field
          <input v-model="form.type_field" />
        </label>
      </fieldset>

      <button type="submit" :disabled="saving" class="btn-save">
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.config-page {
  max-width: 600px;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

fieldset {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
  background: #fff;
}

legend {
  font-weight: 600;
  font-size: 14px;
  padding: 0 6px;
}

.hint {
  font-size: 13px;
  color: #5e6c84;
  margin-bottom: 12px;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  font-weight: 500;
  color: #172b4d;
  gap: 4px;
  margin-bottom: 12px;
}

input {
  padding: 8px 10px;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: #0747a6;
  box-shadow: 0 0 0 1px #0747a6;
}

.btn-save {
  align-self: flex-start;
  padding: 10px 24px;
  background: #0747a6;
  color: #fff;
  border: none;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover {
  background: #0052cc;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  padding: 10px 14px;
  border-radius: 3px;
  background: #e3fcef;
  color: #006644;
  font-size: 14px;
}
</style>
