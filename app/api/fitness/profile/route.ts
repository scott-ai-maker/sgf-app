import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import {
  createSignedFitnessPhotoUrl,
  extractPhotoPathFromLegacyUrl,
  normalizePhotoPath,
} from '@/lib/fitness-photos'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'
const EXCLUDED_EQUIPMENT_TERMS = ['chains', 'chain', 'safety collar', 'safety collars']
const TRAINING_DAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function isExcludedEquipmentName(name: string) {
  const normalized = String(name ?? '').trim().toLowerCase()
  return EXCLUDED_EQUIPMENT_TERMS.some(term => normalized.includes(term))
}

function normalizePreferredTrainingDays(value: unknown) {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()

  return value
    .map(item => String(item ?? '').trim().toLowerCase())
    .filter((item): item is (typeof TRAINING_DAY_OPTIONS)[number] => {
      if (!TRAINING_DAY_OPTIONS.includes(item as (typeof TRAINING_DAY_OPTIONS)[number])) return false
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fitness_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: equipmentData } = await supabase
    .from('equipment_library_entries')
    .select('name')
    .eq('is_active', true)
    .eq('source', EXERCISE_LIBRARY_SOURCE)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const availableEquipment = [...new Set((equipmentData ?? [])
    .map(item => String(item.name ?? '').trim())
    .filter(Boolean)
    .filter(item => !isExcludedEquipmentName(item)))]

  if (!data) {
    return NextResponse.json({ profile: null, availableEquipment })
  }

  const beforePhotoPath = normalizePhotoPath(
    data.before_photo_path ?? extractPhotoPathFromLegacyUrl(data.before_photo_url)
  )
  const signedBeforePhotoUrl = await createSignedFitnessPhotoUrl(supabase, beforePhotoPath)

  const profile = {
    ...data,
    before_photo_path: beforePhotoPath || null,
    before_photo_url: signedBeforePhotoUrl ?? null,
  }

  return NextResponse.json({ profile, availableEquipment })
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['client'])
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const rawMessage = error instanceof Error ? error.message : 'Unauthorized'
    const message = status === 403
      ? 'Onboarding intake is available for client accounts only.'
      : rawMessage
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()
  const intake = typeof body.intake === 'object' && body.intake ? body.intake : {}
  const parq = typeof intake.parqAnswers === 'object' && intake.parqAnswers ? intake.parqAnswers as Record<string, unknown> : {}
  const parqKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] as const

  const allParqAnswered = parqKeys.every(key => typeof parq[key] === 'boolean')
  if (!allParqAnswered) {
    return NextResponse.json({ error: 'Please answer all PAR-Q questions.' }, { status: 400 })
  }

  const consents = {
    liabilityWaiver: Boolean(intake.liabilityWaiver),
    informedConsent: Boolean(intake.informedConsent),
    privacyPractices: Boolean(intake.privacyPractices),
    coachingAgreement: Boolean(intake.coachingAgreement),
    emergencyCare: Boolean(intake.emergencyCare),
  }

  if (!Object.values(consents).every(Boolean)) {
    return NextResponse.json({ error: 'All legal consents are required.' }, { status: 400 })
  }

  const signatureName = String(intake.signatureName ?? '').trim()
  const emergencyContactName = String(intake.emergencyContactName ?? '').trim()
  const emergencyContactPhone = String(intake.emergencyContactPhone ?? '').trim()

  if (!signatureName) {
    return NextResponse.json({ error: 'Full legal name is required for electronic signature.' }, { status: 400 })
  }

  if (!emergencyContactName || !emergencyContactPhone) {
    return NextResponse.json({ error: 'Emergency contact name and phone are required.' }, { status: 400 })
  }

  const parqAnswers = {
    q1: Boolean(parq.q1),
    q2: Boolean(parq.q2),
    q3: Boolean(parq.q3),
    q4: Boolean(parq.q4),
    q5: Boolean(parq.q5),
    q6: Boolean(parq.q6),
    q7: Boolean(parq.q7),
  }

  const parqAnyYes = Object.values(parqAnswers).some(Boolean)
  const rawEquipment = Array.isArray(body.equipmentAccess) ? body.equipmentAccess : []
  const equipmentAccess = rawEquipment
    .map((item: unknown) => String(item).trim())
    .filter(Boolean)

  const rawCardioEquipment = Array.isArray(body.cardioEquipmentAccess) ? body.cardioEquipmentAccess : []
  const cardioEquipmentAccess = rawCardioEquipment
    .map((item: unknown) => String(item).trim())
    .filter(Boolean)
  const trainingDaysPerWeek = body.trainingDaysPerWeek ? Number(body.trainingDaysPerWeek) : null
  const preferredTrainingDays = normalizePreferredTrainingDays(body.preferredTrainingDays)

  if (!trainingDaysPerWeek || trainingDaysPerWeek < 2 || trainingDaysPerWeek > 7) {
    return NextResponse.json({ error: 'Training days per week must be between 2 and 7.' }, { status: 400 })
  }

  if (preferredTrainingDays.length !== trainingDaysPerWeek) {
    return NextResponse.json({ error: 'Select the same number of preferred training days as sessions per week.' }, { status: 400 })
  }

  const payload = {
    user_id: userId,
    preferred_units: body.preferredUnits === 'imperial' ? 'imperial' : 'metric',
    age: body.age ? Number(body.age) : null,
    sex: body.sex ?? null,
    height_cm: body.heightCm ? Number(body.heightCm) : null,
    weight_kg: body.weightKg ? Number(body.weightKg) : null,
    waist_cm: body.waistCm ? Number(body.waistCm) : null,
    neck_cm: body.neckCm ? Number(body.neckCm) : null,
    hip_cm: body.hipCm ? Number(body.hipCm) : null,
    activity_level: body.activityLevel ?? null,
    training_days_per_week: trainingDaysPerWeek,
    preferred_training_days: preferredTrainingDays,
    fitness_goal: body.fitnessGoal ?? null,
    target_weight_kg: body.targetWeightKg ? Number(body.targetWeightKg) : null,
    target_bodyfat_percent: body.targetBodyfatPercent ? Number(body.targetBodyfatPercent) : null,
    injuries_limitations: body.injuriesLimitations ?? null,
    experience_level: body.experienceLevel ?? null,
    workout_location: body.workoutLocation ?? null,
    equipment_access: equipmentAccess.length ? equipmentAccess : ['bodyweight'],
    cardio_equipment_access: cardioEquipmentAccess,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const intakePayload = {
    user_id: userId,
    parq_answers: parqAnswers,
    parq_any_yes: parqAnyYes,
    medical_conditions: String(intake.medicalConditions ?? '').trim() || null,
    medications: String(intake.medications ?? '').trim() || null,
    surgeries_or_injuries: String(intake.surgeriesOrInjuries ?? '').trim() || null,
    allergies: String(intake.allergies ?? '').trim() || null,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    primary_physician_name: String(intake.primaryPhysicianName ?? '').trim() || null,
    primary_physician_phone: String(intake.primaryPhysicianPhone ?? '').trim() || null,
    consent_liability_waiver: consents.liabilityWaiver,
    consent_informed_consent: consents.informedConsent,
    consent_privacy_practices: consents.privacyPractices,
    consent_coaching_agreement: consents.coachingAgreement,
    consent_emergency_care: consents.emergencyCare,
    consent_signature_name: signatureName,
    consent_signed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error: intakeError } = await supabaseAdmin()
    .from('client_intake_forms')
    .upsert(intakePayload, { onConflict: 'user_id' })

  if (intakeError) return NextResponse.json({ error: intakeError.message }, { status: 500 })

  const { data, error } = await supabaseAdmin()
    .from('fitness_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}

export async function PATCH(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['client'])
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json().catch(() => ({}))
  const preferredUnits = body?.preferredUnits === 'metric' ? 'metric' : body?.preferredUnits === 'imperial' ? 'imperial' : null

  if (!preferredUnits) {
    return NextResponse.json({ error: 'preferredUnits must be "metric" or "imperial"' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('fitness_profiles')
    .update({ preferred_units: preferredUnits, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
