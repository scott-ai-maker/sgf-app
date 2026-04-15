import { describe, expect, it } from 'vitest'
import { chooseNasmOptPhase, estimateBodyFatPercent, generateNasmOptPlan } from '@/lib/fitness'

describe('fitness planning logic', () => {
  it('selects phase 5 for advanced performance athletes', () => {
    expect(
      chooseNasmOptPhase({
        experienceLevel: 'advanced',
        trainingDaysPerWeek: 5,
        fitnessGoal: 'performance',
      })
    ).toBe(5)
  })

  it('clamps generated sessions per week to a safe upper bound', () => {
    const plan = generateNasmOptPlan({
      experienceLevel: 'advanced',
      trainingDaysPerWeek: 9,
      fitnessGoal: 'muscle-gain',
      equipmentAccess: ['barbell', 'bench'],
    })

    expect(plan.sessionsPerWeek).toBe(6)
  })

  it('replaces unsupported equipment exercises for bodyweight-only users', () => {
    const plan = generateNasmOptPlan({
      experienceLevel: 'beginner',
      trainingDaysPerWeek: 3,
      fitnessGoal: 'fat-loss',
      equipmentAccess: ['bodyweight'],
    })

    const exerciseNames = plan.workouts.flatMap(workout => workout.exercises.map(exercise => exercise.name))

    expect(exerciseNames).not.toContain('Goblet Squat')
    expect(exerciseNames).not.toContain('Single-Leg RDL')
    expect(exerciseNames).not.toContain('Cable Row')
    expect(exerciseNames).not.toContain('Single-Arm Dumbbell Press')
    expect(exerciseNames).not.toContain('TRX Row')
  })

  it('uses circumference inputs when available for body fat estimation', () => {
    const estimate = estimateBodyFatPercent({
      sex: 'male',
      heightCm: 180,
      weightKg: 84,
      waistCm: 89,
      neckCm: 40,
    })

    expect(estimate).toBeGreaterThan(5)
    expect(estimate).toBeLessThan(30)
  })
})