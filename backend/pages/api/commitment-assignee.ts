import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitmentByAssignee } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, mode } = req.query

  if (!sprint || typeof sprint !== 'string') {
    return res.status(400).json({ error: 'Missing sprint parameter' })
  }

  const commitMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildCommitmentByAssignee(sprint, commitMode)
  if (!data) {
    return res.status(404).json({ error: `Sprint "${sprint}" not found` })
  }

  res.status(200).json({ sprint, mode: commitMode, ...data })
}
