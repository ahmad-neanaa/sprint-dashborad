import { ipcMain } from 'electron'
import { runMigrations, getDb } from './lib/db'
import { refreshFromGithub } from './lib/github'
import {
  buildBurndown, buildVelocity, buildTeamStats, buildCommitmentByAssignee,
  buildKpiReview, buildStability, buildScorecard, buildDefects,
  buildCommitment, buildCycleTime, buildTimeAnalysis, buildOverview,
  buildTimesheet
} from './lib/calculators'

export function registerIpcHandlers() {
  ipcMain.handle('api:getBurndown', async (event, args) => {
    runMigrations()
    const { sprint, mode, project, startDate, endDate, issueType } = args
    const burndownMode = mode === 'issues' ? 'issues' : 'points'
    if (sprint) return { sprint, mode: burndownMode, ...buildBurndown(sprint, burndownMode, project, undefined, undefined, issueType) }
    if (startDate && endDate) return { sprint: `${startDate} to ${endDate}`, mode: burndownMode, ...buildBurndown(null, burndownMode, project, startDate, endDate, issueType) }
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getVelocity', async (event, args) => {
    runMigrations()
    const { mode, project, issueType } = args
    return buildVelocity(mode === 'issues' ? 'issues' : 'points', project, issueType)
  })

  ipcMain.handle('api:getTeam', async (event, args) => {
    runMigrations()
    const { sprint, mode, project, startDate, endDate, issueType } = args
    const teamMode = mode === 'issues' ? 'issues' : 'points'
    if (sprint) return buildTeamStats(sprint, teamMode, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildTeamStats(null, teamMode, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getCommitmentAssignee', async (event, args) => {
    runMigrations()
    const { sprint, mode, project, startDate, endDate, issueType } = args
    const commitMode = mode === 'issues' ? 'issues' : 'points'
    if (sprint) return buildCommitmentByAssignee(sprint, commitMode, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildCommitmentByAssignee(null, commitMode, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getKpiReview', async (event, args) => {
    runMigrations()
    return buildKpiReview(args?.project)
  })

  ipcMain.handle('api:getStability', async (event, args) => {
    runMigrations()
    const { sprint, project, startDate, endDate, issueType } = args
    if (sprint) return buildStability(sprint, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildStability(null, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getScorecard', async (event, args) => {
    runMigrations()
    const { sprint, project, startDate, endDate, issueType } = args
    if (sprint) return buildScorecard(sprint, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildScorecard(null, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getDefects', async (event, args) => {
    runMigrations()
    const { sprint, project, startDate, endDate, issueType } = args
    if (sprint) return buildDefects(sprint, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildDefects(null, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getCommitment', async (event, args) => {
    runMigrations()
    return buildCommitment(args?.mode === 'issues' ? 'issues' : 'points', args?.project, args?.issueType)
  })

  ipcMain.handle('api:getCycleTime', async (event, args) => {
    runMigrations()
    const { sprint, project, startDate, endDate, issueType } = args
    if (sprint) return buildCycleTime(sprint, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildCycleTime(null, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getTimeAnalysis', async (event, args) => {
    runMigrations()
    const { sprint, mode, project, startDate, endDate, issueType } = args
    const m = mode === 'issues' ? 'issues' : 'points'
    if (sprint) return buildTimeAnalysis(sprint, m, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildTimeAnalysis(null, m, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getOverview', async (event, args) => {
    runMigrations()
    const { sprint, mode, project, startDate, endDate, issueType } = args
    const m = mode === 'issues' ? 'issues' : 'points'
    if (sprint) return buildOverview(sprint, m, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildOverview(null, m, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getTimesheet', async (event, args) => {
    runMigrations()
    const { sprint, project, startDate, endDate, issueType } = args
    if (sprint) return buildTimesheet(sprint, project, undefined, undefined, issueType)
    if (startDate && endDate) return buildTimesheet(null, project, startDate, endDate, issueType)
    throw new Error('Missing time parameter')
  })

  ipcMain.handle('api:getSprints', async (event, args) => {
    runMigrations()
    const db = getDb()
    const project = args?.project
    let query = `SELECT DISTINCT title FROM sprints WHERE 1=1`
    const params: (string | number)[] = []
    
    if (project) {
      const projRow = db.prepare('SELECT id FROM projects WHERE name = ?').get(project) as { id: number } | undefined
      if (projRow) {
        query += ` AND project_id = ?`
        params.push(projRow.id)
      } else {
        return { sprints: [] }
      }
    }
    
    query += ` ORDER BY start_date DESC`
    
    const sprints = db.prepare(query).all(...params) as {title: string}[]
    return { sprints: sprints.map(s => s.title) }
  })

  ipcMain.handle('api:getIssueTypes', async (event, args) => {
    runMigrations()
    const db = getDb()
    let query = `SELECT DISTINCT type FROM items WHERE type IS NOT NULL AND type != ''`
    const params: (string | number)[] = []
    if (args?.project) {
      const projRow = db.prepare('SELECT id FROM projects WHERE name = ?').get(args.project) as { id: number } | undefined
      if (projRow) {
        query += ` AND project_id = ?`
        params.push(projRow.id)
      } else {
        return { types: [] }
      }
    }
    query += ` ORDER BY type`
    const items = db.prepare(query).all(...params) as {type: string}[]
    return { types: items.map(i => i.type) }
  })

  ipcMain.handle('api:getProjects', async (event) => {
    runMigrations()
    const db = getDb()
    return db.prepare(`SELECT * FROM projects ORDER BY name ASC`).all()
  })

  ipcMain.handle('api:createProject', async (event, args) => {
    runMigrations()
    const { name, github_project_id, ...mappings } = args
    if (!name || !github_project_id) throw new Error('Missing required fields')
    const db = getDb()
    db.prepare(`
      INSERT INTO projects (
        name, github_project_id, github_token, expected_hours,
        status_field, effort_field, actual_time_field, assignee_field,
        sprint_field, type_field, done_value, in_progress_value,
        story_value, points_field
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, github_project_id,
      mappings.github_token || '',
      mappings.expected_hours ?? 120,
      mappings.status_field || 'Status',
      mappings.effort_field || 'Estimate (Hrs)',
      mappings.actual_time_field || 'Actual time',
      mappings.assignee_field || 'Assignee',
      mappings.sprint_field || 'Iteration',
      mappings.type_field || 'Issue Type',
      mappings.done_value || 'Done',
      mappings.in_progress_value || 'In Progress',
      mappings.story_value || 'User Story',
      mappings.points_field || 'Story Points'
    )
    return db.prepare(`SELECT * FROM projects WHERE name = ?`).get(name)
  })

  ipcMain.handle('api:updateProject', async (event, args) => {
    runMigrations()
    const { name, github_project_id, ...mappings } = args
    if (!name) throw new Error('Missing name')
    const db = getDb()
    db.prepare(`
      UPDATE projects SET 
        github_project_id = coalesce(?, github_project_id),
        github_token = coalesce(?, github_token),
        expected_hours = coalesce(?, expected_hours),
        status_field = coalesce(?, status_field),
        effort_field = coalesce(?, effort_field),
        actual_time_field = coalesce(?, actual_time_field),
        assignee_field = coalesce(?, assignee_field),
        sprint_field = coalesce(?, sprint_field),
        type_field = coalesce(?, type_field),
        done_value = coalesce(?, done_value),
        in_progress_value = coalesce(?, in_progress_value),
        story_value = coalesce(?, story_value),
        points_field = coalesce(?, points_field)
      WHERE name = ?
    `).run(
      github_project_id || null,
      mappings.github_token ?? null,
      mappings.expected_hours ?? null,
      mappings.status_field || null,
      mappings.effort_field || null,
      mappings.actual_time_field || null,
      mappings.assignee_field || null,
      mappings.sprint_field || null,
      mappings.type_field || null,
      mappings.done_value || null,
      mappings.in_progress_value || null,
      mappings.story_value || null,
      mappings.points_field || null,
      name
    )
    return db.prepare(`SELECT * FROM projects WHERE name = ?`).get(name)
  })

  ipcMain.handle('api:deleteProject', async (event, args) => {
    runMigrations()
    const { name } = args
    if (!name) throw new Error('Missing name')
    const db = getDb()
    const projRow = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined
    if (projRow) {
      db.transaction(() => {
        db.prepare(`DELETE FROM item_transitions WHERE item_id IN (SELECT id FROM items WHERE project_id = ?)`).run(projRow.id)
        db.prepare(`DELETE FROM items WHERE project_id = ?`).run(projRow.id)
        db.prepare(`DELETE FROM sprints WHERE project_id = ?`).run(projRow.id)
        db.prepare(`DELETE FROM projects WHERE id = ?`).run(projRow.id)
      })()
    }
    return { success: true }
  })

  ipcMain.handle('api:getConfig', async () => {
    runMigrations()
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM config').all() as {key: string, value: string}[]
    const config: Record<string, string> = {}
    for (const row of rows) {
      config[row.key] = row.value
    }
    return config
  })

  ipcMain.handle('api:updateConfig', async (event, args) => {
    runMigrations()
    const { key, value } = args
    const db = getDb()
    db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value)
    return { success: true }
  })

  ipcMain.handle('api:putConfig', async (event, args) => {
    runMigrations()
    const db = getDb()
    const config = args
    db.transaction(() => {
      for (const [key, value] of Object.entries(config)) {
        db.prepare(`
          INSERT INTO config (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, value)
      }
    })()
    const rows = db.prepare('SELECT key, value FROM config').all() as {key: string, value: string}[]
    const updated: Record<string, string> = {}
    for (const row of rows) {
      updated[row.key] = row.value
    }
    return updated
  })

  ipcMain.handle('api:refreshData', async (event, args) => {
    try {
      const stats = await refreshFromGithub(args?.project)
      return { message: 'Success', ...stats }
    } catch (e: any) {
      throw new Error(e.message || 'Error refreshing from GitHub')
    }
  })
}
