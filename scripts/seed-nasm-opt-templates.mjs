import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const source = 'nasm_opt_starter'

const templates = [
  {
    slug: 'nasm-phase-1-stabilization-foundation',
    title: 'NASM Phase 1 - Stabilization Foundation',
    goal: 'general-fitness',
    nasm_opt_phase: 1,
    phase_name: 'Stabilization Endurance',
    sessions_per_week: 3,
    estimated_duration_mins: 45,
    template_json: {
      workouts: [
        { day: 1, focus: 'Total Body Stability' },
        { day: 2, focus: 'Core + Balance' },
        { day: 3, focus: 'Total Body Stability' },
      ],
    },
  },
  {
    slug: 'nasm-phase-2-strength-endurance-base',
    title: 'NASM Phase 2 - Strength Endurance Base',
    goal: 'muscle-gain',
    nasm_opt_phase: 2,
    phase_name: 'Strength Endurance',
    sessions_per_week: 4,
    estimated_duration_mins: 50,
    template_json: {
      workouts: [
        { day: 1, focus: 'Lower Body Strength Endurance' },
        { day: 2, focus: 'Upper Body Push' },
        { day: 3, focus: 'Upper Body Pull + Core' },
        { day: 4, focus: 'Total Body Strength Endurance' },
      ],
    },
  },
  {
    slug: 'nasm-phase-3-hypertrophy-build',
    title: 'NASM Phase 3 - Hypertrophy Build',
    goal: 'muscle-gain',
    nasm_opt_phase: 3,
    phase_name: 'Muscular Development',
    sessions_per_week: 5,
    estimated_duration_mins: 60,
    template_json: {
      workouts: [
        { day: 1, focus: 'Lower Body Hypertrophy' },
        { day: 2, focus: 'Upper Body Push Hypertrophy' },
        { day: 3, focus: 'Upper Body Pull Hypertrophy' },
        { day: 4, focus: 'Lower Body Hypertrophy + Core' },
        { day: 5, focus: 'Total Body Hypertrophy' },
      ],
    },
  },
  {
    slug: 'nasm-phase-4-max-strength',
    title: 'NASM Phase 4 - Max Strength',
    goal: 'performance',
    nasm_opt_phase: 4,
    phase_name: 'Maximal Strength',
    sessions_per_week: 4,
    estimated_duration_mins: 65,
    template_json: {
      workouts: [
        { day: 1, focus: 'Maximal Strength Lower' },
        { day: 2, focus: 'Maximal Strength Upper Push' },
        { day: 3, focus: 'Maximal Strength Upper Pull' },
        { day: 4, focus: 'Maximal Strength Full Body' },
      ],
    },
  },
  {
    slug: 'nasm-phase-5-power-performance',
    title: 'NASM Phase 5 - Power Performance',
    goal: 'performance',
    nasm_opt_phase: 5,
    phase_name: 'Power',
    sessions_per_week: 4,
    estimated_duration_mins: 60,
    template_json: {
      workouts: [
        { day: 1, focus: 'Power Lower' },
        { day: 2, focus: 'Power Upper' },
        { day: 3, focus: 'Power Total Body' },
        { day: 4, focus: 'Power + Core Stability' },
      ],
    },
  },
]

const rows = templates.map(template => ({
  source,
  slug: template.slug,
  title: template.title,
  goal: template.goal,
  nasm_opt_phase: template.nasm_opt_phase,
  phase_name: template.phase_name,
  sessions_per_week: template.sessions_per_week,
  estimated_duration_mins: template.estimated_duration_mins,
  template_json: template.template_json,
  is_active: true,
}))

const { error: clearError } = await supabase
  .from('workout_program_templates')
  .delete()
  .eq('source', source)

if (clearError) {
  console.error('Failed to clear existing starter templates:', clearError.message)
  process.exit(1)
}

const { error: insertError } = await supabase
  .from('workout_program_templates')
  .insert(rows)

if (insertError) {
  console.error('Failed to insert starter templates:', insertError.message)
  process.exit(1)
}

const { count, error: countError } = await supabase
  .from('workout_program_templates')
  .select('*', { count: 'exact', head: true })
  .eq('source', source)

if (countError) {
  console.error('Templates inserted but failed to fetch count.')
  process.exit(1)
}

console.log(`Starter NASM templates seeded: ${count}`)