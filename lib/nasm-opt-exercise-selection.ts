/**
 * NASM OPT Intelligent Exercise Selection Engine
 * 
 * This module implements intelligent exercise selection based on:
 * - NASM OPT (Optimum Performance Training) principles
 * - Client fitness level and experience
 * - Available equipment
 * - Training phase and goals
 * - Movement quality progression
 * 
 * Developed with expertise of master NASM personal trainers (20+ years experience)
 */

export interface ClientProfile {
  age: number
  sexe?: string
  experienceLevel?: string
  fitnessGoal?: string
  injuries_limitations?: string
  equipmentAccess: string[]
}

export interface ExerciseRecord {
  id: string
  name: string
  description?: string
  primaryEquipment: string[]
  coachingCues?: string[]
  metadata?: {
    movementPattern?: string
    muscleGroups?: string[]
    complexity?: 'beginner' | 'intermediate' | 'advanced'
    nasmPhases?: number[]
    [key: string]: unknown
  }
}

export interface PhasePrescription {
  phase: number
  phaseName: string
  reps: string
  sets: string
  tempo: string
  rest: string
  intensity: 'low' | 'moderate' | 'high' | 'maximum'
  focus: string
  exercisesPerBodypart: number
}

export interface ExerciseSelection {
  exercise: ExerciseRecord
  reasoning: string
  sets: string
  reps: string
  tempo: string
  rest: string
  notes?: string
  modifications?: string
}

export interface WorkoutDayPlan {
  day: number
  focus: string
  exercises: ExerciseSelection[]
  overallNotes?: string
}

// ── NASM OPT PHASE DEFINITIONS ────────────────────────────────
const PHASE_PRESCRIPTIONS: Record<number, PhasePrescription> = {
  1: {
    phase: 1,
    phaseName: 'Stabilization Endurance',
    reps: '12-20',
    sets: '2-3',
    tempo: '4/2/1',
    rest: '0-90s',
    intensity: 'low',
    focus: 'Movement quality, stability, muscular endurance, flexibility',
    exercisesPerBodypart: 2,
  },
  2: {
    phase: 2,
    phaseName: 'Strength Endurance',
    reps: '8-12',
    sets: '2-4',
    tempo: '2/0/2',
    rest: '0-60s',
    intensity: 'moderate',
    focus: 'Building stronger stabilizers, increased work capacity',
    exercisesPerBodypart: 2,
  },
  3: {
    phase: 3,
    phaseName: 'Muscular Development',
    reps: '6-12',
    sets: '3-5',
    tempo: '2/0/2',
    rest: '30-60s',
    intensity: 'high',
    focus: 'Hypertrophy, muscle growth, increased load management',
    exercisesPerBodypart: 3,
  },
  4: {
    phase: 4,
    phaseName: 'Maximal Strength',
    reps: '1-5',
    sets: '4-6',
    tempo: 'x/x/x',
    rest: '3-5m',
    intensity: 'maximum',
    focus: 'Maximal strength development, neural adaptations',
    exercisesPerBodypart: 2,
  },
  5: {
    phase: 5,
    phaseName: 'Power',
    reps: '1-10',
    sets: '3-5',
    tempo: 'x/x/x',
    rest: '1-2m',
    intensity: 'maximum',
    focus: 'Power development, rate of force development',
    exercisesPerBodypart: 2,
  },
}

// ── MOVEMENT PATTERNS (NASM-based) ────────────────────────────
const FUNDAMENTAL_MOVEMENT_PATTERNS = [
  'squat',
  'lunge',
  'push',
  'pull',
  'rotation',
  'gait', // includes carry, walk, etc.
]

// ── EXERCISE COMPLEXITY LEVELS ────────────────────────────────
function getExperienceLevelAsNumber(level?: string): number {
  const normalized = String(level ?? '').toLowerCase()
  if (normalized.includes('beginner') || normalized.includes('novice')) return 1
  if (normalized.includes('intermediate')) return 2
  if (normalized.includes('advanced') || normalized.includes('expert')) return 3
  return 1 // default to beginner
}

function getComplexityRequirement(phase: number, experienceLevel: number): 'beginner' | 'intermediate' | 'advanced' {
  if (experienceLevel === 1) return 'beginner'
  if (phase === 1 || phase === 2) return 'beginner'
  if (phase === 3) return experienceLevel >= 2 ? 'intermediate' : 'beginner'
  return experienceLevel === 3 ? 'advanced' : 'intermediate'
}

function exerciseMatchesComplexity(exercise: ExerciseRecord, targetComplexity: string): boolean {
  const exerciseComplexity = exercise.metadata?.complexity ?? 'beginner'
  const complexityOrder: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  }

  const targetLevel = complexityOrder[targetComplexity] ?? 1
  const exerciseLevel = complexityOrder[exerciseComplexity] ?? 1

  return exerciseLevel <= targetLevel
}

// Extract muscle groups from exercise name/description
function extractMuscleGroupsFromExercise(exercise: ExerciseRecord): string[] {
  const text = `${exercise.name} ${exercise.description || ''}`.toLowerCase()

  const muscleKeywords: Record<string, string[]> = {
    chest: ['chest', 'pec', 'bench press'],
    back: ['back', 'lat', 'row', 'pull'],
    shoulders: ['shoulder', 'press', 'raise', 'delt'],
    biceps: ['bicep', 'curl', 'arm'],
    triceps: ['tricep', 'press', 'dip'],
    forearms: ['forearm', 'wrist curl'],
    quadriceps: ['quad', 'leg press', 'leg extension', 'squat'],
    hamstrings: ['hamstring', 'leg curl', 'deadlift', 'rdl'],
    glutes: ['glute', 'hip thrust', 'leg press', 'squat', 'lunge'],
    calves: ['calf', 'ankle'],
    core: ['core', 'crunch', 'plank', 'ab', 'core'],
    legs: ['leg', 'squat', 'lunge', 'extension', 'curl'],
  }

  const detected = new Set<string>()
  for (const [muscle, keywords] of Object.entries(muscleKeywords)) {
    if (keywords.some(k => text.includes(k))) {
      detected.add(muscle)
    }
  }

  return Array.from(detected)
}

function exerciseMatchesEquipment(exercise: ExerciseRecord, availableEquipment: string[]): boolean {
  // Exercises with no primary equipment (bodyweight) always match
  if (exercise.primaryEquipment.length === 0) {
    return true
  }

  const normalizedAvailable = availableEquipment.map(item =>
    String(item ?? '').toLowerCase().trim()
  )

  return exercise.primaryEquipment.some(equipment => {
    const normalizedEquip = String(equipment ?? '').toLowerCase().trim()

    // Direct match
    if (normalizedAvailable.includes(normalizedEquip)) return true

    // Fuzzy matching for common variations
    if (normalizedEquip.includes('dumbbell') && normalizedAvailable.some(e => e.includes('dumbbell'))) return true
    if (normalizedEquip.includes('barbell') && normalizedAvailable.some(e => e.includes('barbell'))) return true
    if (normalizedEquip.includes('cable') && normalizedAvailable.some(e => e.includes('cable'))) return true
    if (normalizedEquip.includes('machine') && normalizedAvailable.some(e => e.includes('machine'))) return true
    if (normalizedEquip.includes('band') && normalizedAvailable.some(e => e.includes('band') || e.includes('resistance'))) return true
    if (normalizedEquip.includes('kettlebell') && normalizedAvailable.some(e => e.includes('kettlebell'))) return true
    if (normalizedEquip.includes('trx') && normalizedAvailable.some(e => e.includes('trx') || e.includes('suspension'))) return true
    if ((normalizedEquip.includes('bodyweight') || normalizedEquip === 'none') && normalizedAvailable.includes('bodyweight')) return true

    return false
  })
}

function isExerciseAppropriateForInjuries(
  exercise: ExerciseRecord,
  injuries?: string
): boolean {
  if (!injuries || injuries.trim().length === 0) return true

  const injuryText = injuries.toLowerCase()
  const exerciseName = exercise.name.toLowerCase()

  // Conservative approach: exclude if exercise directly targets injured area
  const injuryConcerns: Record<string, string[]> = {
    'knee': ['squat', 'lunge', 'leg press', 'walking', 'running', 'jumping', 'knee extension'],
    'shoulder': ['press', 'pull-up', 'row', 'lateral raise', 'shoulder press', 'military press', 'overhead'],
    'back': ['deadlift', 'row', 'extension', 'spinal', 'back press'],
    'neck': ['neck', 'trap'],
    'wrist': ['wrist', 'curl', 'push-up'],
    'ankle': ['ankle', 'calf', 'jump', 'hop'],
    'hip': ['hip', 'glute', 'lateral', 'abduction', 'adduction'],
    'elbow': ['curl', 'press', 'tricep', 'arm'],
  }

  for (const [injuredArea, concernedMoves] of Object.entries(injuryConcerns)) {
    if (injuryText.includes(injuredArea)) {
      if (concernedMoves.some(move => exerciseName.includes(move))) {
        return false
      }
    }
  }

  return true
}

function getMovementPatternForExercise(exercise: ExerciseRecord): string {
  const name = exercise.name.toLowerCase()
  const pattern = exercise.metadata?.movementPattern?.toLowerCase() ?? name

  if (pattern.includes('squat') || pattern.includes('leg press')) return 'squat'
  if (pattern.includes('lunge') || pattern.includes('step')) return 'lunge'
  if (pattern.includes('push') || pattern.includes('press') || pattern.includes('bench')) {
    if (pattern.includes('incline') || pattern.includes('decline')) return 'push'
    if (pattern.includes('vertical')) return 'push'
    return 'push'
  }
  if (pattern.includes('pull') || pattern.includes('row') || pattern.includes('pull-up') || pattern.includes('lat')) return 'pull'
  if (pattern.includes('rotation') || pattern.includes('chop') || pattern.includes('wood')) return 'rotation'
  if (pattern.includes('carry') || pattern.includes('walk') || pattern.includes('farmer')) return 'gait'

  return 'other'
}

// ── PRIMARY EXERCISE SELECTION ENGINE ────────────────────────
export function selectExercisesForWorkoutDay(
  phase: number,
  dayFocus: string,
  exercises: ExerciseRecord[],
  client: ClientProfile,
  exerciseCountTarget: number = 4
): ExerciseRecord[] {
  const prescription = PHASE_PRESCRIPTIONS[phase] || PHASE_PRESCRIPTIONS[1]
  const experienceLevel = getExperienceLevelAsNumber(client.experienceLevel)
  const complexityTarget = getComplexityRequirement(phase, experienceLevel)

  // Filter exercises based on constraints
  const candidateExercises = exercises.filter(exercise => {
    // Must match equipment access
    if (!exerciseMatchesEquipment(exercise, client.equipmentAccess)) {
      return false
    }

    // Must match complexity level
    if (!exerciseMatchesComplexity(exercise, complexityTarget)) {
      return false
    }

    // Must be safe for client's injuries
    if (!isExerciseAppropriateForInjuries(exercise, client.injuries_limitations)) {
      return false
    }

    return true
  })

  if (candidateExercises.length === 0) {
    return exercises.slice(0, exerciseCountTarget)
  }

  // Score exercises based on day focus and NASM principles
  const scoredExercises = candidateExercises.map(exercise => {
    let score = 0

    // Prioritize exercises that match NASM phase
    const exercisePhases = exercise.metadata?.nasmPhases ?? []
    if (exercisePhases.includes(phase)) {
      score += 100
    }

    // Prioritize exercises matching the day focus
    const dayFocusLower = dayFocus.toLowerCase()
    
    // Extract muscle groups from exercise name/description
    const extractedMuscles = extractMuscleGroupsFromExercise(exercise)
    const metadataMuscles = exercise.metadata?.muscleGroups ?? []
    const allMuscles = [...new Set([...extractedMuscles, ...metadataMuscles.map(m => m.toLowerCase())])]
    
    // Check if any extracted muscle matches the day focus
    if (
      allMuscles.some(muscle => dayFocusLower.includes(muscle)) ||
      allMuscles.some(muscle => dayFocusLower.includes(muscle.split(' ')[0])) ||
      exercise.name.toLowerCase().includes(dayFocusLower.split(' ')[0])
    ) {
      score += 80  // Increased from 50 for better matching
    }

    // Prefer exercises with multiple muscle group benefits
    score += allMuscles.length * 15

    // Add randomness to prevent repetitiveness
    score += Math.random() * 10  // Reduced from 20 to make scoring more deterministic

    return { exercise, score }
  })

  // Sort by score and take top N
  return scoredExercises
    .sort((a, b) => b.score - a.score)
    .slice(0, exerciseCountTarget)
    .map(item => item.exercise)
}

// ── DETERMINE TRAINING FOCUS ──────────────────────────────────
export function determineWorkoutFocus(
  dayNumber: number,
  totalDaysPerWeek: number,
  phase: number
): string[] {
  const dayOfWeek = ((dayNumber - 1) % totalDaysPerWeek) + 1

  // Typical split recommendations from NASM OPT
  if (totalDaysPerWeek === 2) {
    return dayOfWeek === 1 ? ['Upper Body'] : ['Lower Body']
  }

  if (totalDaysPerWeek === 3) {
    if (dayOfWeek === 1) return ['Upper Body', 'Chest', 'Back']
    if (dayOfWeek === 2) return ['Lower Body', 'Quadriceps', 'Hamstrings']
    return ['Full Body', 'Core']
  }

  if (totalDaysPerWeek === 4) {
    if (dayOfWeek === 1) return ['Upper Body Push', 'Chest', 'Shoulders', 'Triceps']
    if (dayOfWeek === 2) return ['Lower Body', 'Quadriceps', 'Hamstrings', 'Glutes']
    if (dayOfWeek === 3) return ['Upper Body Pull', 'Back', 'Biceps']
    return ['Lower Body', 'Glutes', 'Hamstrings', 'Calves']
  }

  if (totalDaysPerWeek === 5) {
    if (dayOfWeek === 1) return ['Chest', 'Triceps']
    if (dayOfWeek === 2) return ['Back', 'Biceps']
    if (dayOfWeek === 3) return ['Legs', 'Glutes']
    if (dayOfWeek === 4) return ['Shoulders']
    return ['Full Body', 'Core']
  }

  // Default: full body or balanced splits
  return ['Full Body', 'Upper Body', 'Lower Body', 'Core']
}

export function getPhasePrescription(phase: number): PhasePrescription {
  return PHASE_PRESCRIPTIONS[phase] || PHASE_PRESCRIPTIONS[1]
}

export function getClientExperienceProfile(client: ClientProfile): {
  level: number
  description: string
} {
  const level = getExperienceLevelAsNumber(client.experienceLevel)
  const descriptions = [
    '',
    'Beginner - Limited resistance training experience',
    'Intermediate - Regular resistance training experience',
    'Advanced - Extensive resistance training experience',
  ]
  return {
    level,
    description: descriptions[level] || descriptions[1],
  }
}
