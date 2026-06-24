import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb, runMigrations } from '../../lib/db'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[]
    const config: Record<string, string> = {}
    for (const row of rows) {
      config[row.key] = row.value
    }
    return res.status(200).json(config)
  }

  if (req.method === 'PUT') {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' })
    }
    const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    const validKeys = [
      'github_token', 'refresh_interval_hours',
    ]
    for (const [key, value] of Object.entries(body)) {
      if (validKeys.includes(key)) {
        upsert.run(key, String(value))
      }
    }
    const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[]
    const config: Record<string, string> = {}
    for (const row of rows) {
      config[row.key] = row.value
    }
    return res.status(200).json(config)
  }

  if (req.method === 'POST') {
    const { key, value } = req.body
    if (!key || typeof key !== 'string' || value === undefined) {
      return res.status(400).json({ error: 'Missing key or value in request body' })
    }
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value))
    return res.status(200).json({ [key]: String(value) })
  }

  res.setHeader('Allow', ['GET', 'PUT', 'POST'])
  res.status(405).json({ error: `Method ${req.method} not allowed` })
}
