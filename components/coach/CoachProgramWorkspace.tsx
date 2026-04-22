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
  contraindicationNotes?: string[]
  readinessSummary?: {
    completionRate14d: number
    avgRpe14d: number | null
    completedSessions7d: number
    daysSinceLastCompleted: number | null
    readiness: 'high' | 'moderate' | 'low'
    recommendation: string
  }
  initialEquipmentAccess?: string[]
  libraryEquipmentNames?: string[]
  cardioEquipmentAccess?: string[]
  initialSessionsPerWeek?: number | null
  preferredTrainingDays?: string[]
}

export default function CoachProgramWorkspace({
  clientId,
  latestPlan,
  templates,
  coachTemplates,
  exercises,
  equipment,
  contraindicationNotes = [],
  readinessSummary,
  initialEquipmentAccess = [],
  libraryEquipmentNames = [],
  cardioEquipmentAccess = [],
  initialSessionsPerWeek = null,
  preferredTrainingDays = [],
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

          {cardioEquipmentAccess.length > 0 && (
            <div style={{ padding: '10px 12px', border: '1px solid rgba(74,144,226,0.28)', background: 'rgba(74,144,226,0.08)' }}>
              <p style={{ margin: '0 0 6px', color: 'rgba(144,190,255,0.9)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                Client Cardio Equipment
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cardioEquipmentAccess.map(item => (
                  <span key={item} style={{ border: '1px solid rgba(74,144,226,0.35)', background: 'rgba(74,144,226,0.12)', color: 'rgba(144,190,255,0.9)', padding: '2px 8px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {item.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {cardioEquipmentAccess.length === 0 && (
            <p style={{ margin: 0, color: 'var(--gray)', fontSize: 13 }}>
              Client has not indicated cardio equipment access.
            </p>
          )}

          <GenerateClientPlanButton
            clientId={clientId}
            initialEquipmentAccess={initialEquipmentAccess}
            libraryEquipmentNames={libraryEquipmentNames}
            initialSessionsPerWeek={initialSessionsPerWeek}
            preferredTrainingDays={preferredTrainingDays}
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
        contraindicationNotes={contraindicationNotes}
        readinessSummary={readinessSummary}
        initialEquipmentAccess={initialEquipmentAccess}
        draftPlan={draftPlan}
        onPlanSaved={() => setDraftPlan(null)}
      />
    </div>
  )
}