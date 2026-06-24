import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildTeamStats } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint } = req.query
  const sprintTitle = typeof sprint === 'string' && sprint.length > 0 ? sprint : undefined

  const data = buildTeamStats(sprintTitle)
  res.status(200).json({ ...data })
}
