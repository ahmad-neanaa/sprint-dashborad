<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi, useProjects } from '@/composables/useApi'
import type { Project } from '@/types'

const { createProject, updateProject, deleteProject } = useApi()
const { projects, loadProjects } = useProjects()

const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | ''>('')
const editing = ref<string | null>(null)

interface ProjectForm {
  name: string
  github_project_id: string
  github_token: string
  expected_hours: number
  status_field: string
  effort_field: string
  actual_time_field: string
  assignee_field: string
  sprint_field: string
  type_field: string
  done_value: string
  in_progress_value: string
  story_value: string
  points_field: string
}

const defaultForm: ProjectForm = {
  name: '',
  github_project_id: '',
  github_token: '',
  expected_hours: 120,
  status_field: 'Status',
  effort_field: 'Estimate (Hrs)',
  actual_time_field: 'Actual time',
  assignee_field: 'Assignee',
  sprint_field: 'Iteration',
  type_field: 'Issue Type',
  done_value: 'Done',
  in_progress_value: 'In Progress',
  story_value: 'User Story',
  points_field: 'Story Points',
}

const form = ref<ProjectForm>({ ...defaultForm })
const saving = ref(false)
const showAdd = ref(false)

async function load() {
  loading.value = true
  try {
    await loadProjects()
    message.value = ''
    messageType.value = ''
  } catch (e) {
    message.value = `Failed to load projects: ${e}`
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}

function editProject(p: Project) {
  form.value = {
    name: p.name,
    github_project_id: p.github_project_id,
    github_token: p.github_token,
    expected_hours: p.expected_hours,
    status_field: p.status_field,
    effort_field: p.effort_field,
    actual_time_field: p.actual_time_field,
    assignee_field: p.assignee_field,
    sprint_field: p.sprint_field,
    type_field: p.type_field,
    done_value: p.done_value,
    in_progress_value: p.in_progress_value,
    story_value: p.story_value,
    points_field: p.points_field,
  }
  editing.value = p.name
  showAdd.value = true
}

function startAdd() {
  form.value = { ...defaultForm }
  editing.value = null
  showAdd.value = true
}

function cancelForm() {
  showAdd.value = false
  editing.value = null
  form.value = { ...defaultForm }
}

async function save() {
  saving.value = true
  message.value = ''
  messageType.value = ''
  try {
    if (editing.value) {
      await updateProject({ ...form.value })
      message.value = `Project "${form.value.name}" updated.`
      messageType.value = 'success'
    } else {
      await createProject({ ...form.value })
      message.value = `Project "${form.value.name}" created.`
      messageType.value = 'success'
    }
    cancelForm()
    await load()
  } catch (e) {
    message.value = `Failed to save: ${e}`
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

async function confirmDelete(name: string) {
  if (!confirm(`Delete project "${name}"? This will remove all its sprints and items.`)) return
  message.value = ''
  messageType.value = ''
  try {
    await deleteProject(name)
    message.value = `Project "${name}" deleted.`
    messageType.value = 'success'
    await load()
  } catch (e) {
    message.value = `Failed to delete: ${e}`
    messageType.value = 'error'
  }
}

onMounted(load)
</script>

<template>
  <div class="config-page">
    <div class="view-header">
      <h2 class="view-title">Projects</h2>
      <button class="btn-primary" @click="startAdd" v-if="!showAdd">+ Add Project</button>
    </div>

    <p v-if="message" class="message" :class="{ error: messageType === 'error' }">{{ message }}</p>
    <p v-if="loading">Loading...</p>

    <div v-if="showAdd" class="card project-form">
      <h3 class="card-title">{{ editing ? 'Edit Project' : 'New Project' }}</h3>
      <form @submit.prevent="save">
        <label>
          Project Name
          <input v-model="form.name" placeholder="My Project" :disabled="!!editing" required />
        </label>
        <label>
          GitHub Project ID
          <input v-model="form.github_project_id" placeholder="PVT_kwxxxx" required />
        </label>
        <label>
          GitHub Token (optional, override)
          <input v-model="form.github_token" type="password" placeholder="ghp_... or leave blank for global" />
        </label>
        <label>
          Expected Hours per Sprint
          <input v-model="form.expected_hours" type="number" min="1" step="1" />
        </label>

        <fieldset>
          <legend>Field Mappings</legend>
          <p class="hint">Map your GitHub project field names to the dashboard fields.</p>
          <div class="field-grid">
            <label>Status field <input v-model="form.status_field" /></label>
            <label>Effort field <input v-model="form.effort_field" /></label>
            <label>Actual time field <input v-model="form.actual_time_field" /></label>
            <label>Assignee field <input v-model="form.assignee_field" /></label>
            <label>Sprint field <input v-model="form.sprint_field" /></label>
            <label>Type field <input v-model="form.type_field" /></label>
            <label>Done value <input v-model="form.done_value" /></label>
            <label>In Progress value <input v-model="form.in_progress_value" /></label>
            <label>Story value <input v-model="form.story_value" /></label>
            <label>Points field <input v-model="form.points_field" /></label>
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="submit" :disabled="saving" class="btn-primary">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <button type="button" @click="cancelForm" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>

    <div v-if="projects.length === 0 && !loading && !showAdd" class="empty-state">
      No projects configured. Click "Add Project" to get started.
    </div>

    <div v-for="p in projects" :key="p.id" class="card project-card">
      <div class="project-header">
        <div>
          <h3 class="project-name">{{ p.name }}</h3>
          <span class="project-meta">{{ p.github_project_id }}</span>
          <span class="project-meta">| {{ p.expected_hours }}h/sprint</span>
          <span class="project-meta">| {{ p.status_field }}/{{ p.effort_field }}</span>
        </div>
        <div class="project-actions">
          <button class="btn-small" @click="editProject(p)">Edit</button>
          <button class="btn-small btn-danger" @click="confirmDelete(p.name)">Delete</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px">
      <h3 class="card-title">Global Configuration</h3>
      <p class="hint">Global settings apply to all projects unless overridden per project.</p>
      <div class="global-info">
        <p><strong>Token</strong>: Uses <code>BACKEND_GH_TOKEN</code> env var, or the per-project token if set.</p>
        <p><strong>Field mappings</strong> are configured per project above.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.message {
  padding: 10px 14px;
  border-radius: 3px;
  background: #e3fcef;
  color: #006644;
  font-size: 14px;
}
.message.error {
  background: #ffebe6;
  color: #de350b;
}
.project-form {
  max-width: 700px;
}
.project-form label {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  font-weight: 500;
  color: #172b4d;
  gap: 4px;
  margin-bottom: 12px;
}
.project-form input {
  padding: 8px 10px;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  font-size: 14px;
  outline: none;
}
.project-form input:focus {
  border-color: #0747a6;
}
fieldset {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
  background: #fafbfc;
  margin-bottom: 16px;
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
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field-grid label {
  margin-bottom: 0;
}
.form-actions {
  display: flex;
  gap: 8px;
}
.btn-primary {
  padding: 10px 24px;
  background: #0747a6;
  color: #fff;
  border: none;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary:hover { background: #0052cc; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  padding: 10px 24px;
  background: #f4f5f7;
  color: #172b4d;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  font-size: 14px;
  cursor: pointer;
}
.btn-secondary:hover { background: #e4e7ec; }
.project-card {
  padding: 16px 20px;
}
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.project-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
.project-meta {
  font-size: 12px;
  color: #5e6c84;
  margin-right: 12px;
}
.project-actions {
  display: flex;
  gap: 6px;
}
.btn-small {
  padding: 6px 14px;
  border: 1px solid #dfe1e6;
  background: #fff;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}
.btn-small:hover { background: #f4f5f7; }
.btn-danger { color: #de350b; border-color: #de350b; }
.btn-danger:hover { background: #ffebe6; }
.global-info {
  font-size: 14px;
  line-height: 1.8;
  color: #172b4d;
}
.global-info code {
  background: #f4f5f7;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
