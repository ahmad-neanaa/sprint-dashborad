import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildTeamStats } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, mode } = req.query
  const sprintTitle = typeof sprint === 'string' && sprint.length > 0 ? sprint : undefined
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const dataMode: 'points' | 'issues' = mode === 'issues' ? 'issues' : 'points'

  const data = buildTeamStats(sprintTitle, dataMode, projectName)
  res.status(200).json({ mode: dataMode, ...data })
}
