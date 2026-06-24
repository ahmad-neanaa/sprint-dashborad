import { ref, onMounted, watch, type Ref } from 'vue'
import { useApi, useRefreshSignal, useSelectedProject } from './useApi'

export function useSprintSelector(loadFn?: () => Promise<void>) {
  const project = useSelectedProject()
  const { getSprints } = useApi()

  const sprint = ref('')
  const sprints = ref<string[]>([])
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
    await loadFn?.()
  }

  if (loadFn) {
    watch(refreshSignal, loadFn)
    watch(project, async () => {
      sprint.value = ''
      await loadSprints()
      await loadFn()
    })
  }

  onMounted(init)

  return { sprint, sprints, project, refreshSignal }
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
