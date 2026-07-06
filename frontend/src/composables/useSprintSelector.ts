import { ref, onMounted, watch, type Ref } from 'vue'
import { useApi, useRefreshSignal, useSelectedProject } from './useApi'

function formatDate(date: Date): string {
  try {
    return date.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function useSprintSelector(loadFn?: () => Promise<void>) {
  const project = useSelectedProject()
  const { getSprints } = useApi()

  const sprint = ref('')
  const sprints = ref<string[]>([])
  
  const today = new Date()
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(today.getDate() - 14)

  const selectionMode = ref<'sprint' | 'date'>('sprint')
  const startDate = ref(formatDate(fourteenDaysAgo))
  const endDate = ref(formatDate(today))

  const refreshSignal = useRefreshSignal()

  async function loadSprints() {
    try {
      const r = await getSprints(project.value || undefined)
      sprints.value = r.sprints
      if (r.sprints.length && !sprint.value) {
        sprint.value = r.sprints[0]
      }
    } catch {
      sprints.value = []
    }
  }

  async function init() {
    await loadSprints()
    await safeLoad()
  }

  async function safeLoad() {
    if (selectionMode.value === 'sprint') {
      if (sprint.value) await loadFn?.()
    } else {
      if (startDate.value && endDate.value) await loadFn?.()
    }
  }

  if (loadFn) {
    watch(refreshSignal, safeLoad)
    watch(project, async () => {
      sprint.value = ''
      await loadSprints()
      await safeLoad()
    })
    watch([selectionMode, startDate, endDate], safeLoad)
  }

  onMounted(init)

  return { sprint, sprints, project, refreshSignal, selectionMode, startDate, endDate, safeLoad }
}

export function useProjectWatcher(loadFn: () => Promise<void>) {
  const project = useSelectedProject()
  const refreshSignal = useRefreshSignal()

  watch(refreshSignal, loadFn)
  watch(project, async () => {
    await loadFn()
  })

  onMounted(loadFn)

  return { project, refreshSignal }
}
