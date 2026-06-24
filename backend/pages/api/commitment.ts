import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitment } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { mode } = req.query
  const commitMode = mode === 'issues' ? 'issues' : 'points'

  const data = buildCommitment(commitMode)
  res.status(200).json({ mode: commitMode, ...data })
}
