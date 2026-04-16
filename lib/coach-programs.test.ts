import { describe, expect, it } from 'vitest'
import { buildPlanName, buildStoredProgramPlan } from '@/lib/coach-programs'

describe('coach program builder helpers', () => {
  it('matches exercise metadata from the library by id', () => {
    const plan = buildStoredProgramPlan(
      {
        clientId: 'client-1',
        name: 'Strength Block',
        goal: 'muscle-gain',
        nasmOptPhase: 2,
        phaseName: 'Strength Endurance',
        sessionsPerWeek: 3,
        estimatedDurationMins: 55,
        startDate: '2026-04-20',
        workouts: [
          {
            day: 1,
            focus: 'Upper',
            exercises: [
              {
                libraryExerciseId: 'exercise-1',
                name: 'Cable Row',
                sets: '3',
                reps: '10',
              },
            ],
          },
        ],
      },
      [
        {
          id: 'exercise-1',
          name: 'Cable Row',
          description: 'Row variation for horizontal pulling strength.',
          coaching_cues: ['Keep the ribs stacked', 'Drive the elbow back'],
          primary_equipment: ['Cable Machine'],
          media_image_url: 'https://example.com/cable-row.jpg',
          media_video_url: 'https://example.com/cable-row.mp4',
        },
      ],
      [{ id: 'equipment-1', name: 'Cable Machine' }]
    )

    expect(plan.workouts[0]?.exercises[0]?.description).toContain('horizontal pulling')
    expect(plan.workouts[0]?.exercises[0]?.primaryEquipment).toEqual(['Cable Machine'])
    expect(plan.librarySummary.equipmentCount).toBe(1)
  })

  it('generates scheduled dates when a workout day does not provide one', () => {
    const plan = buildStoredProgramPlan(
      {
        clientId: 'client-1',
        name: 'Conditioning Block',
        goal: 'fat-loss',
        nasmOptPhase: 1,
        phaseName: 'Stabilization Endurance',
        sessionsPerWeek: 2,
        estimatedDurationMins: 45,
        startDate: '2026-04-20',
        workouts: [
          {
            day: 1,
            focus: 'Day A',
            exercises: [{ name: 'Split Squat', sets: '2', reps: '12' }],
          },
          {
            day: 2,
            focus: 'Day B',
            exercises: [{ name: 'Push-Up', sets: '2', reps: '12' }],
          },
        ],
      },
      [],
      []
    )

    expect(plan.calendar[0]?.scheduledDate).toBe('2026-04-20')
    expect(plan.calendar[1]?.scheduledDate).toBe('2026-04-24')
  })

  it('falls back to a phase-based name when the custom name is blank', () => {
    expect(buildPlanName({ name: '   ', phaseName: 'Power' })).toBe('Power Program')
  })
})