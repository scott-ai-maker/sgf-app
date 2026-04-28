import SwiftUI
import SwiftUI

// MARK: - Program Tab (Main)

struct ProgramView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var plans: [WorkoutPlan] = []
    @State private var logs: [WorkoutLog] = []
    @State private var loading = false
    @State private var loadError: String?
    @State private var selectedWorkout: ProgramWorkout?
    @State private var showHistory = false

    private var activePlan: WorkoutPlan? { plans.first }

    private var todayISO: String { Self.isoDate(from: Date()) }

    static func isoDate(from date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: date)
    }

    private var todayWorkout: ProgramWorkout? {
        activePlan?.planJson.workouts.first { $0.scheduledDate == todayISO }
    }

    // Next unlogged workout when no scheduled dates
    private var nextWorkout: ProgramWorkout? {
        guard todayWorkout == nil, let plan = activePlan else { return nil }
        let completedTitles = Set(logs.filter { $0.completed }.map { $0.sessionTitle })
        return plan.planJson.workouts.first { w in
            !completedTitles.contains("Day \(w.day): \(w.focus)")
        }
    }

    private var prominentWorkout: ProgramWorkout? { todayWorkout ?? nextWorkout }
    private var recentLogs: [WorkoutLog] { Array(logs.prefix(4)) }

    var body: some View {
        NavigationStack {
            Group {
                if loading && plans.isEmpty {
                    ProgressView("Loading program…")
                } else if let err = loadError, plans.isEmpty {
                    ContentUnavailableView(
                        "Could not load program",
                        systemImage: "exclamationmark.triangle",
                        description: Text(err)
                    )
                } else if let plan = activePlan {
                    programContent(plan: plan)
                } else {
                    ContentUnavailableView(
                        "No Program Assigned",
                        systemImage: "dumbbell",
                        description: Text("Your coach will assign a workout program once your onboarding is complete.")
                    )
                }
            }
            .navigationTitle("Program")
            .task { await load() }
            .refreshable { await load() }
            .fullScreenCover(item: $selectedWorkout) { workout in
                if let plan = activePlan {
                    WorkoutSessionView(workout: workout, plan: plan) {
                        selectedWorkout = nil
                        Task { await load() }
                    }
                }
            }
            .sheet(isPresented: $showHistory) {
                WorkoutHistoryView(logs: logs)
            }
        }
    }

    @ViewBuilder
    private func programContent(plan: WorkoutPlan) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                PlanHeaderCard(
                    plan: plan,
                    completedCount: logs.filter { $0.completed }.count
                )

                let hasScheduled = plan.planJson.workouts.contains { $0.scheduledDate != nil }
                if hasScheduled {
                    WeekStripView(plan: plan, logs: logs, todayISO: todayISO)
                }

                if let workout = prominentWorkout {
                    TodayWorkoutCard(
                        workout: workout,
                        plan: plan,
                        isToday: todayWorkout != nil,
                        onStart: { selectedWorkout = workout }
                    )
                } else if plan.planJson.workouts.isEmpty == false {
                    AllDoneCard()
                }

                if !recentLogs.isEmpty {
                    recentSection
                }

                fullProgramSection(plan: plan)
            }
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0))
    }

    @ViewBuilder
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Sessions")
                    .font(.headline)
                    .foregroundStyle(Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0))
                    .padding(.leading, 20)
                Spacer()
                Button("View All") { showHistory = true }
                    .font(.subheadline)
                    .padding(.trailing, 20)
            }
            ForEach(recentLogs) { log in
                RecentSessionRow(log: log)
            }
        }
    }

    @ViewBuilder
    private func fullProgramSection(plan: WorkoutPlan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Full Program")
                .font(.headline)
                .foregroundStyle(Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0))
                .padding(.leading, 20)
            ForEach(plan.planJson.workouts) { workout in
                NavigationLink {
                    WorkoutDayDetailView(workout: workout, plan: plan)
                } label: {
                    WorkoutDayRow(
                        workout: workout,
                        logs: logs,
                        todayISO: todayISO
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
            }
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }
        loading = true
        loadError = nil
        async let plansTask = APIClient(token: token).fetchWorkoutPlans()
        async let logsTask = APIClient(token: token).fetchWorkoutLogs()
        do {
            plans = try await plansTask
            logs = try await logsTask
        } catch {
            loadError = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Plan Header Card

private struct PlanHeaderCard: View {
    let plan: WorkoutPlan
    let completedCount: Int

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plan.name)
                        .font(.title2)
                        .fontWeight(.bold)
                        .lineLimit(2)
                    Text("Phase \(plan.nasmOptPhase): \(plan.phaseName)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let goal = plan.goal, !goal.isEmpty {
                        Text(goal.capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text("P\(plan.nasmOptPhase)/5")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.accentColor, in: Capsule())
            }

            Divider()

            HStack(spacing: 0) {
                StatPill(value: "\(plan.sessionsPerWeek)", label: "days/wk")
                StatPill(value: "~\(plan.estimatedDurationMins)", label: "min/session")
                StatPill(value: "\(completedCount)", label: "completed")
            }
        }
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
        .padding(.horizontal, 16)
    }
}

private struct StatPill: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Week Strip

private struct WeekStripView: View {
    let plan: WorkoutPlan
    let logs: [WorkoutLog]
    let todayISO: String

    private let dayLetters = ["M", "T", "W", "T", "F", "S", "S"]

    private var weekDates: [String] {
        let today = Date()
        let cal = Calendar.current
        let weekday = cal.component(.weekday, from: today) // 1=Sun…7=Sat
        let daysFromMon = (weekday + 5) % 7
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return (0..<7).compactMap { offset in
            cal.date(byAdding: .day, value: offset - daysFromMon, to: today)
                .map { formatter.string(from: $0) }
        }
    }

    private func workout(for iso: String) -> ProgramWorkout? {
        plan.planJson.workouts.first { $0.scheduledDate == iso }
    }

    private func isCompleted(for iso: String) -> Bool {
        guard let w = workout(for: iso) else { return false }
        return logs.contains { $0.sessionTitle == "Day \(w.day): \(w.focus)" && $0.completed }
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(weekDates.enumerated()), id: \.offset) { idx, date in
                VStack(spacing: 5) {
                    Text(dayLetters[idx])
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    ZStack {
                        Circle()
                            .strokeBorder(date == todayISO ? Color.accentColor : Color.clear, lineWidth: 2)
                            .frame(width: 32, height: 32)

                        if isCompleted(for: date) {
                            Circle()
                                .fill(Color.green.opacity(0.15))
                                .frame(width: 28, height: 28)
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.green)
                        } else if workout(for: date) != nil {
                            Circle()
                                .fill(Color.accentColor.opacity(0.18))
                                .frame(width: 28, height: 28)
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 8, height: 8)
                        } else {
                            Circle()
                                .fill(Color(.systemFill))
                                .frame(width: 28, height: 28)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 1)
        .padding(.horizontal, 16)
    }
}

// MARK: - Today / Next Workout Card

private struct TodayWorkoutCard: View {
    let workout: ProgramWorkout
    let plan: WorkoutPlan
    let isToday: Bool
    let onStart: () -> Void

    private var setCount: Int {
        workout.exercises.reduce(0) { acc, ex in
            acc + (Int(ex.sets.components(separatedBy: "-").first?.trimmingCharacters(in: .whitespaces) ?? ex.sets) ?? 3)
        }
    }

    private var estMins: Int {
        max(1, plan.estimatedDurationMins / max(1, plan.sessionsPerWeek))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label(isToday ? "Today's Workout" : "Up Next",
                      systemImage: isToday ? "bolt.fill" : "arrow.right.circle.fill")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(isToday ? .white : Color.accentColor)
                Spacer()
                Text("Day \(workout.day)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(isToday ? .white.opacity(0.75) : Color.accentColor.opacity(0.75))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isToday ? Color.accentColor : Color.accentColor.opacity(0.1))

            VStack(alignment: .leading, spacing: 14) {
                Text(workout.focus)
                    .font(.title3)
                    .fontWeight(.bold)

                HStack(spacing: 18) {
                    Label("\(workout.exercises.count) exercises", systemImage: "list.bullet")
                    Label("\(setCount) sets", systemImage: "arrow.triangle.2.circlepath")
                    Label("~\(estMins) min", systemImage: "clock")
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 6) {
                    ForEach(workout.exercises.prefix(3)) { ex in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.accentColor.opacity(0.4))
                                .frame(width: 5, height: 5)
                            Text(ex.name)
                                .font(.subheadline)
                            Spacer()
                            Text("\(ex.sets) × \(ex.reps)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if workout.exercises.count > 3 {
                        Text("+ \(workout.exercises.count - 3) more")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .padding(.leading, 13)
                    }
                }
                .padding(12)
                .background(Color(.systemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))

                Button(action: onStart) {
                    Label("Start Workout", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(16)
        }
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.accentColor.opacity(0.25), lineWidth: 1))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
        .padding(.horizontal, 16)
    }
}

private struct AllDoneCard: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 26))
                .foregroundStyle(.yellow)
            VStack(alignment: .leading, spacing: 3) {
                Text("Week Complete!")
                    .font(.headline)
                Text("All workouts done. Great work — keep recovering well.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 6, x: 0, y: 2)
        .padding(.horizontal, 16)
    }
}

// MARK: - Recent Session Row

private struct RecentSessionRow: View {
    let log: WorkoutLog

    private var friendlyDate: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: log.sessionDate) else { return log.sessionDate }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .none
        return out.string(from: d)
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(log.completed ? Color.green.opacity(0.12) : Color.orange.opacity(0.12))
                    .frame(width: 40, height: 40)
                Image(systemName: log.completed ? "checkmark.circle.fill" : "clock.circle.fill")
                    .foregroundStyle(log.completed ? .green : .orange)
                    .font(.title3)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(log.sessionTitle)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)
                Text(friendlyDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let rpe = log.exertionRpe {
                VStack(spacing: 1) {
                    Text("RPE")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("\(rpe)")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundStyle(rpeColor(rpe))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 1)
        .padding(.horizontal, 16)
    }

    private func rpeColor(_ r: Int) -> Color {
        r <= 5 ? .green : r <= 7 ? .orange : .red
    }
}

// MARK: - Full Program Day Row

private struct WorkoutDayRow: View {
    let workout: ProgramWorkout
    let logs: [WorkoutLog]
    let todayISO: String

    private var isToday: Bool { workout.scheduledDate == todayISO }
    private var isCompleted: Bool {
        logs.contains { $0.sessionTitle == "Day \(workout.day): \(workout.focus)" && $0.completed }
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(isCompleted ? Color.green.opacity(0.12) : isToday ? Color.accentColor.opacity(0.12) : Color(.systemFill))
                    .frame(width: 42, height: 42)
                if isCompleted {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Text("\(workout.day)")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(isToday ? Color.accentColor : .primary)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(workout.focus)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    if isToday {
                        Text("TODAY")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.accentColor, in: Capsule())
                    }
                }
                Text("\(workout.exercises.count) exercises")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isToday ? Color.accentColor.opacity(0.35) : Color.clear, lineWidth: 1.5)
        )
    }
}

// MARK: - Workout Day Detail (Read-Only)

struct WorkoutDayDetailView: View {
    let workout: ProgramWorkout
    let plan: WorkoutPlan

    var body: some View {
        List {
            Section {
                LabeledContent("Workout", value: "Day \(workout.day)")
                LabeledContent("Focus", value: workout.focus)
                LabeledContent("Exercises", value: "\(workout.exercises.count)")
                LabeledContent("Est. Duration", value: "~\(max(1, plan.estimatedDurationMins / max(1, plan.sessionsPerWeek))) min")
                if let notes = workout.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let date = workout.scheduledDate {
                    LabeledContent("Scheduled", value: date)
                }
            } header: { Text("Overview") }

            ForEach(Array(workout.exercises.enumerated()), id: \.offset) { idx, ex in
                Section {
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(idx + 1)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(.secondary)
                            .frame(width: 18)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(ex.name).fontWeight(.semibold)
                            HStack(spacing: 12) {
                                Label("\(ex.sets) sets", systemImage: "arrow.triangle.2.circlepath")
                                Label("\(ex.reps) reps", systemImage: "number")
                                if let rest = ex.rest {
                                    Label(rest, systemImage: "clock")
                                }
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                    ExerciseVideoThumbnail(
                        exerciseName: ex.name,
                        workoutPlanId: plan.id,
                        videoURL: ex.videoUrl,
                        openExternallyOnly: ex.openExternallyOnly
                    )
                    if let desc = ex.exerciseDescription, !desc.isEmpty {
                        Text(desc)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !ex.coachingCues.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Coaching Cues")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)
                            ForEach(ex.coachingCues, id: \.self) { cue in
                                Label(cue, systemImage: "arrow.right.circle")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let notes = ex.notes, !notes.isEmpty {
                        Label(notes, systemImage: "note.text")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }
        }
        .navigationTitle(workout.focus)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - History Sheet

struct WorkoutHistoryView: View {
    let logs: [WorkoutLog]
    @Environment(\.dismiss) private var dismiss

    private var groupedByWeek: [(String, [WorkoutLog])] {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.locale = Locale(identifier: "en_US_POSIX")
        let hf = DateFormatter()
        hf.dateFormat = "MMM d"
        let cal = Calendar.current

        let grouped = Dictionary(grouping: logs) { log -> String in
            guard let d = df.date(from: log.sessionDate) else { return "Unknown" }
            var comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: d)
            comps.weekday = 2
            guard let monday = cal.date(from: comps) else { return "Unknown" }
            return "Week of \(hf.string(from: monday))"
        }
        return grouped.sorted { $0.key > $1.key }
    }

    var body: some View {
        NavigationStack {
            Group {
                if logs.isEmpty {
                    ContentUnavailableView(
                        "No Sessions Yet",
                        systemImage: "calendar.badge.clock",
                        description: Text("Complete your first workout to see your history here.")
                    )
                } else {
                    List {
                        ForEach(groupedByWeek, id: \.0) { week, weekLogs in
                            Section(week) {
                                ForEach(weekLogs) { log in
                                    HistoryRow(log: log)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Session History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct HistoryRow: View {
    let log: WorkoutLog

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: log.completed ? "checkmark.circle.fill" : "clock.fill")
                .foregroundStyle(log.completed ? .green : .orange)
            VStack(alignment: .leading, spacing: 2) {
                Text(log.sessionTitle)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(log.sessionDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let rpe = log.exertionRpe {
                Text("RPE \(rpe)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
