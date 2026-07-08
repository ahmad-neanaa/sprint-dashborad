import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildDefects } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, startDate, endDate, issueType } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const filterType = typeof issueType === 'string' && issueType.length > 0 ? issueType : undefined

  let data
  if (typeof sprint === 'string' && sprint.length > 0) {
    data = buildDefects(sprint, projectName, undefined, undefined, filterType)
  } else if (typeof startDate === 'string' && typeof endDate === 'string' && startDate && endDate) {
    data = buildDefects(null, projectName, startDate, endDate, filterType)
  } else {
    return res.status(400).json({ error: 'Missing or invalid "sprint" or "startDate"/"endDate" query parameter(s)' })
  }

  if (!data) {
    return res.status(404).json({ error: 'Data not found' })
  }

  res.status(200).json({ sprint: sprint || `${startDate} to ${endDate}`, ...data })
}
