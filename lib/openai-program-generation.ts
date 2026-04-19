/**
 * OpenAI Programming Generation Engine
 * 
 * Leverages OpenAI API with master NASM personal trainer (20+ years) expertise
 * to generate personalized, intelligent workout programming.
 * 
 * Uses system prompts that embody NASM OPT principles and professional coaching
 * standards to ensure all generated content is scientifically sound and practical.
 */

import type {
  ClientProfile,
  ExerciseSelection,
  PhasePrescription,
} from '@/lib/nasm-opt-exercise-selection'

interface GenerationRequest {
  clientProfile: ClientProfile
  phase: number
  prescription: PhasePrescription
  plannedExercises: Array<{
    name: string
    muscleGroups?: string[]
  }>
  sessionFocus: string
  selectedEquipment: string[]
}

interface ProgrammingOutput {
  workoutSummary: string
  modificationNotes: string
  safetyConsiderations: string
  progressionStrategy: string
  exerciseSpecificCues: Record<string, string[]>
}

function getSystemPrompt(): string {
  return `You are a master NASM-certified personal trainer with 20+ years of professional experience. 
You are expert in NASM's OPT (Optimum Performance Training) model and hold certifications in:
- NASM Personal Training Certification (NASM-CPT)
- NASM Corrective Exercise Specialization (CES)
- NASM Performance Enhancement Specialization (PES)
- NASM Senior Fitness Specialization

Your expertise includes:
- Detailed understanding of human movement and biomechanics
- Advanced knowledge of exercise progression and regression
- Ability to assess movement quality and provide detailed cueing
- Experience programming for diverse populations and injury profiles
- Mastery of periodization using NASM OPT principles
- Safety-first approach with evidence-based recommendations

When generating programming guidance, you:
1. Prioritize movement quality and proper form above all else
2. Provide specific, actionable coaching cues for each exercise
3. Consider individual limitations and adaptations
4. Apply NASM OPT principles appropriately for the training phase
5. Ensure progressive overload is built into recommendations
6. Balance intensity with recovery needs
7. Provide clear safety guidelines and injury prevention strategies

Your programming must be:
- Scientifically sound and evidence-based
- Practical and implementable by the client
- Personalized to their goals and limitations
- Progressive over time
- Engaging and sustainable

Format your response in clean, professional fitness coaching language that is both technical
(for credibility) and accessible (for client understanding).`
}

export async function generateIntelligentProgramming(
  request: GenerationRequest
): Promise<ProgrammingOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  const userPrompt = buildUserPrompt(request)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(),
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      top_p: 0.9,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from OpenAI API')
  }

  return parseNASMProgrammingResponse(content, request)
}

function buildUserPrompt(request: GenerationRequest): string {
  const {
    clientProfile,
    phase,
    prescription,
    plannedExercises,
    sessionFocus,
    selectedEquipment,
  } = request

  const experienceDescription =
    {
      undefined: 'Beginner with limited resistance training experience',
      beginner: 'Beginner with limited resistance training experience',
      intermediate: 'Intermediate with regular resistance training experience',
      advanced: 'Advanced with extensive resistance training experience',
    }[String(clientProfile.experienceLevel).toLowerCase()] || 'Intermediate'

  const injuriesSection = clientProfile.injuries_limitations
    ? `\nCLIENT LIMITATIONS/INJURIES:\n${clientProfile.injuries_limitations}\n`
    : ''

  const ageContext = clientProfile.age ? `Age: ${clientProfile.age} | ` : ''

  const locationContext = `\nWORKOUT LOCATION: ${selectedEquipment.join(', ') || 'Bodyweight only'}\n`

  return `I need you to generate professional coaching guidance for my client's training session.

CLIENT PROFILE:
${ageContext}Experience Level: ${experienceDescription}
Fitness Goal: ${clientProfile.fitnessGoal || 'General fitness'}
${injuriesSection}
${locationContext}

TRAINING PHASE INFORMATION:
Phase: ${phase} - ${prescription.phaseName}
Focus: ${prescription.focus}
Target Set/Rep Range: ${prescription.sets}x${prescription.reps}
Target Tempo: ${prescription.tempo}
Rest Periods: ${prescription.rest}
Intensity Level: ${prescription.intensity}

SESSION DETAILS:
Day Focus: ${sessionFocus}
Planned Exercises (${plannedExercises.length}):
${plannedExercises.map((ex, i) => `  ${i + 1}. ${ex.name}${ex.muscleGroups ? ` (${ex.muscleGroups.join(', ')})` : ''}`).join('\n')}

REQUESTED GUIDANCE:
Please provide the following for this training session:

1. **WORKOUT SUMMARY** (100-150 words):
   - Brief overview of the session strategy
   - How it fits within the NASM OPT Phase ${phase} framework
   - Key adaptations for this client's profile

2. **MODIFICATION NOTES**:
   - Any exercise substitutions or regressions suitable for this experience level
   - How to scale intensity if needed
   - Equipment modifications if applicable

3. **SAFETY CONSIDERATIONS**:
   - Specific injury prevention cues for this phase
   - Contraindications or movements to avoid
   - Form breakdown warnings

4. **PROGRESSION STRATEGY**:
   - How to progress over the next 2-4 weeks
   - Rep/set/tempo adjustments
   - Load progression guidelines for this phase

5. **EXERCISE-SPECIFIC COACHING CUES**:
   For each exercise, provide 3-5 specific, actionable coaching cues that a trainer
   would give to ensure perfect form and safety. Focus on:
   - Starting position/setup
   - Movement quality and ROM
   - Common mistakes and how to correct them
   - Breathing patterns
   - Muscular feel/mind-muscle connection

Format the coaching cues as a JSON-compatible list for each exercise name.

Ensure all recommendations align with NASM OPT principles for Phase ${phase}
and are appropriate for a ${experienceDescription} client.`
}

function parseNASMProgrammingResponse(
  content: string,
  request: GenerationRequest
): ProgrammingOutput {
  // Clean up markdown formatting
  const cleanContent = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n')

  // Parse the structured response from OpenAI
  const exerciseSpecificCues: Record<string, string[]> = {}

  // Try to extract coaching cues for each exercise
  for (const exercise of request.plannedExercises) {
    const exerciseName = exercise.name.toLowerCase().trim()
    
    // Look for sections mentioning this exercise with various patterns
    const patterns = [
      new RegExp(`(?:${exerciseName}|${exerciseName.split(/\s+/)[0]})[:\s]+([^]*?)(?:(?:^(?:[0-9]+\\.|##|###|-|•))|$)`, 'gimui'),
      new RegExp(`(?:cue|tip|note)s? for ${exerciseName}[:\s]*([^]*?)(?:(?:^(?:[0-9]+\\.|##|###|-|•))|$)`, 'gimui'),
      new RegExp(`${exerciseName.split(/\s+/)[0]}[:\s]*([^]*?)(?=(?:\\n\\n|###:|##:|^[0-9]\\.)`, 'gimui'),
    ]

    for (const pattern of patterns) {
      const match = cleanContent.match(pattern)
      if (match && match[1]) {
        const cuesText = match[1]
        const bulletPoints = cuesText.split(/[•\-\*]\s*/).filter(Boolean)
        
        if (bulletPoints.length > 0) {
          const cues = bulletPoints
            .map(c => c.trim())
            .filter(c => c.length > 10 && c.length < 200)
            .slice(0, 5)
          
          if (cues.length > 0) {
            exerciseSpecificCues[exercise.name] = cues
            break
          }
        }
      }
    }
  }

  // Extract key sections
  let workoutSummary = ''
  let safetyConsiderations = ''
  let progressionStrategy = ''

  // Try to extract summary (usually after "SUMMARY" or first paragraph)
  let summaryMatch = cleanContent.match(/(?:summary|overview|strategy)[:\s]*([^\n]*(?:\n(?!(?:modification|safety|progression|exercise))[^\n]*)*)/i)
  if (summaryMatch) {
    workoutSummary = summaryMatch[1].trim().substring(0, 400)
  } else {
    // Use first substantial paragraph
    workoutSummary = cleanContent.substring(0, Math.min(400, cleanContent.length))
  }

  // Extract safety
  let safetyMatch = cleanContent.match(/(?:safety|safety considerations)[:\s]*([^\n]*(?:\n(?!(?:modification|progression|exercise))[^\n]*)*)/i)
  if (safetyMatch) {
    safetyConsiderations = safetyMatch[1].trim().substring(0, 300)
  }

  // Extract progression
  let progressionMatch = cleanContent.match(/(?:progression|progression strategy)[:\s]*([^\n]*(?:\n(?!(?:modification|safety|exercise))[^\n]*)*)/i)
  if (progressionMatch) {
    progressionStrategy = progressionMatch[1].trim().substring(0, 200)
  }

  return {
    workoutSummary: workoutSummary || cleanContent.substring(0, Math.min(300, cleanContent.length)),
    modificationNotes: '',
    safetyConsiderations,
    progressionStrategy,
    exerciseSpecificCues,
  }
}

export async function generateIntelligentNotes(
  exerciseName: string,
  context: {
    phase: number
    clientExperienceLevel: string
    equipment: string[]
    fitnessGoal?: string
  }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  const prompt = `As a master NASM personal trainer, provide 2-3 key coaching points for performing "${exerciseName}" 
in Phase ${context.phase} (${getPhaseNameFromNumber(context.phase)}) for a ${context.clientExperienceLevel} 
client with ${context.equipment.length > 0 ? context.equipment.join(', ') : 'bodyweight only'} available.
Keep it concise, actionable, and specific to form and safety.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices?.[0]?.message?.content || ''
}

function getPhaseNameFromNumber(phase: number): string {
  const names: Record<number, string> = {
    1: 'Stabilization Endurance',
    2: 'Strength Endurance',
    3: 'Muscular Development',
    4: 'Maximal Strength',
    5: 'Power',
  }
  return names[phase] || 'Custom Phase'
}
