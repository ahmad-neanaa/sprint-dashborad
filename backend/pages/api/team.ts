import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildTeamStats } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, mode, startDate, endDate, issueType } = req.query
  const sprintTitle = typeof sprint === 'string' && sprint.length > 0 ? sprint : undefined
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const dataMode: 'points' | 'issues' = mode === 'issues' ? 'issues' : 'points'
  const filterType = typeof issueType === 'string' && issueType.length > 0 ? issueType : undefined

  const startStr = typeof startDate === 'string' ? startDate : undefined
  const endStr = typeof endDate === 'string' ? endDate : undefined

  const data = buildTeamStats(sprintTitle || null, dataMode, projectName, startStr, endStr, filterType)
  res.status(200).json({ mode: dataMode, ...data })
}
