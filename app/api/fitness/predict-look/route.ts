import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { generatePredictionImage, uploadInitImage } from '@/lib/leonardo'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch user profile for context
  const { data: profile, error: profileError } = await supabaseAdmin()
    .from('fitness_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
  }

  const body = await req.json()
  const { targetBodyfatPercent, fitnessGoal, notes } = body ?? {}

  if (!targetBodyfatPercent || !fitnessGoal) {
    return NextResponse.json({ error: 'targetBodyfatPercent and fitnessGoal are required' }, { status: 400 })
  }

  const goalDescriptions = {
    'fat-loss': 'lean defined musculature, visible abdominal tone, natural athletic proportions',
    'muscle-gain': 'noticeable lean muscle gain, stronger shoulders and arms, natural athletic look',
    'performance': 'functional athletic build, balanced musculature, agile and powerful appearance',
    'general-fitness': 'fit healthy physique with good muscle tone and low body fat',
  } as const

  const goalDescription =
    typeof fitnessGoal === 'string' && fitnessGoal in goalDescriptions
      ? goalDescriptions[fitnessGoal as keyof typeof goalDescriptions]
      : 'athletic fit physique'

  const ageContext = profile.age ? `${profile.age} year old` : 'fit'
  const sexContext = profile.sex === 'male' ? 'man' : profile.sex === 'female' ? 'woman' : 'person'
  const bodyContext = profile.weight_kg && profile.height_cm ? `${Math.round(profile.height_cm)}cm tall` : ''

  // When we have a before photo, use img2img — prompt describes ONLY the target physique
  // (no "transformation" or "before/after" language, which causes compositing)
  const prompt = [
    `Professional fitness photography of a ${ageContext} ${sexContext}${bodyContext ? `, ${bodyContext}` : ''}.`,
    `${goalDescription}.`,
    `${targetBodyfatPercent}% body fat.`,
    'Exactly one person in frame, single subject only.',
    'Preserve the same person identity, face structure, skin tone, and body frame from the source photo.',
    'Natural realistic human anatomy, no exaggerated bodybuilding proportions.',
    'Studio-quality photograph with professional lighting.',
    'Wearing dark athletic wear.',
    'Natural human features, realistic skin tone, confident posture.',
    'Sharp focus, clean neutral background.',
    notes ? `Context: ${notes}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  try {
    // Upload before photo to Leonardo as init image if available (enables img2img)
    let initImageId: string | undefined
    const beforePhotoUrl = (profile as { before_photo_url?: string }).before_photo_url
    if (beforePhotoUrl) {
      try {
        initImageId = await uploadInitImage(beforePhotoUrl)
      } catch (uploadErr) {
        // Non-fatal: fall back to txt2img if upload fails
        console.error('Init image upload failed, falling back to txt2img:', uploadErr)
      }
    }

    const imageUrl = await generatePredictionImage(prompt, initImageId)
    return NextResponse.json({ 
      imageUrl, 
      prompt,
      beforePhotoUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate prediction image'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
