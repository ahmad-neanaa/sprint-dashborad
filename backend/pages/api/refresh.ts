import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb, runMigrations } from '../../lib/db'

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()
  const db = getDb()
  const token = process.env.BACKEND_GH_TOKEN

  if (!token) {
    return res.status(400).json({ error: 'BACKEND_GH_TOKEN not set' })
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              login
            }
          }
        `,
      }),
    })

    const json = await response.json()

    if (!response.ok) {
      return res.status(502).json({ error: 'GitHub API error', details: json })
    }

    db.prepare("UPDATE config SET value = datetime('now') WHERE key = 'last_refreshed'").run()

    res.status(200).json({ message: 'Refresh complete', viewer: json.data?.viewer?.login })
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed', details: String(err) })
  }
}
