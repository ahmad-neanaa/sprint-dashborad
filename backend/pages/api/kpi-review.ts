import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildKpiReview } from '../../lib/calculators'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined

  const data = buildKpiReview(projectName)
  res.status(200).json(data)
}
