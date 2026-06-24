import type { NextApiRequest, NextApiResponse } from 'next'
import { runMigrations } from '../../lib/db'
import { refreshFromGithub } from '../../lib/github'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  runMigrations()

  const { project } = req.query
  const projectName = typeof project === 'string' && project.length > 0 ? project : undefined

  try {
    const result = await refreshFromGithub(projectName)
    res.status(200).json({
      message: projectName
        ? `Refresh complete for "${projectName}"`
        : `Refresh complete (${result.projects} project${result.projects > 1 ? 's' : ''})`,
      items: result.itemsCount,
      sprints: result.sprintsCount,
      projects: result.projects,
    })
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed', details: String(err) })
  }
}
