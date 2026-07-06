import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildTimeAnalysis } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, mode, startDate, endDate } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const dataMode: 'points' | 'issues' = mode === 'issues' ? 'issues' : 'points'

  let data
  if (typeof sprint === 'string' && sprint.length > 0) {
    data = buildTimeAnalysis(sprint, dataMode, projectName)
  } else if (typeof startDate === 'string' && typeof endDate === 'string' && startDate && endDate) {
    data = buildTimeAnalysis(null, dataMode, projectName, startDate, endDate)
  } else {
    return res.status(400).json({ error: 'Missing or invalid "sprint" or "startDate"/"endDate" query parameter(s)' })
  }

  if (!data) {
    return res.status(404).json({ error: 'Data not found' })
  }

  res.status(200).json({ sprint: sprint || `${startDate} to ${endDate}`, mode: dataMode, ...data })
}
