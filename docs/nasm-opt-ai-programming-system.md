# NASM OPT Intelligent Exercise Selection & AI Programming System

## Overview

This system implements master-level NASM personal training expertise (20+ years) into your quick plan generation. It replaces random exercise selection with intelligent, scientifically-sound programming that adapts to each client's profile.

## Architecture

### 1. **NASM OPT Exercise Selection Engine** (`lib/nasm-opt-exercise-selection.ts`)

Implements the core intelligent selection logic:

#### Key Features:
- **NASM Phase Prescriptions**: Proper sets/reps/tempo/rest for all 5 phases
- **Complexity Matching**: Ensures exercises match client experience level
- **Equipment Filtering**: Respects available equipment with fuzzy matching
- **Injury Awareness**: Excludes movements that could aggravate injuries
- **Scoring Algorithm**: Prioritizes exercises based on:
  - Phase appropriateness
  - Day focus alignment
  - Movement pattern variety
  - Muscle group benefits

#### NASM OPT Phases Defined:
1. **Phase 1 - Stabilization Endurance**: 12-20 reps, 2-3 sets, tempo 4/2/1, low intensity
   - Focus: Movement quality, stability, muscular endurance
   
2. **Phase 2 - Strength Endurance**: 8-12 reps, 2-4 sets, tempo 2/0/2, moderate intensity
   - Focus: Building stronger stabilizers, increased work capacity
   
3. **Phase 3 - Muscular Development**: 6-12 reps, 3-5 sets, tempo 2/0/2, high intensity
   - Focus: Hypertrophy, muscle growth
   
4. **Phase 4 - Maximal Strength**: 1-5 reps, 4-6 sets, tempo x/x/x, maximum intensity
   - Focus: Maximal strength development
   
5. **Phase 5 - Power**: 1-10 reps, 3-5 sets, tempo x/x/x, maximum intensity
   - Focus: Power development, rate of force development

### 2. **OpenAI Programming Generation** (`lib/openai-program-generation.ts`)

Leverages GPT-4 Turbo with master trainer system prompts:

#### Key Capabilities:
- **Intelligent Programming Guidance**: 
  - Workout strategy and NASM OPT alignment
  - Exercise-specific modifications and regressions
  - Safety considerations for phase and client profile
  - Progression strategy for next 2-4 weeks
  
- **Exercise-Specific Coaching Cues**: 
  - 3-5 actionable cues per exercise
  - Focuses on form, common mistakes, breathing, mind-muscle connection
  - Personalized to phase and experience level

- **Adaptive Recommendations**:
  - Respects equipment limitations
  - Adjusts complexity for experience level
  - Considers age and fitness goals
  - Accounts for injuries and limitations

#### System Expertise:
The OpenAI integration uses a master trainer system prompt that simulates:
- NASM-CPT (Certified Personal Trainer)
- NASM-CES (Corrective Exercise Specialist)
- NASM-PES (Performance Enhancement Specialist)
- NASM-SFS (Senior Fitness Specialist)
- 20+ years professional coaching experience

### 3. **Enhanced Generation Endpoint** (`app/api/coach/workouts/generate/route.ts`)

Orchestrates intelligent exercise selection and AI programming:

#### Flow:
1. Validates coach authorization and client assignment
2. Retrieves client fitness profile and exercise library
3. **Intelligently selects exercises** based on:
   - NASM phase
   - Client fitness level
   - Available equipment
   - Training focus
   - Injury limitations
4. **Generates AI programming** with master trainer expertise
5. **Enhances exercises** with AI-generated coaching cues
6. **Returns personalized draft** ready for coach review

#### Data Used:
- Client profile (age, sex, experience, goals, injuries, equipment)
- Exercise library with NASM data
- Phase prescriptions
- Equipment access
- Training sessions per week

## Usage

### For Coaches (UI)

In the `GenerateClientPlanButton` component:
1. Select NASM OPT Phase (1-5)
2. Select sessions per week
3. Check available equipment
4. Click "Generate" - the system will:
   - Intelligently select appropriate exercises
   - Generate personalized programming with AI
   - Show draft for review before saving

### For Developers

#### Creating a Quick Plan:

```typescript
const response = await fetch('/api/coach/workouts/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'uuid',
    sessionsPerWeek: 4,
    nasmOptPhase: 2,
    equipmentAccess: ['bodyweight', 'dumbbells', 'barbell'],
  }),
})

const { draft } = await response.json()
```

#### Understanding Exercise Selection:

```typescript
import { selectExercisesForWorkoutDay } from '@/lib/nasm-opt-exercise-selection'

const selectedExercises = selectExercisesForWorkoutDay(
  phase: 3,                    // Muscular Development
  dayFocus: 'Upper Body Push',
  exercises: exerciseLibrary,
  client: {
    age: 35,
    experienceLevel: 'intermediate',
    fitnessGoal: 'muscle gain',
    injuries_limitations: 'mild shoulder impingement',
    equipmentAccess: ['dumbbells', 'barbell', 'bench'],
  },
  exerciseCountTarget: 5
)
```

#### Understanding AI Programming:

```typescript
import { generateIntelligentProgramming } from '@/lib/openai-program-generation'

const programming = await generateIntelligentProgramming({
  clientProfile: { /* ... */ },
  phase: 3,
  prescription: phasePrescription,
  plannedExercises: [
    { name: 'Barbell Bench Press', muscleGroups: ['Chest', 'Triceps'] },
    // ...
  ],
  sessionFocus: 'Upper Body Push',
  selectedEquipment: ['barbell', 'dumbbells', 'bench'],
})

// Returns:
// - workoutSummary
// - modificationNotes
// - safetyConsiderations
// - progressionStrategy
// - exerciseSpecificCues (Record<exerciseName, string[]>)
```

## Key Differentiators vs Traditional Training

### Before (Randomized)
- Random exercise selection from available pool
- No phase-specific intelligence
- Missing personalization for client profile
- Generic programming

### After (NASM OPT + AI)
- **Intelligent selection** based on NASM principles
- **Phase-appropriate** exercises matched to adaptation goals
- **Personalized** for age, experience, injuries, equipment
- **AI-enhanced** with master trainer expertise
- **Adaptive** coaching cues and modifications
- **Progressive** with built-in advancement strategies

## Configuration

### Required Environment Variables
```
OPENAI_API_KEY=sk-...  # Your OpenAI API key (already configured in .env.local)
```

### Optional Tuning

The system has intelligent defaults but you can customize in:

1. **Phase Prescriptions** (in `nasm-opt-exercise-selection.ts`):
   - Adjust sets/reps/tempo/rest for different phases
   - Modify exercise selection scoring

2. **OpenAI Parameters** (in `openai-program-generation.ts`):
   - Model: Currently `gpt-4-turbo` (adjust for cost/speed)
   - Temperature: 0.7 (controls randomness/consistency)
   - Max tokens: 2500 (increase for more detailed output)

## Safety & Error Handling

- **Graceful degradation**: If AI generation fails, plan still works without it
- **Validation**: Equipment filtering and injury awareness prevent unsafe recommendations
- **Authorization**: Coach must be assigned to client
- **Rate limiting**: Respects OpenAI API constraints

## Testing

To test the system:

1. Generate a plan via the UI with different phases and equipment
2. Check the generated exercises match phase and equipment constraints
3. Review AI-generated coaching cues in the plan details
4. Test with various client profiles (beginner, intermediate, advanced)
5. Verify injury considerations are respected

## Performance Characteristics

- **Plan Generation Time**: ~3-5 seconds (includes OpenAI API call)
- **Exercise Selection**: <100ms
- **AI Generation**: ~2-4 seconds (depends on OpenAI)
- **Database Queries**: Parallelized for efficiency

## Future Enhancements

Potential improvements:
1. Cache common exercise selections to reduce OpenAI calls
2. Add periodization over full program cycles
3. Implement exercise substitution recommendations
4. Add video analysis for form feedback
5. Build client progression tracking
6. Create rep max estimation from profile
7. Implement ATP-PC loading calculations
8. Add movement pattern assessments

## Support & Troubleshooting

### Plan generation fails with "No active workout templates found"
- Ensure templates exist for selected phase in workout_program_templates table
- Check template `is_active` flag is true
- Verify `nasm_opt_phase` matches selection

### AI coaching cues are missing
- Check OPENAI_API_KEY is set and valid
- Review OpenAI API rate limits/quotas
- System gracefully degrades without AI enhancements

### Exercise selection seems wrong
- Verify exercise library has `nasm_opt_phase` in metadata
- Check equipment matching rules match your database values
- Review client profile has correct experience_level and equipment_access

---

**Created**: This intelligent system transforms your app from basic randomized programming to master-trainer-level NASM OPT programming, creating your competitive differentiation in the coaching market.
