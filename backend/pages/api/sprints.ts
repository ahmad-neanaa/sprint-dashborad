import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations, getDb } from '../../lib/db'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()
  const db = getDb()

  const rows = db
    .prepare('SELECT title FROM sprints ORDER BY start_date')
    .all() as { title: string }[]

  const sprints = rows.map((r) => r.title)
  res.status(200).json({ sprints })
}
