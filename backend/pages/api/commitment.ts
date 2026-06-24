import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitment } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode, project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const commitMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildCommitment(commitMode, projectName)
  res.status(200).json({ mode: commitMode, ...data })
}
