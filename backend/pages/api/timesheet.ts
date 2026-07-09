import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildTimesheet } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, project, startDate, endDate, issueType } = req.query
  const sprintTitle = typeof sprint === 'string' && sprint.length > 0 ? sprint : undefined
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const filterType = typeof issueType === 'string' && issueType.length > 0 ? issueType : undefined

  const startStr = typeof startDate === 'string' ? startDate : undefined
  const endStr = typeof endDate === 'string' ? endDate : undefined

  let data
  if (sprintTitle) {
    data = buildTimesheet(sprintTitle, projectName, undefined, undefined, filterType)
  } else if (startStr && endStr) {
    data = buildTimesheet(null, projectName, startStr, endStr, filterType)
  } else {
    return res.status(400).json({ error: 'Missing or invalid "sprint" or "startDate"/"endDate" query parameter(s)' })
  }

  if (!data) {
    return res.status(404).json({ error: 'Data not found' })
  }

  res.status(200).json({ sprint: sprintTitle || `${startStr} to ${endStr}`, ...data })
}
