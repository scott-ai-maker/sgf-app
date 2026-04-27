import SwiftUI

struct WorkoutPlanView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var plans: [WorkoutPlan] = []
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading workout plans...")
                } else if let error {
                    ContentUnavailableView("Could not load plans", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if plans.isEmpty {
                    ContentUnavailableView(
                        "No Workout Plans Yet",
                        systemImage: "dumbbell",
                        description: Text("Your coach will assign a plan once your onboarding is complete.")
                    )
                } else {
                    List {
                        ForEach(plans) { plan in
                            NavigationLink {
                                WorkoutPlanDetailView(plan: plan)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(plan.name).bold()
                                    Text("\(plan.phaseName) · Phase \(plan.nasmOptPhase)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text("\(plan.sessionsPerWeek) days/week · ~\(plan.estimatedDurationMins) min")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Workout Plans")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }
        loading = true
        error = nil
        do {
            plans = try await APIClient(token: token).fetchWorkoutPlans()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Detail

struct WorkoutPlanDetailView: View {
    let plan: WorkoutPlan

    var body: some View {
        List {
            Section("Overview") {
                LabeledContent("Phase", value: "\(plan.phaseName) (Phase \(plan.nasmOptPhase))")
                LabeledContent("Sessions / Week", value: "\(plan.sessionsPerWeek)")
                LabeledContent("Duration", value: "~\(plan.estimatedDurationMins) min")
                if let goal = plan.goal, !goal.isEmpty {
                    LabeledContent("Goal", value: goal)
                }
            }

            ForEach(plan.planJson.workouts) { day in
                Section(day.name ?? day.dayTag?.capitalized ?? "Day") {
                    ForEach(day.exercises) { exercise in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(exercise.name ?? "Exercise").bold()

                            let detail = [
                                exercise.sets.map { "\($0) sets" },
                                exercise.reps.map { "\($0) reps" },
                                exercise.restSeconds.map { "\($0)s rest" },
                            ]
                            .compactMap { $0 }
                            .joined(separator: " · ")

                            if !detail.isEmpty {
                                Text(detail)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if let notes = exercise.notes, !notes.isEmpty {
                                Text(notes)
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle(plan.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
