import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitmentByAssignee } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, mode, project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined

  if (!sprint || typeof sprint !== 'string') {
    return res.status(400).json({ error: 'Missing sprint parameter' })
  }

  const commitMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildCommitmentByAssignee(sprint, commitMode, projectName)
  if (!data) {
    return res.status(404).json({ error: `Sprint "${sprint}" not found` })
  }

  res.status(200).json({ sprint, mode: commitMode, ...data })
}
