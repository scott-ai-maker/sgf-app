import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { estimateBodyFatPercent } from '@/lib/fitness'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.sex || !body.heightCm || !body.weightKg) {
    return NextResponse.json({ error: 'sex, heightCm, and weightKg are required' }, { status: 400 })
  }

  const estimatedBodyfatPercent = estimateBodyFatPercent({
    sex: body.sex,
    heightCm: Number(body.heightCm),
    weightKg: Number(body.weightKg),
    waistCm: body.waistCm ? Number(body.waistCm) : undefined,
    neckCm: body.neckCm ? Number(body.neckCm) : undefined,
    hipCm: body.hipCm ? Number(body.hipCm) : undefined,
  })

  const method = body.waistCm && body.neckCm ? 'US Navy circumference + photo-assisted intake' : 'BMI fallback + photo-assisted intake'

  const { data, error } = await supabaseAdmin()
    .from('body_composition_analyses')
    .insert({
      user_id: user.id,
      photo_data_url: body.photoDataUrl ?? null,
      estimated_bodyfat_percent: estimatedBodyfatPercent,
      method,
      confidence_score: body.photoDataUrl ? 0.68 : 0.55,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ analysis: data })
}
