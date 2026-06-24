import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { buildKpiReview } from '../../lib/calculators'

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const data = buildKpiReview()
  res.status(200).json(data)
}
