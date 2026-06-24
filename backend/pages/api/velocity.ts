import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildVelocity } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode, project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const velMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildVelocity(velMode, projectName)
  res.status(200).json({ mode: velMode, ...data })
}
