import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import * as calculators from './calculators'
import fs from 'fs'
import path from 'path'

// Mock getDb to return an in-memory database
let mockDb: Database.Database

vi.mock('./db', () => ({
  getDb: () => mockDb,
}))

describe('calculators', () => {
  beforeEach(() => {
    mockDb = new Database(':memory:')
    // Initialize schema
    const schema = fs.readFileSync(path.join(process.cwd(), 'migrations', 'schema.sql'), 'utf-8')
    mockDb.exec(schema)

    // Seed data
    mockDb.prepare("INSERT INTO projects (id, name, github_project_id, expected_hours) VALUES (1, 'Test Project', 'PRJ_1', 100)").run()
    
    mockDb.prepare("INSERT INTO sprints (id, title, start_date, duration, project_id) VALUES (1, 'Sprint 1', '2026-06-01', 14, 1)").run()
    
    // Seed items
    const insertItem = mockDb.prepare(`
      INSERT INTO items (github_id, title, number, url, type, status, effort, actual_time, assignee, sprint_id, project_id, closed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertItem.run(101, 'Story 1', 1, 'url', 'issue', 'Done', 5, 4, 'Alice', 1, 1, '2026-06-05', '2026-06-01')
    insertItem.run(102, 'Bug 1', 2, 'url', 'bug', 'In Progress', 3, 1, 'Bob', 1, 1, null, '2026-06-01')
    insertItem.run(103, 'Story 2', 3, 'url', 'issue', 'To Do', 8, null, 'Alice', 1, 1, null, '2026-06-01')
    insertItem.run(104, 'Bug 2', 4, 'url', 'bug', 'Done', 2, 3, 'Alice', 1, 1, '2026-06-10', '2026-06-01')
  })

  afterEach(() => {
    mockDb.close()
  })

  it('buildBurndown points mode', () => {
    const data = calculators.buildBurndown('Sprint 1', 'points', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.total).toBe(100) // Expected hours is 100
    expect(data?.summary.completed).toBe(7) // 4 + 3 actual time of done items
    expect(data?.summary.remaining).toBe(93)
    expect(data?.items).toHaveLength(4)
  })

  it('buildBurndown issues mode', () => {
    const data = calculators.buildBurndown('Sprint 1', 'issues', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.total).toBe(4) // 4 items
    expect(data?.summary.completed).toBe(2) // 2 done
    expect(data?.summary.remaining).toBe(2)
  })

  it('buildVelocity', () => {
    const data = calculators.buildVelocity('points', 'Test Project')
    expect(data.average).toBe(7) // only one sprint, completed = 7
    expect(data.sprintCount).toBe(1)
    expect(data.target).toBe(100)
    expect(data.currentSprint?.completed).toBe(7)
  })

  it('buildOverview', () => {
    const data = calculators.buildOverview('Sprint 1', 'points', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.totalStories).toBe(4)
    expect(data?.summary.doneStories).toBe(2)
    expect(data?.summary.inProgress).toBe(1)
    expect(data?.summary.toDo).toBe(1)
    expect(data?.summary.effortDelivered).toBe(7)
    expect(data?.summary.effortTotal).toBe(100)
  })

  it('buildDefects', () => {
    const data = calculators.buildDefects('Sprint 1', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.defectCount).toBe(2) // Bug 1, Bug 2
    expect(data?.summary.totalItems).toBe(4)
    expect(data?.summary.defectRate).toBe(50) // 2/4 = 50%
  })

  it('buildTeamStats', () => {
    const data = calculators.buildTeamStats('Sprint 1', 'points', 'Test Project')
    expect(data.summary.activeMembers).toBe(2) // Alice and Bob
    const alice = data.members.find(m => m.assignee === 'Alice')
    expect(alice?.totalEffort).toBe(15) // 5 + 8 + 2
    expect(alice?.totalActual).toBe(7) // 4 + 3
    expect(alice?.closedCount).toBe(2)
  })

  it('buildScorecard', () => {
    const data = calculators.buildScorecard('Sprint 1', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.issuesTotal).toBe(4)
    expect(data?.kpis).toBeDefined()
  })

  it('buildBurndown in date range mode', () => {
    const data = calculators.buildBurndown(null, 'points', 'Test Project', '2026-06-01', '2026-06-15')
    expect(data).toBeDefined()
    expect(data?.summary.total).toBe(100)
    expect(data?.summary.completed).toBe(7)
    expect(data?.items).toHaveLength(4)
  })

  it('buildOverview in date range mode', () => {
    const data = calculators.buildOverview(null, 'points', 'Test Project', '2026-06-01', '2026-06-15')
    expect(data).toBeDefined()
    expect(data?.summary.totalStories).toBe(4)
    expect(data?.summary.doneStories).toBe(2)
  })
})
