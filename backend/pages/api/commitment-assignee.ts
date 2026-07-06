import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildCommitmentByAssignee } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { sprint, mode, project, startDate, endDate } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined
  const commitMode = mode === 'issues' ? 'issues' : 'points'

  let data
  if (typeof sprint === 'string' && sprint.length > 0) {
    data = buildCommitmentByAssignee(sprint, commitMode, projectName)
  } else if (typeof startDate === 'string' && typeof endDate === 'string' && startDate && endDate) {
    data = buildCommitmentByAssignee(null, commitMode, projectName, startDate, endDate)
  } else {
    return res.status(400).json({ error: 'Missing or invalid "sprint" or "startDate"/"endDate" query parameter(s)' })
  }

  if (!data) {
    return res.status(404).json({ error: 'Data not found' })
  }

  res.status(200).json({ sprint: sprint || `${startDate} to ${endDate}`, mode: commitMode, ...data })
}
