import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildVelocity } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode, project, issueType } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const velMode = mode === 'issues' ? 'issues' : 'points'
  const filterType = typeof issueType === 'string' && issueType.length > 0 ? issueType : undefined

  const data = buildVelocity(velMode, projectName, filterType)
  res.status(200).json({ mode: velMode, ...data })
}
