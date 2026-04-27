import SwiftUI

// MARK: - Set Row State (local view state, not persisted)

struct SetRowState {
    var weightText: String = ""
    var repsText: String = ""
    var isLogged: Bool = false
}

// MARK: - Workout Session View

struct WorkoutSessionView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    let workout: ProgramWorkout
    let plan: WorkoutPlan
    let onComplete: () -> Void

    @State private var setStates: [String: [SetRowState]] = [:]
    @State private var restCountdown: Int? = nil
    @State private var restTimerTask: Task<Void, Never>? = nil
    @State private var showFinishSheet = false
    @State private var sessionError: String? = nil
    @State private var isSavingSession = false

    private let sessionDate: String = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }()

    private let sessionStart = Date()

    var sessionTitle: String { "Day \(workout.day): \(workout.focus)" }

    private var totalLogged: Int {
        setStates.values.reduce(0) { $0 + $1.filter { $0.isLogged }.count }
    }

    private var anyLogged: Bool { totalLogged > 0 }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                List {
                    sessionHeader
                    exerciseList
                    if let err = sessionError {
                        Section {
                            Label(err, systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                                .font(.caption)
                        }
                    }
                    // Spacer so sticky footer doesn't overlap last row
                    Section {
                        Color.clear.frame(height: 80)
                    }
                    .listRowBackground(Color.clear)
                }
                .listStyle(.insetGrouped)

                bottomBar
            }
            .navigationTitle(workout.focus)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { onComplete() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if totalLogged > 0 {
                        Text("\(totalLogged) logged")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .onAppear { initSetStates() }
            .sheet(isPresented: $showFinishSheet) {
                FinishSessionSheet(
                    sessionTitle: sessionTitle,
                    durationMins: max(1, Int(Date().timeIntervalSince(sessionStart) / 60)),
                    isSaving: $isSavingSession,
                    onSave: { rpe, notes in
                        Task { await saveSession(rpe: rpe, notes: notes) }
                    }
                )
            }
        }
    }

    // MARK: - Sub-sections

    @ViewBuilder
    private var sessionHeader: some View {
        Section {
            HStack(spacing: 10) {
                Image(systemName: "calendar")
                    .foregroundStyle(.secondary)
                Text(formattedDate)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(plan.name)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            .font(.subheadline)
        }
    }

    @ViewBuilder
    private var exerciseList: some View {
        ForEach(workout.exercises) { exercise in
            ExerciseCard(
                exercise: exercise,
                setStates: Binding(
                    get: { setStates[exercise.name] ?? [] },
                    set: { setStates[exercise.name] = $0 }
                ),
                planId: plan.id,
                sessionDate: sessionDate,
                token: sessionStore.accessToken ?? "",
                preferredUnits: sessionStore.preferredUnits,
                onSetLogged: { restSecs in
                    startRestTimer(restSecs)
                }
            )
        }
    }

    @ViewBuilder
    private var bottomBar: some View {
        VStack(spacing: 0) {
            if let countdown = restCountdown {
                RestTimerBanner(countdown: countdown) {
                    restTimerTask?.cancel()
                    restCountdown = nil
                }
            }
            HStack(spacing: 14) {
                if totalLogged > 0 {
                    Text("\(totalLogged) set\(totalLogged == 1 ? "" : "s") logged")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Complete Workout") {
                    showFinishSheet = true
                }
                .buttonStyle(.borderedProminent)
                .disabled(!anyLogged || isSavingSession)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Helpers

    private var formattedDate: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: sessionDate) else { return sessionDate }
        let out = DateFormatter()
        out.dateStyle = .full
        out.timeStyle = .none
        return out.string(from: d)
    }

    private func initSetStates() {
        for ex in workout.exercises {
            // Use the upper end of a range like "2-3" so clients can do up to the max sets
            let raw = ex.sets.components(separatedBy: "-").last?.trimmingCharacters(in: .whitespaces) ?? ex.sets
            let count = max(1, Int(raw) ?? 3)
            setStates[ex.name] = Array(repeating: SetRowState(), count: count)
        }
    }

    private func startRestTimer(_ seconds: Int?) {
        guard let seconds, seconds > 0 else { return }
        restTimerTask?.cancel()
        restCountdown = seconds
        restTimerTask = Task {
            for remaining in stride(from: seconds, through: 0, by: -1) {
                guard !Task.isCancelled else { return }
                restCountdown = remaining
                if remaining > 0 {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                }
            }
            if !Task.isCancelled { restCountdown = nil }
        }
    }

    private func saveSession(rpe: Int, notes: String) async {
        guard let token = sessionStore.accessToken else { return }
        isSavingSession = true
        do {
            try await APIClient(token: token).logWorkoutSession(WorkoutLogRequest(
                workoutPlanId: plan.id,
                sessionDate: sessionDate,
                sessionTitle: sessionTitle,
                completed: true,
                exertionRpe: rpe,
                notes: notes.isEmpty ? nil : notes
            ))
            onComplete()
        } catch {
            sessionError = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
        isSavingSession = false
    }
}

// MARK: - Exercise Card

private struct ExerciseCard: View {
    let exercise: ProgramExercise
    @Binding var setStates: [SetRowState]
    let planId: String
    let sessionDate: String
    let token: String
    let preferredUnits: String
    let onSetLogged: (Int?) -> Void

    @State private var isExpanded = true

    private var allDone: Bool {
        !setStates.isEmpty && setStates.allSatisfy { $0.isLogged }
    }

    private var restSeconds: Int? {
        guard let rest = exercise.rest else { return nil }
        let lower = rest.lowercased()
        let digits = lower.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        guard let n = Int(digits), n > 0 else { return nil }
        return lower.contains("min") ? n * 60 : n
    }

    var body: some View {
        Section {
            // Header row — tap to expand/collapse
            Button {
                withAnimation(.spring(response: 0.3)) { isExpanded.toggle() }
            } label: {
                exerciseHeader
            }
            .buttonStyle(.plain)

            if isExpanded {
                exerciseDetails
            }
        }
    }

    @ViewBuilder
    private var exerciseHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(allDone ? Color.green.opacity(0.12) : Color.accentColor.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: allDone ? "checkmark.circle.fill" : "dumbbell.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(allDone ? .green : Color.accentColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                HStack(spacing: 8) {
                    Text("\(exercise.sets) × \(exercise.reps)")
                    if let rest = exercise.rest {
                        Text("·")
                            .foregroundStyle(.secondary)
                        Text(rest + " rest")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    private var exerciseDetails: some View {
        if let notes = exercise.notes, !notes.isEmpty {
            Label(notes, systemImage: "info.circle.fill")
                .font(.caption)
                .foregroundStyle(.orange)
        }
        ExerciseVideoThumbnail(
            exerciseName: exercise.name,
            workoutPlanId: planId,
            videoURL: exercise.videoUrl,
            openExternallyOnly: exercise.openExternallyOnly
        )
        if !exercise.coachingCues.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Cues")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.tertiary)
                ForEach(exercise.coachingCues.prefix(3), id: \.self) { cue in
                    Label(cue, systemImage: "arrow.right.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        ForEach(setStates.indices, id: \.self) { idx in
            SetLogRow(
                setNumber: idx + 1,
                state: Binding(
                    get: { setStates[idx] },
                    set: { setStates[idx] = $0 }
                ),
                exerciseName: exercise.name,
                planId: planId,
                sessionDate: sessionDate,
                token: token,
                preferredUnits: preferredUnits,
                onLogged: { onSetLogged(restSeconds) }
            )
        }
    }
}

// MARK: - Set Log Row

private struct SetLogRow: View {
    let setNumber: Int
    @Binding var state: SetRowState
    let exerciseName: String
    let planId: String
    let sessionDate: String
    let token: String
    let preferredUnits: String
    let onLogged: () -> Void

    @State private var isLogging = false

    private var canLog: Bool {
        !state.isLogged && !isLogging &&
        !state.weightText.trimmingCharacters(in: .whitespaces).isEmpty &&
        !state.repsText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        HStack(spacing: 10) {
            Text("Set \(setNumber)")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .frame(width: 48, alignment: .leading)

            TextField(preferredUnits == "imperial" ? "lbs" : "kg", text: $state.weightText)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
                .frame(width: 72)
                .disabled(state.isLogged)
                .opacity(state.isLogged ? 0.55 : 1)

            Text("×")
                .foregroundStyle(.secondary)

            TextField("reps", text: $state.repsText)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .frame(width: 60)
                .disabled(state.isLogged)
                .opacity(state.isLogged ? 0.55 : 1)

            Spacer()

            if state.isLogged {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.green)
            } else {
                Button {
                    Task { await logSet() }
                } label: {
                    if isLogging {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "checkmark.circle")
                            .font(.title3)
                            .foregroundStyle(canLog ? Color.accentColor : Color.secondary.opacity(0.4))
                    }
                }
                .disabled(!canLog)
            }
        }
        .padding(.vertical, 2)
    }

    private func logSet() async {
        guard !isLogging else { return }
        let repsStr = state.repsText.trimmingCharacters(in: .whitespaces)
        let weightStr = state.weightText.trimmingCharacters(in: .whitespaces)
        guard let repsInt = Int(repsStr), repsInt > 0 else { return }
        // Convert to kg for storage; backend always stores metric
        let weightKg = Double(weightStr).map { preferredUnits == "imperial" ? $0 * 0.453592 : $0 }

        isLogging = true
        defer { isLogging = false }

        do {
            _ = try await APIClient(token: token).logWorkoutSet(SetLogRequest(
                workoutPlanId: planId,
                sessionDate: sessionDate,
                exerciseName: exerciseName,
                setNumber: setNumber,
                reps: repsInt,
                weightKg: weightKg
            ))
            state.isLogged = true
            onLogged()
        } catch {
            // Log silently — don't block the workout flow for a network blip
        }
    }
}

// MARK: - Rest Timer Banner

private struct RestTimerBanner: View {
    let countdown: Int
    let onSkip: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.accentColor.opacity(0.12))
                    .frame(width: 42, height: 42)
                Text("\(countdown)")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .monospacedDigit()
                    .foregroundStyle(Color.accentColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Rest Timer")
                    .font(.caption)
                    .fontWeight(.semibold)
                Text("Next set in \(countdown)s — breathe and reset")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Skip") { onSkip() }
                .font(.caption)
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.accentColor.opacity(0.35))
                .frame(height: 2)
        }
    }
}

// MARK: - Finish Session Sheet

struct FinishSessionSheet: View {
    let sessionTitle: String
    let durationMins: Int
    @Binding var isSaving: Bool
    let onSave: (Int, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rpe = 7
    @State private var notes = ""

    private var rpeColor: Color {
        rpe <= 5 ? .green : rpe <= 7 ? .orange : .red
    }

    private var rpeLabel: String {
        switch rpe {
        case 1...4: return "Light — felt easy"
        case 5...6: return "Moderate — working hard"
        case 7...8: return "Hard — pushed myself"
        case 9: return "Very Hard — near max"
        default: return "Max Effort — all out"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Session", value: sessionTitle)
                    LabeledContent("Duration", value: "\(durationMins) min")
                }

                Section("Rate Your Effort") {
                    VStack(spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("RPE \(rpe) / 10")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundStyle(rpeColor)
                                Text(rpeLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        Slider(
                            value: Binding(
                                get: { Double(rpe) },
                                set: { rpe = Int($0.rounded()) }
                            ),
                            in: 1...10,
                            step: 1
                        )
                        .tint(rpeColor)
                        HStack {
                            Text("Easy").font(.caption2).foregroundStyle(.secondary)
                            Spacer()
                            Text("Max Effort").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Notes (optional)") {
                    TextField("How did it go? Anything to note for next time?", text: $notes, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }
            }
            .navigationTitle("Complete Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(rpe, notes)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(isSaving)
                }
            }
        }
    }
}
