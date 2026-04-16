# NASM Content Import Notes

This app now supports three catalog tables for coach-built programs:

- `workout_program_templates`
- `exercise_library_entries`
- `equipment_library_entries`

The coach builder reads from those tables and stores exercise snapshots inside `workout_plans.plan_json` when a program is saved.

Use this workflow for licensed content only:

1. Import official program templates into `workout_program_templates.template_json` with a `workouts` array.
2. Import exercise records into `exercise_library_entries` with `name`, `description`, `coaching_cues`, `primary_equipment`, and optional `media_image_url` / `media_video_url`.
3. Import equipment records into `equipment_library_entries` with `name`, optional `description`, and optional `media_image_url`.

Suggested template JSON shape:

```json
{
  "workouts": [
    {
      "day": 1,
      "focus": "Upper Body Strength",
      "scheduledDate": "2026-04-20",
      "notes": "Keep first set at RPE 7.",
      "exercises": [
        {
          "libraryExerciseId": "uuid-from-exercise-library-entries",
          "name": "Cable Row",
          "sets": "3",
          "reps": "10",
          "tempo": "2/0/2",
          "rest": "60s",
          "notes": "Pause at peak contraction"
        }
      ]
    }
  ]
}
```

The builder still accepts manual exercise names when the library is empty, but descriptions and media only flow through when the exercise exists in `exercise_library_entries`.