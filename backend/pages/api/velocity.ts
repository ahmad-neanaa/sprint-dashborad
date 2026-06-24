import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildVelocity } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode } = req.query
  const velMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildVelocity(velMode)
  res.status(200).json({ mode: velMode, ...data })
}
