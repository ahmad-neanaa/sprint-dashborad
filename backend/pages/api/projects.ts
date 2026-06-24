import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb, runMigrations } from '../../lib/db'

const PROJECT_FIELDS = [
  'name', 'github_project_id', 'github_token', 'expected_hours',
  'status_field', 'effort_field', 'actual_time_field',
  'assignee_field', 'sprint_field', 'type_field',
  'done_value', 'in_progress_value', 'story_value', 'points_field',
]

const DEFAULT_PROJECT = {
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

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()
  const db = getDb()

  if (req.method === 'GET') {
    const projects = db.prepare('SELECT * FROM projects ORDER BY name').all()
    return res.status(200).json(projects)
  }

  if (req.method === 'POST') {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' })
    }
    const name = body.name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "name"' })
    }
    if (!body.github_project_id) {
      return res.status(400).json({ error: 'Missing "github_project_id"' })
    }

    const stmt = db.prepare(`
      INSERT INTO projects (name, github_project_id, github_token, expected_hours,
        status_field, effort_field, actual_time_field, assignee_field,
        sprint_field, type_field, done_value, in_progress_value, story_value, points_field)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    try {
      stmt.run(
        name,
        body.github_project_id,
        body.github_token || '',
        body.expected_hours ?? DEFAULT_PROJECT.expected_hours,
        body.status_field || DEFAULT_PROJECT.status_field,
        body.effort_field || DEFAULT_PROJECT.effort_field,
        body.actual_time_field || DEFAULT_PROJECT.actual_time_field,
        body.assignee_field || DEFAULT_PROJECT.assignee_field,
        body.sprint_field || DEFAULT_PROJECT.sprint_field,
        body.type_field || DEFAULT_PROJECT.type_field,
        body.done_value || DEFAULT_PROJECT.done_value,
        body.in_progress_value || DEFAULT_PROJECT.in_progress_value,
        body.story_value || DEFAULT_PROJECT.story_value,
        body.points_field || DEFAULT_PROJECT.points_field,
      )
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ error: `Project "${name}" already exists` })
      }
      throw err
    }

    const project = db.prepare('SELECT * FROM projects WHERE name = ?').get(name)
    return res.status(201).json(project)
  }

  if (req.method === 'PUT') {
    const body = req.body
    if (!body || typeof body !== 'object' || !body.name) {
      return res.status(400).json({ error: 'Missing "name" in request body' })
    }

    const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(body.name) as { id: number } | undefined
    if (!existing) {
      return res.status(404).json({ error: `Project "${body.name}" not found` })
    }

    const sets: string[] = []
    const vals: unknown[] = []
    for (const field of PROJECT_FIELDS) {
      if (body[field] !== undefined) {
        sets.push(`${field} = ?`)
        vals.push(body[field])
      }
    }
    if (sets.length > 0) {
      vals.push(body.name)
      db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE name = ?`).run(...vals)
    }

    const project = db.prepare('SELECT * FROM projects WHERE name = ?').get(body.name)
    return res.status(200).json(project)
  }

  if (req.method === 'DELETE') {
    const { name } = req.query
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing "name" query parameter' })
    }
    const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined
    if (!existing) {
      return res.status(404).json({ error: `Project "${name}" not found` })
    }
    db.prepare('DELETE FROM items WHERE project_id = ?').run(existing.id)
    db.prepare('DELETE FROM sprints WHERE project_id = ?').run(existing.id)
    db.prepare('DELETE FROM projects WHERE id = ?').run(existing.id)
    return res.status(200).json({ message: `Project "${name}" deleted` })
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
  res.status(405).json({ error: `Method ${req.method} not allowed` })
}
