import { describe, it, expect } from 'vitest'
import { calculateTransitions } from './github'

describe('calculateTransitions', () => {
  it('handles empty timeline events by keeping the current status indefinitely', () => {
    const createdAt = '2026-06-01T10:00:00Z'
    const transitions = calculateTransitions(createdAt, [], 'In Progress')
    expect(transitions).toEqual([
      {
        status: 'In Progress',
        start_date: createdAt,
        end_date: null
      }
    ])
  })

  it('calculates intervals correctly based on status changes', () => {
    const createdAt = '2026-06-01T10:00:00Z'
    const events = [
      {
        createdAt: '2026-06-02T12:00:00Z',
        previousStatus: 'To Do',
        status: 'In Progress'
      },
      {
        createdAt: '2026-06-04T15:00:00Z',
        previousStatus: 'In Progress',
        status: 'Done'
      }
    ]

    const transitions = calculateTransitions(createdAt, events, 'Done')

    expect(transitions).toEqual([
      {
        status: 'To Do',
        start_date: createdAt,
        end_date: '2026-06-02T12:00:00Z'
      },
      {
        status: 'In Progress',
        start_date: '2026-06-02T12:00:00Z',
        end_date: '2026-06-04T15:00:00Z'
      },
      {
        status: 'Done',
        start_date: '2026-06-04T15:00:00Z',
        end_date: null
      }
    ])
  })

  it('sorts timeline events chronologically before mapping', () => {
    const createdAt = '2026-06-01T10:00:00Z'
    const events = [
      {
        createdAt: '2026-06-04T15:00:00Z',
        previousStatus: 'In Progress',
        status: 'Done'
      },
      {
        createdAt: '2026-06-02T12:00:00Z',
        previousStatus: 'To Do',
        status: 'In Progress'
      }
    ]

    const transitions = calculateTransitions(createdAt, events, 'Done')

    expect(transitions).toEqual([
      {
        status: 'To Do',
        start_date: createdAt,
        end_date: '2026-06-02T12:00:00Z'
      },
      {
        status: 'In Progress',
        start_date: '2026-06-02T12:00:00Z',
        end_date: '2026-06-04T15:00:00Z'
      },
      {
        status: 'Done',
        start_date: '2026-06-04T15:00:00Z',
        end_date: null
      }
    ])
  })
})
