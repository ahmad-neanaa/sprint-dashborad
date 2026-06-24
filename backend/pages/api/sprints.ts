import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations, getDb } from '../../lib/db'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()
  const db = getDb()

  const { project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined

  let rows: { title: string }[]
  if (projectName) {
    const pid = (db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined)?.id
    if (!pid) {
      return res.status(404).json({ error: `Project "${projectName}" not found` })
    }
    rows = db
      .prepare('SELECT title FROM sprints WHERE project_id = ? ORDER BY start_date')
      .all(pid) as { title: string }[]
  } else {
    rows = db
      .prepare('SELECT title FROM sprints ORDER BY start_date')
      .all() as { title: string }[]
  }

  const sprints = rows.map((r) => r.title)
  res.status(200).json({ sprints })
}
