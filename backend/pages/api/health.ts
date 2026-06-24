import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb, runMigrations } from '../../lib/db'

type Data = { status: string; dbReady: boolean }

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    runMigrations()
    const db = getDb()
    db.prepare('SELECT 1').get()
    res.status(200).json({ status: 'ok', dbReady: true })
  } catch {
    res.status(500).json({ status: 'error', dbReady: false })
  }
}
