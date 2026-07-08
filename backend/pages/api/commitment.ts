import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitment } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode, project, issueType } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const commitMode = mode === 'issues' ? 'issues' : 'points'
  const filterType = typeof issueType === 'string' && issueType.length > 0 ? issueType : undefined

  const data = buildCommitment(commitMode, projectName, filterType)
  res.status(200).json({ mode: commitMode, ...data })
}
