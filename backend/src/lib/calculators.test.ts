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
      INSERT INTO items (github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id, project_id, closed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertItem.run(101, 'Story 1', 1, 'url', 'issue', 'Done', 'closed', 5, 4, 'Alice', 1, 1, '2026-06-05', '2026-06-01')
    insertItem.run(102, 'Bug 1', 2, 'url', 'bug', 'In Progress', 'open', 3, 1, 'Bob', 1, 1, null, '2026-06-01')
    insertItem.run(103, 'Story 2', 3, 'url', 'issue', 'To Do', 'open', 8, null, 'Alice', 1, 1, null, '2026-06-01')
    insertItem.run(104, 'Bug 2', 4, 'url', 'bug', 'Done', 'closed', 2, 3, 'Alice', 1, 1, '2026-06-10', '2026-06-01')
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

  it('calculates cycle time and actual hours from transitions when actual_time is null', () => {
    mockDb.prepare("UPDATE items SET status = 'Done', closed_at = '2026-06-04T10:00:00Z' WHERE id = 3").run()
    
    const insertTransition = mockDb.prepare(`
      INSERT INTO item_transitions (item_id, status, start_date, end_date) VALUES (?, ?, ?, ?)
    `)
    insertTransition.run(3, 'To Do', '2026-06-01T00:00:00Z', '2026-06-02T10:00:00Z')
    insertTransition.run(3, 'In Progress', '2026-06-02T10:00:00Z', '2026-06-04T10:00:00Z')
    insertTransition.run(3, 'Done', '2026-06-04T10:00:00Z', null)

    const cycleTimeData = calculators.buildCycleTime('Sprint 1', 'Test Project')
    expect(cycleTimeData).toBeDefined()
    const aliceCT = cycleTimeData?.assignees.find(a => a.assignee === 'Alice')
    const item3CT = aliceCT?.items.find(i => i.number === 3)
    expect(item3CT?.cycleTime).toBe(2)

    const commitmentData = calculators.buildCommitmentByAssignee('Sprint 1', 'points', 'Test Project')
    expect(commitmentData).toBeDefined()
    const aliceCommitment = commitmentData?.assignees.find(a => a.assignee === 'Alice')
    const item3Commit = aliceCommitment?.items.find(i => i.title === 'Story 2')
    expect(item3Commit?.actual_time).toBe(16)
  })

  it('calculates actual hours from creation date when no in progress transitions exist', () => {
    // Seed Bug 2 (id 4) as Done with no transitions and null actual_time
    mockDb.prepare("UPDATE items SET status = 'Done', actual_time = NULL, closed_at = '2026-06-04T00:00:00Z', created_at = '2026-06-01T00:00:00Z' WHERE id = 4").run()

    // 2026-06-04 - 2026-06-01 = 3 days * 8 hours/day = 24 hours
    const commitmentData = calculators.buildCommitmentByAssignee('Sprint 1', 'points', 'Test Project')
    expect(commitmentData).toBeDefined()
    const aliceCommitment = commitmentData?.assignees.find(a => a.assignee === 'Alice')
    const item4Commit = aliceCommitment?.items.find(i => i.title === 'Bug 2')
    expect(item4Commit?.actual_time).toBe(24)
  })

  it('buildTimesheet in sprint mode', () => {
    const data = calculators.buildTimesheet('Sprint 1', 'Test Project')
    expect(data).toBeDefined()
    expect(data?.summary.totalActual).toBe(8) // Alice (7) + Bob (1) = 8
    expect(data?.summary.assigneesCount).toBe(2) // Alice and Bob
    expect(data?.summary.tasksCount).toBe(4) // 3 Alice tasks + 1 Bob task

    const alice = data?.assignees.find(a => a.assignee === 'Alice')
    expect(alice).toBeDefined()
    expect(alice?.totalActual).toBe(7) // Story 1 (4) + Bug 2 (3) + Story 2 (0)
    expect(alice?.taskCount).toBe(3)
    expect(alice?.tasks).toHaveLength(3)
    expect(alice?.tasks[0].state).toBe('closed') // Story 1 (number 1) is closed
    expect(alice?.tasks[1].state).toBe('open')   // Story 2 (number 3) is open
    expect(alice?.tasks[2].state).toBe('closed') // Bug 2 (number 4) is closed

    const bob = data?.assignees.find(a => a.assignee === 'Bob')
    expect(bob).toBeDefined()
    expect(bob?.totalActual).toBe(1)
    expect(bob?.taskCount).toBe(1)
    expect(bob?.tasks[0].state).toBe('open')
  })

  it('buildTimesheet in date range mode', () => {
    const data = calculators.buildTimesheet(null, 'Test Project', '2026-06-01', '2026-06-15')
    expect(data).toBeDefined()
    expect(data?.summary.totalActual).toBe(8)
    expect(data?.summary.assigneesCount).toBe(2)
  })

  it('calculates carry over correctly', () => {
    // 1. Item created before sprint (sprint start is 2026-06-01)
    mockDb.prepare(`
      INSERT INTO items (github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id, project_id, created_at)
      VALUES (105, 'Carry Over 1', 5, 'url', 'issue', 'To Do', 'open', 3, null, 'Alice', 1, 1, '2026-05-15 12:00:00')
    `).run()

    // 2. Item created after sprint start (2026-06-02) but moved to In Progress before sprint (2026-05-25)
    mockDb.prepare(`
      INSERT INTO items (id, github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id, project_id, created_at)
      VALUES (206, 206, 'Carry Over 2', 6, 'url', 'issue', 'In Progress', 'open', 3, null, 'Bob', 1, 1, '2026-06-02 12:00:00')
    `).run()
    mockDb.prepare(`
      INSERT INTO item_transitions (item_id, status, start_date, end_date)
      VALUES (206, 'In Progress', '2026-05-25 10:00:00', null)
    `).run()

    // 3. Normal item created after sprint start (2026-06-02) and no early transitions
    mockDb.prepare(`
      INSERT INTO items (id, github_id, title, number, url, type, status, state, effort, actual_time, assignee, sprint_id, project_id, created_at)
      VALUES (207, 207, 'New Item', 7, 'url', 'issue', 'To Do', 'open', 3, null, 'Bob', 1, 1, '2026-06-02 12:00:00')
    `).run()

    const data = calculators.buildBurndown('Sprint 1', 'points', 'Test Project')
    expect(data).toBeDefined()
    const item5 = data?.items.find(i => i.number === 5)
    const item6 = data?.items.find(i => i.number === 6)
    const item7 = data?.items.find(i => i.number === 7)

    expect(item5?.is_carry_over).toBe(1)
    expect(item6?.is_carry_over).toBe(1)
    expect(item7?.is_carry_over).toBe(0)

    const tsData = calculators.buildTimesheet('Sprint 1', 'Test Project')
    expect(tsData).toBeDefined()
    const aliceTasks = tsData?.assignees.find(a => a.assignee === 'Alice')?.tasks || []
    const bobTasks = tsData?.assignees.find(a => a.assignee === 'Bob')?.tasks || []

    const tsItem5 = aliceTasks.find(t => t.number === 5)
    const tsItem6 = bobTasks.find(t => t.number === 6)
    const tsItem7 = bobTasks.find(t => t.number === 7)

    expect(tsItem5?.is_carry_over).toBe(1)
    expect(tsItem6?.is_carry_over).toBe(1)
    expect(tsItem7?.is_carry_over).toBe(0)
  })
})

