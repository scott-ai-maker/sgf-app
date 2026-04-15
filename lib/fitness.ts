export type GoalType = 'fat-loss' | 'muscle-gain' | 'performance' | 'general-fitness'
export type WorkoutLocation = 'home' | 'gym' | 'both'
export type EquipmentType =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'bench'
  | 'cable-machine'
  | 'machines'
  | 'kettlebells'
  | 'bands'
  | 'trx'
  | 'medicine-ball'

export type NasmOptPhase = 1 | 2 | 3 | 4 | 5

export interface ProfileInputs {
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
  trainingDaysPerWeek?: number
  fitnessGoal?: GoalType
  workoutLocation?: WorkoutLocation
  equipmentAccess?: string[]
}

export interface WorkoutTemplate {
  day: number
  focus: string
  exercises: Array<{
    name: string
    sets: string
    reps: string
    tempo?: string
    rest?: string
  }>
}

export interface GeneratedWorkoutPlan {
  phase: NasmOptPhase
  phaseName: string
  rationale: string
  sessionsPerWeek: number
  estimatedDurationMins: number
  workouts: WorkoutTemplate[]
}

const PHASE_NAMES: Record<NasmOptPhase, string> = {
  1: 'Stabilization Endurance',
  2: 'Strength Endurance',
  3: 'Muscular Development',
  4: 'Maximal Strength',
  5: 'Power',
}

const EXERCISE_REQUIREMENTS: Record<string, EquipmentType[]> = {
  'Goblet Squat': ['dumbbells'],
  'Push-Up': ['bodyweight'],
  'Single-Leg RDL': ['dumbbells'],
  'Single-Arm Dumbbell Row': ['dumbbells'],
  'Band Row': ['bands'],
  'Dumbbell Romanian Deadlift': ['dumbbells'],
  'Dumbbell Push Press': ['dumbbells'],
  'Cable Row': ['cable-machine'],
  'Step-Up to Balance': ['bodyweight'],
  'Single-Arm Dumbbell Press': ['dumbbells'],
  'TRX Row': ['trx'],
  'Plank': ['bodyweight'],
  'Back Squat': ['barbell'],
  'Squat Jump': ['bodyweight'],
  'Romanian Deadlift': ['barbell'],
  'Dumbbell Bench Press': ['dumbbells', 'bench'],
  'Medicine Ball Chest Pass': ['medicine-ball'],
  'Bent Over Row': ['barbell'],
  'Barbell Bench Press': ['barbell', 'bench'],
  'Incline Dumbbell Press': ['dumbbells', 'bench'],
  'Overhead Press': ['barbell'],
  'Deadlift': ['barbell'],
  'Lat Pulldown': ['cable-machine'],
  'Leg Press': ['machines'],
  'Bench Press': ['barbell', 'bench'],
  'Weighted Pull-Up': ['bodyweight'],
  'Barbell Row': ['barbell'],
  'Hang Clean': ['barbell'],
  'Box Jump': ['bodyweight'],
  'Front Squat': ['barbell'],
  'Push Press': ['barbell'],
  'Medicine Ball Slam': ['medicine-ball'],
  'Split Squat': ['bodyweight'],
}

function normalizeEquipment(input: string[] | undefined): Set<EquipmentType> {
  const set = new Set<EquipmentType>()
  for (const raw of input ?? []) {
    const value = String(raw).trim().toLowerCase()
    if (value === 'bodyweight') set.add('bodyweight')
    if (value === 'dumbbells') set.add('dumbbells')
    if (value === 'barbell') set.add('barbell')
    if (value === 'bench') set.add('bench')
    if (value === 'cable-machine') set.add('cable-machine')
    if (value === 'machines') set.add('machines')
    if (value === 'kettlebells') set.add('kettlebells')
    if (value === 'bands') set.add('bands')
    if (value === 'trx') set.add('trx')
    if (value === 'medicine-ball') set.add('medicine-ball')
  }
  if (set.size === 0) set.add('bodyweight')
  return set
}

function canPerformExercise(name: string, equipment: Set<EquipmentType>) {
  const required = EXERCISE_REQUIREMENTS[name]
  if (!required || required.length === 0) return true
  return required.every(item => equipment.has(item))
}

function pickReplacement(name: string, equipment: Set<EquipmentType>) {
  const has = (key: EquipmentType) => equipment.has(key)

  if ((name === 'Back Squat' || name === 'Front Squat') && has('dumbbells')) return 'Goblet Squat'
  if ((name === 'Back Squat' || name === 'Front Squat') && has('bodyweight')) return 'Split Squat'
  if (name === 'Deadlift' && has('dumbbells')) return 'Dumbbell Romanian Deadlift'
  if (name === 'Romanian Deadlift' && has('dumbbells')) return 'Dumbbell Romanian Deadlift'

  if ((name === 'Cable Row' || name === 'Lat Pulldown') && has('dumbbells')) return 'Single-Arm Dumbbell Row'
  if ((name === 'Cable Row' || name === 'Lat Pulldown') && has('bands')) return 'Band Row'
  if ((name === 'Cable Row' || name === 'Lat Pulldown') && has('trx')) return 'TRX Row'

  if ((name === 'Barbell Bench Press' || name === 'Bench Press') && has('dumbbells') && has('bench')) return 'Dumbbell Bench Press'
  if ((name === 'Barbell Bench Press' || name === 'Bench Press') && has('bodyweight')) return 'Push-Up'
  if (name === 'Incline Dumbbell Press' && has('bodyweight')) return 'Push-Up'
  if (name === 'Overhead Press' && has('dumbbells')) return 'Single-Arm Dumbbell Press'

  if (name === 'Leg Press' && has('bodyweight')) return 'Step-Up to Balance'
  if (name === 'Bent Over Row' && has('dumbbells')) return 'Single-Arm Dumbbell Row'
  if (name === 'Barbell Row' && has('trx')) return 'TRX Row'

  if (name === 'Medicine Ball Chest Pass' && has('bodyweight')) return 'Push-Up'
  if (name === 'Medicine Ball Slam' && has('bodyweight')) return 'Squat Jump'

  if ((name === 'Hang Clean' || name === 'Push Press') && has('dumbbells')) return 'Dumbbell Push Press'
  if ((name === 'Hang Clean' || name === 'Push Press') && has('bodyweight')) return 'Squat Jump'

  return has('bodyweight') ? 'Plank' : name
}

function adaptWorkoutsForEquipment(workouts: WorkoutTemplate[], equipment: Set<EquipmentType>): WorkoutTemplate[] {
  return workouts.map(day => ({
    ...day,
    exercises: day.exercises.map(exercise => {
      if (canPerformExercise(exercise.name, equipment)) return exercise

      const replacementName = pickReplacement(exercise.name, equipment)
      if (replacementName === exercise.name || !canPerformExercise(replacementName, equipment)) {
        return { ...exercise, name: 'Plank' }
      }

      return { ...exercise, name: replacementName }
    }),
  }))
}

export function chooseNasmOptPhase(inputs: ProfileInputs): NasmOptPhase {
  const exp = inputs.experienceLevel ?? 'beginner'
  const days = inputs.trainingDaysPerWeek ?? 3
  const goal = inputs.fitnessGoal ?? 'general-fitness'

  if (goal === 'fat-loss' || goal === 'general-fitness') return exp === 'advanced' && days >= 4 ? 2 : 1
  if (goal === 'muscle-gain') return exp === 'advanced' ? 3 : 2
  if (goal === 'performance') return exp === 'advanced' ? 5 : 4

  return 1
}

function baseTemplate(phase: NasmOptPhase): WorkoutTemplate[] {
  if (phase === 1) {
    return [
      {
        day: 1,
        focus: 'Total Body Stability',
        exercises: [
          { name: 'Goblet Squat', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
          { name: 'Push-Up', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
          { name: 'Single-Leg RDL', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
          { name: 'Cable Row', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
        ],
      },
      {
        day: 2,
        focus: 'Core + Balance',
        exercises: [
          { name: 'Step-Up to Balance', sets: '2-3', reps: '10-15', tempo: '4/2/1', rest: '0-60s' },
          { name: 'Single-Arm Dumbbell Press', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
          { name: 'TRX Row', sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-60s' },
          { name: 'Plank', sets: '2-3', reps: '30-60s', rest: '0-60s' },
        ],
      },
    ]
  }

  if (phase === 2) {
    return [
      {
        day: 1,
        focus: 'Lower Body Strength Endurance',
        exercises: [
          { name: 'Back Squat', sets: '3-4', reps: '8-12', tempo: '2/0/2', rest: '60-90s' },
          { name: 'Squat Jump', sets: '3', reps: '8-10', rest: '60s' },
          { name: 'Romanian Deadlift', sets: '3-4', reps: '8-12', tempo: '2/0/2', rest: '60-90s' },
        ],
      },
      {
        day: 2,
        focus: 'Upper Body Strength Endurance',
        exercises: [
          { name: 'Dumbbell Bench Press', sets: '3-4', reps: '8-12', tempo: '2/0/2', rest: '60-90s' },
          { name: 'Medicine Ball Chest Pass', sets: '3', reps: '8-10', rest: '60s' },
          { name: 'Bent Over Row', sets: '3-4', reps: '8-12', tempo: '2/0/2', rest: '60-90s' },
        ],
      },
    ]
  }

  if (phase === 3) {
    return [
      {
        day: 1,
        focus: 'Hypertrophy Push',
        exercises: [
          { name: 'Barbell Bench Press', sets: '3-5', reps: '6-12', tempo: '2/0/2', rest: '0-60s' },
          { name: 'Incline Dumbbell Press', sets: '3-4', reps: '8-12', rest: '0-60s' },
          { name: 'Overhead Press', sets: '3-4', reps: '8-12', rest: '0-60s' },
        ],
      },
      {
        day: 2,
        focus: 'Hypertrophy Pull + Legs',
        exercises: [
          { name: 'Deadlift', sets: '3-5', reps: '6-10', tempo: '2/0/2', rest: '0-60s' },
          { name: 'Lat Pulldown', sets: '3-4', reps: '8-12', rest: '0-60s' },
          { name: 'Leg Press', sets: '3-4', reps: '8-12', rest: '0-60s' },
        ],
      },
    ]
  }

  if (phase === 4) {
    return [
      {
        day: 1,
        focus: 'Maximal Strength Lower',
        exercises: [
          { name: 'Back Squat', sets: '4-6', reps: '1-5', tempo: 'x/x/x', rest: '3-5m' },
          { name: 'Deadlift', sets: '4-6', reps: '1-5', tempo: 'x/x/x', rest: '3-5m' },
          { name: 'Split Squat', sets: '3-4', reps: '6-8', rest: '2-3m' },
        ],
      },
      {
        day: 2,
        focus: 'Maximal Strength Upper',
        exercises: [
          { name: 'Bench Press', sets: '4-6', reps: '1-5', tempo: 'x/x/x', rest: '3-5m' },
          { name: 'Weighted Pull-Up', sets: '4-6', reps: '1-5', tempo: 'x/x/x', rest: '3-5m' },
          { name: 'Barbell Row', sets: '3-4', reps: '4-6', rest: '2-3m' },
        ],
      },
    ]
  }

  return [
    {
      day: 1,
      focus: 'Power Lower',
      exercises: [
        { name: 'Hang Clean', sets: '4-5', reps: '3-5', rest: '3-5m' },
        { name: 'Box Jump', sets: '4-5', reps: '5-8', rest: '2m' },
        { name: 'Front Squat', sets: '3-4', reps: '3-5', rest: '2-3m' },
      ],
    },
    {
      day: 2,
      focus: 'Power Upper',
      exercises: [
        { name: 'Push Press', sets: '4-5', reps: '3-5', rest: '3-5m' },
        { name: 'Medicine Ball Slam', sets: '4-5', reps: '6-8', rest: '2m' },
        { name: 'Weighted Pull-Up', sets: '3-4', reps: '3-5', rest: '2-3m' },
      ],
    },
  ]
}

export function generateNasmOptPlan(inputs: ProfileInputs): GeneratedWorkoutPlan {
  const phase = chooseNasmOptPhase(inputs)
  const phaseName = PHASE_NAMES[phase]
  const sessionsPerWeek = Math.min(Math.max(inputs.trainingDaysPerWeek ?? 3, 2), 6)
  const equipment = normalizeEquipment(inputs.equipmentAccess)
  const workouts = adaptWorkoutsForEquipment(baseTemplate(phase), equipment)
  const equipmentSummary = [...equipment].join(', ')

  return {
    phase,
    phaseName,
    rationale: `Plan starts in NASM OPT Phase ${phase} (${phaseName}) based on stated goal and experience, and is constrained to selected equipment (${equipmentSummary}).`,
    sessionsPerWeek,
    estimatedDurationMins: phase <= 2 ? 45 : 60,
    workouts,
  }
}

export interface BodyFatInputs {
  sex: 'male' | 'female' | 'other'
  heightCm: number
  weightKg: number
  waistCm?: number
  neckCm?: number
  hipCm?: number
}

function roundToTwo(n: number) {
  return Math.round(n * 100) / 100
}

export function estimateBodyFatPercent(inputs: BodyFatInputs): number {
  const { sex, heightCm, waistCm, neckCm, hipCm, weightKg } = inputs

  if (sex === 'male' && waistCm && neckCm) {
    const value = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
    return roundToTwo(Math.max(3, Math.min(value, 45)))
  }

  if (sex === 'female' && waistCm && neckCm && hipCm) {
    const value = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450
    return roundToTwo(Math.max(8, Math.min(value, 55)))
  }

  // Fallback to BMI-derived estimate if circumference fields are unavailable.
  const bmi = weightKg / ((heightCm / 100) * (heightCm / 100))
  const sexFlag = sex === 'male' ? 1 : 0
  const value = 1.2 * bmi + 0.23 * 30 - 10.8 * sexFlag - 5.4
  return roundToTwo(Math.max(5, Math.min(value, 50)))
}
