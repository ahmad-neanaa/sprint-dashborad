import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCycleTime } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint } = req.query

  if (!sprint || typeof sprint !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sprint" query parameter' })
  }

  const data = buildCycleTime(sprint)

  if (!data) {
    return res.status(404).json({ error: `Sprint "${sprint}" not found` })
  }

  res.status(200).json({ sprint, ...data })
}
