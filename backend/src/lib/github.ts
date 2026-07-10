import { getDb } from './db'

const GITHUB_API = 'https://api.github.com/graphql'

export interface FieldMappings {
  statusField: string
  effortField: string
  actualTimeField: string
  assigneeField: string
  sprintField: string
  typeField: string
}

export interface ItemTransition {
  status: string
  start_date: string
  end_date: string | null
}

interface ProjectItem {
  github_id: number
  title: string
  number: number
  url: string
  type: string
  status: string
  state: string
  effort: number | null
  actual_time: number | null
  assignee: string | null
  sprint: string | null
  sprintStartDate: string | null
  sprintDuration: number | null
  closed_at: string | null
  created_at: string
  transitions: ItemTransition[]
}

export interface ProjectConfig {
  id: number
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

const PROJECT_QUERY = `
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            __typename
            ... on Issue {
              id
              databaseId
              title
              number
              url
              state
              createdAt
              closedAt
              assignees(first: 10) {
                nodes {
                  login
                  avatarUrl
                }
              }
            }
            ... on PullRequest {
              id
              databaseId
              title
              number
              url
              state
              createdAt
              closedAt
              assignees(first: 10) {
                nodes {
                  login
                  avatarUrl
                }
              }
            }
            ... on DraftIssue {
              title
              createdAt
              assignees(first: 10) {
                nodes {
                  login
                  avatarUrl
                }
              }
            }
          }
          fieldValues(first: 50) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                startDate
                duration
                field {
                  ... on ProjectV2IterationField {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

const TIMELINE_QUERY = `
query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Issue {
      id
      timelineItems(first: 100, itemTypes: [PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
        nodes {
          ... on ProjectV2ItemStatusChangedEvent {
            createdAt
            previousStatus
            status
          }
        }
      }
    }
    ... on PullRequest {
      id
      timelineItems(first: 100, itemTypes: [PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
        nodes {
          ... on ProjectV2ItemStatusChangedEvent {
            createdAt
            previousStatus
            status
          }
        }
      }
    }
  }
}
`

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface StatusChangeEvent {
  createdAt: string
  previousStatus: string | null
  status: string | null
}

interface ContentNode {
  __typename?: string
  id?: string
  databaseId?: number | null
  number?: number
  title?: string
  url?: string
  state?: string
  closedAt?: string | null
  createdAt?: string
  assignees?: { nodes?: { login: string; avatarUrl?: string }[] }
  timelineItems?: { nodes?: (StatusChangeEvent | null)[] }
}

interface FieldValueNode {
  text?: string
  number?: number
  name?: string
  date?: string
  title?: string
  startDate?: string
  duration?: number
  field?: { name: string }
}

interface ItemNode {
  content?: ContentNode | null
  fieldValues?: { nodes?: (FieldValueNode | null)[] }
}

interface ProjectData {
  node: {
    items: {
      totalCount: number
      pageInfo: PageInfo
      nodes: (ItemNode | null)[]
    }
  } | null
}

function getGlobalToken(): string {
  const token = process.env.BACKEND_GH_TOKEN
  if (token) return token
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'github_token'").get() as { value: string } | undefined
  if (row?.value) return row.value
  throw new Error('BACKEND_GH_TOKEN not set and no github_token in config')
}

async function graphql<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  const actualToken = token || getGlobalToken()
  const res = await fetch(GITHUB_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${actualToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API HTTP ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (json.errors) {
    throw new Error(`GitHub API error: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`)
  }
  return json.data as T
}

export function calculateTransitions(
  createdAt: string,
  timelineNodes: (StatusChangeEvent | null)[] | undefined,
  currentStatus: string
): ItemTransition[] {
  const transitions: ItemTransition[] = []
  
  const events = (timelineNodes ?? [])
    .filter((e): e is StatusChangeEvent => !!e && !!e.createdAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (events.length === 0) {
    transitions.push({
      status: currentStatus,
      start_date: createdAt,
      end_date: null
    })
    return transitions
  }

  let currentStatusName = events[0].previousStatus || 'To Do'
  let currentStart = createdAt

  for (const event of events) {
    transitions.push({
      status: currentStatusName,
      start_date: currentStart,
      end_date: event.createdAt
    })
    currentStatusName = event.status || 'To Do'
    currentStart = event.createdAt
  }

  transitions.push({
    status: currentStatusName,
    start_date: currentStart,
    end_date: null
  })

  return transitions
}

export async function fetchProjectItems(
  projectId: string,
  fieldMappings: FieldMappings,
  token?: string
): Promise<ProjectItem[]> {
  const items: ProjectItem[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const data: ProjectData = await graphql<ProjectData>(PROJECT_QUERY, { id: projectId, after: cursor }, token)
    const project = data.node
    if (!project) throw new Error(`Project not found: ${projectId}`)

    hasNextPage = project.items.pageInfo.hasNextPage
    cursor = project.items.pageInfo.endCursor

    // Gather content IDs for issues and PRs in this page
    const contentIds: string[] = []
    for (const node of project.items.nodes) {
      if (!node || !node.content) continue
      const content = node.content
      const contentId = content.id
      if (contentId && (content.__typename === 'Issue' || content.__typename === 'PullRequest')) {
        contentIds.push(contentId)
      }
    }

    // Fetch timelineItems in batches of 50 using nodes query
    const timelineMap = new Map<string, StatusChangeEvent[]>()
    if (contentIds.length > 0) {
      for (let i = 0; i < contentIds.length; i += 50) {
        const batch = contentIds.slice(i, i + 50)
        const timelineData = await graphql<{ nodes: any[] }>(TIMELINE_QUERY, { ids: batch }, token)
        for (const tNode of timelineData.nodes) {
          if (tNode && tNode.id) {
            const events = tNode.timelineItems?.nodes ?? []
            timelineMap.set(tNode.id, events)
          }
        }
      }
    }

    for (const node of project.items.nodes) {
      if (!node) continue
      const content = node.content
      if (!content || !content.databaseId) continue

      const fv = (node.fieldValues?.nodes ?? []) as (FieldValueNode | null)[]

      const status = ((fv.find((v) => v?.field?.name === fieldMappings.statusField)) as any)?.name ?? 'To Do'
      const effort = ((fv.find((v) => v?.field?.name === fieldMappings.effortField)) as any)?.number ?? null
      const actualTime = ((fv.find((v) => v?.field?.name === fieldMappings.actualTimeField)) as any)?.number ?? null
      const sprintField = fv.find((v) => v?.field?.name === fieldMappings.sprintField) as any
      const sprint = sprintField?.title ?? null
      const sprintStartDate = sprintField?.startDate ?? null
      const sprintDuration = sprintField?.duration ?? null
      const type = ((fv.find((v) => v?.field?.name === fieldMappings.typeField)) as any)?.name ?? 'issue'

      const assigneeNodes = (content as any).assignees?.nodes
      const contentAssignee = assigneeNodes?.length > 0 ? assigneeNodes[0].login : null
      const customAssigneeField = fv.find((v) => v?.field?.name === fieldMappings.assigneeField) as any
      const customAssignee = customAssigneeField?.name ?? customAssigneeField?.text ?? null
      const assignee = contentAssignee ?? customAssignee ?? null

      const state = content.state ?? 'open'
      const createdAt = (content as any).createdAt ?? new Date().toISOString()
      const timelineNodes = content.id ? timelineMap.get(content.id) : undefined
      const transitions = calculateTransitions(createdAt, timelineNodes, status)

      items.push({
        github_id: content.databaseId!,
        title: content.title ?? '',
        number: (content as any).number ?? 0,
        url: (content as any).url ?? '',
        type: type.toLowerCase(),
        status,
        state: state.toLowerCase(),
        effort: typeof effort === 'number' ? effort : null,
        actual_time: typeof actualTime === 'number' ? actualTime : null,
        assignee,
        sprint,
        sprintStartDate,
        sprintDuration,
        closed_at: (content as any).closedAt ?? null,
        created_at: createdAt,
        transitions,
      })
    }
  }

  return items
}

export async function refreshProject(project: ProjectConfig): Promise<{ itemsCount: number; sprintsCount: number }> {
  const db = getDb()

  const fieldMappings: FieldMappings = {
    statusField: project.status_field,
    effortField: project.effort_field,
    actualTimeField: project.actual_time_field,
    assigneeField: project.assignee_field,
    sprintField: project.sprint_field,
    typeField: project.type_field,
  }

  const token = project.github_token || undefined
  const projectItems = await fetchProjectItems(project.github_project_id, fieldMappings, token)

  const seenSprints = new Set<string>()
  for (const item of projectItems) {
    if (item.sprint) seenSprints.add(item.sprint)
  }

  const upsertSprint = db.prepare(
    `INSERT INTO sprints (title, start_date, duration, project_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(title) DO UPDATE SET start_date = excluded.start_date, duration = excluded.duration, project_id = excluded.project_id`
  )
  for (const name of seenSprints) {
    const sample = projectItems.find((i) => i.sprint === name)!
    upsertSprint.run(name, sample.sprintStartDate ?? new Date().toISOString().slice(0, 10), sample.sprintDuration ?? 14, project.id)
  }

  const sprintRows = db.prepare('SELECT id, title FROM sprints WHERE project_id = ?').all(project.id) as { id: number; title: string }[]
  const sprintMap = new Map(sprintRows.map((r) => [r.title, r.id]))

  const upsertItem = db.prepare(`
    INSERT INTO items (github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id, project_id, closed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(github_id) DO UPDATE SET
      title = excluded.title,
      number = excluded.number,
      url = excluded.url,
      type = excluded.type,
      status = excluded.status,
      state = excluded.state,
      effort = excluded.effort,
      actual_time = CASE WHEN items.actual_time IS NULL THEN excluded.actual_time ELSE items.actual_time END,
      assignee = excluded.assignee,
      sprint_id = excluded.sprint_id,
      project_id = excluded.project_id,
      closed_at = excluded.closed_at,
      created_at = excluded.created_at,
      updated_at = datetime('now')
    RETURNING id
  `)

  const deleteTransitions = db.prepare(`
    DELETE FROM item_transitions WHERE item_id = ?
  `)

  const insertTransition = db.prepare(`
    INSERT INTO item_transitions (item_id, status, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `)

  for (const item of projectItems) {
    const row = upsertItem.get(
      item.github_id,
      item.title,
      item.number,
      item.url,
      item.type,
      item.status,
      item.state,
      item.effort,
      item.actual_time,
      item.assignee,
      item.sprint ? (sprintMap.get(item.sprint) ?? null) : null,
      project.id,
      item.closed_at,
      item.created_at,
    ) as { id: number } | undefined

    if (row?.id) {
      deleteTransitions.run(row.id)
      for (const t of item.transitions) {
        insertTransition.run(row.id, t.status, t.start_date, t.end_date)
      }
    }
  }

  return { itemsCount: projectItems.length, sprintsCount: seenSprints.size }
}

export async function refreshFromGithub(projectName?: string): Promise<{ itemsCount: number; sprintsCount: number; projects: number }> {
  const db = getDb()

  let projects: ProjectConfig[]
  if (projectName) {
    const row = db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName) as ProjectConfig | undefined
    if (!row) throw new Error(`Project "${projectName}" not found`)
    projects = [row]
  } else {
    projects = db.prepare('SELECT * FROM projects').all() as ProjectConfig[]
  }

  if (projects.length === 0) throw new Error('No projects configured. Add a project in Config first.')

  let totalItems = 0
  let totalSprints = 0

  for (const project of projects) {
    const result = await refreshProject(project)
    totalItems += result.itemsCount
    totalSprints += result.sprintsCount
  }

  db.prepare("UPDATE config SET value = datetime('now') WHERE key = 'last_refreshed'").run()
  return { itemsCount: totalItems, sprintsCount: totalSprints, projects: projects.length }
}
