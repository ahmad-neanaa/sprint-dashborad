import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildOverview } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, mode } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const dataMode: 'points' | 'issues' = mode === 'issues' ? 'issues' : 'points'

  if (!sprint || typeof sprint !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sprint" query parameter' })
  }

  const data = buildOverview(sprint, dataMode, projectName)

  if (!data) {
    return res.status(404).json({ error: `Sprint "${sprint}" not found` })
  }

  res.status(200).json({ sprint, mode: dataMode, ...data })
}
