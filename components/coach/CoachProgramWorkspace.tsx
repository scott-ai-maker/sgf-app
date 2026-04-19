'use client'

import { useState } from 'react'
import GenerateClientPlanButton from '@/components/coach/GenerateClientPlanButton'
import CoachProgramBuilder from '@/components/coach/CoachProgramBuilder'
import type {
  CoachProgramDraft,
  CoachProgramTemplateRecord,
  EquipmentLibraryRecord,
  ExerciseLibraryRecord,
  WorkoutProgramTemplateRecord,
} from '@/lib/coach-programs'

interface LatestWorkoutPlan {
  id?: string | null
  name?: string | null
  goal?: string | null
  nasm_opt_phase?: number | null
  phase_name?: string | null
  sessions_per_week?: number | null
  estimated_duration_mins?: number | null
  plan_json?: {
    workouts?: Array<{
      day: number
      focus: string
      scheduledDate?: string | null
      notes?: string | null
      exercises: Array<{
        libraryExerciseId?: string | null
        name: string
        sets: string
        reps: string
        tempo?: string | null
        rest?: string | null
        notes?: string | null
        description?: string | null
        primaryEquipment?: string[] | null
        imageUrl?: string | null
        videoUrl?: string | null
      }>
    }>
  } | null
}

interface CoachProgramWorkspaceProps {
  clientId: string
  latestPlan: LatestWorkoutPlan | null
  templates: WorkoutProgramTemplateRecord[]
  coachTemplates: CoachProgramTemplateRecord[]
  exercises: ExerciseLibraryRecord[]
  equipment: EquipmentLibraryRecord[]
  initialEquipmentAccess?: string[]
  libraryEquipmentNames?: string[]
}

export default function CoachProgramWorkspace({
  clientId,
  latestPlan,
  templates,
  coachTemplates,
  exercises,
  equipment,
  initialEquipmentAccess = [],
  libraryEquipmentNames = [],
}: CoachProgramWorkspaceProps) {
  const [draftPlan, setDraftPlan] = useState<CoachProgramDraft | null>(null)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Quick Generate Workflow
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 14, lineHeight: 1.5 }}>
              Generate a draft from the NASM library, review it in the builder, then save only after you are satisfied.
            </p>
          </div>

          <GenerateClientPlanButton
            clientId={clientId}
            initialEquipmentAccess={initialEquipmentAccess}
            libraryEquipmentNames={libraryEquipmentNames}
            onDraftGenerated={setDraftPlan}
          />
        </div>
      </div>

      <CoachProgramBuilder
        clientId={clientId}
        latestPlan={latestPlan}
        templates={templates}
        coachTemplates={coachTemplates}
        exercises={exercises}
        equipment={equipment}
        draftPlan={draftPlan}
        onPlanSaved={() => setDraftPlan(null)}
      />
    </div>
  )
}