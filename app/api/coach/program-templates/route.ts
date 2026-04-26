import { createClient } from '@/lib/supabase-server'
import { type CoachProgramWorkoutInput } from '@/lib/coach-programs'
import { protectCSRF } from '@/lib/csrf'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

interface SaveTemplateRequest {
  title: string
  goal?: string | null
  nasmOptPhase: number
  phaseName: string
  sessionsPerWeek: number
  estimatedDurationMins: number
  workouts: CoachProgramWorkoutInput[]
}

export async function GET(req: NextRequest) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()
  const { data: templates, error: fetchError } = await admin
    .from('coach_program_templates')
    .select('*')
    .eq('coach_id', coachId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }

  return NextResponse.json({ templates: templates || [] })
}

export async function POST(request: NextRequest) {
  try {
    const csrf = await protectCSRF(request)
    if (!csrf.valid) return csrf.error

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SaveTemplateRequest = await request.json()

    // Validate required fields
    if (!body.title || !body.phaseName) {
      return NextResponse.json(
        { error: 'Title and phase name are required' },
        { status: 400 }
      )
    }

    const templatePayload = {
      coach_id: user.id,
      title: body.title,
      goal: body.goal || null,
      nasm_opt_phase: body.nasmOptPhase,
      phase_name: body.phaseName,
      sessions_per_week: body.sessionsPerWeek,
      estimated_duration_mins: body.estimatedDurationMins,
      template_json: {
        workouts: body.workouts,
      },
      is_active: true,
    }

    const { data: newTemplate, error: createError } = await supabase
      .from('coach_program_templates')
      .insert([templatePayload])
      .select()
      .single()

    if (createError || !newTemplate) {
      console.error('Failed to save coach template:', createError)
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
    }

    return NextResponse.json(
      { template: newTemplate, message: 'Template saved successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/coach/program-templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
