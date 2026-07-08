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

  let rows: { type: string }[]
  if (projectName) {
    const pid = (db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined)?.id
    if (!pid) {
      return res.status(404).json({ error: `Project "${projectName}" not found` })
    }
    rows = db
      .prepare("SELECT DISTINCT type FROM items WHERE project_id = ? AND type IS NOT NULL AND type != '' ORDER BY type")
      .all(pid) as { type: string }[]
  } else {
    rows = db
      .prepare("SELECT DISTINCT type FROM items WHERE type IS NOT NULL AND type != '' ORDER BY type")
      .all() as { type: string }[]
  }

  const types = rows.map((r) => r.type)
  res.status(200).json({ types })
}
