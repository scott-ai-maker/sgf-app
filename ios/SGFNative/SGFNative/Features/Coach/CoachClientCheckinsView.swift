import SwiftUI
import Charts

struct CoachClientCheckinsView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    let client: CoachClient

    @State private var checkins: [WeeklyCheckin] = []
    @State private var progressSummary: ProgressSummaryResponse?
    @State private var loading = false
    @State private var error: String?
    @State private var feedbackDrafts: [String: String] = [:]
    @State private var savingId: String? = nil
    @State private var selectedStrengthExercise = ""

    private var isImperial: Bool { sessionStore.preferredUnits == "imperial" }

    var body: some View {
        Group {
            if loading {
                ProgressView("Loading check-ins...")
            } else if let error {
                ContentUnavailableView("Could not load check-ins", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if checkins.isEmpty && progressSummary == nil {
                ContentUnavailableView("No check-ins yet", systemImage: "doc.text")
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        if let progressSummary {
                            CoachProgressHeader(summary: progressSummary, isImperial: isImperial)

                            if !progressSummary.weightTrend.isEmpty {
                                CoachWeightTrendCard(points: progressSummary.weightTrend, isImperial: isImperial)
                            }

                            if !progressSummary.strengthTrend.isEmpty {
                                CoachStrengthTrendCard(
                                    series: progressSummary.strengthTrend,
                                    selectedExercise: $selectedStrengthExercise,
                                    isImperial: isImperial
                                )
                            }
                        }

                        if !checkins.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Check-ins")
                                    .font(.headline)

                                ForEach(checkins) { checkin in
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(checkin.weekStart).bold()
                                        Text("Sleep: \(checkin.sleepQuality ?? 0), Stress: \(checkin.stressLevel ?? 0), Soreness: \(checkin.sorenessLevel ?? 0), Energy: \(checkin.energyLevel ?? 0)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        if let notes = checkin.notes, !notes.isEmpty {
                                            Text(notes).font(.footnote)
                                        }

                                        HStack(alignment: .top, spacing: 8) {
                                            TextField(
                                                "Coach feedback…",
                                                text: Binding(
                                                    get: { feedbackDrafts[checkin.id] ?? checkin.coachFeedback ?? "" },
                                                    set: { feedbackDrafts[checkin.id] = $0 }
                                                ),
                                                axis: .vertical
                                            )
                                            .font(.footnote)
                                            .textFieldStyle(.roundedBorder)

                                            Button {
                                                Task { await saveFeedback(checkin: checkin) }
                                            } label: {
                                                if savingId == checkin.id {
                                                    ProgressView()
                                                        .controlSize(.small)
                                                } else {
                                                    Text("Save")
                                                        .font(.footnote)
                                                }
                                            }
                                            .buttonStyle(.bordered)
                                            .disabled(savingId != nil)
                                        }
                                    }
                                    .padding(14)
                                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                                }
                            }
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle(client.fullName?.isEmpty == false ? client.fullName! : "Client")
        .task {
            await load()
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil

        do {
            async let checkinsTask = APIClient(token: token).fetchCoachClientCheckins(clientId: client.id)
            async let progressTask = APIClient(token: token).fetchProgressSummary(clientId: client.id)
            checkins = try await checkinsTask
            progressSummary = try await progressTask
            if let firstExercise = progressSummary?.strengthTrend.first?.exerciseName,
               !progressSummary!.strengthTrend.contains(where: { $0.exerciseName == selectedStrengthExercise }) {
                selectedStrengthExercise = firstExercise
            }
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func saveFeedback(checkin: WeeklyCheckin) async {
        guard let token = sessionStore.accessToken else { return }

        let draft = feedbackDrafts[checkin.id] ?? checkin.coachFeedback ?? ""

        savingId = checkin.id
        defer { savingId = nil }

        do {
            let updated = try await APIClient(token: token).patchCoachFeedback(
                clientId: client.id,
                checkinId: checkin.id,
                feedback: draft
            )
            if let index = checkins.firstIndex(where: { $0.id == checkin.id }) {
                checkins[index] = updated
            }
            feedbackDrafts.removeValue(forKey: checkin.id)
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

private struct CoachProgressHeader: View {
    let summary: ProgressSummaryResponse
    let isImperial: Bool

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }

    var body: some View {
        HStack(spacing: 12) {
            CoachStatCard(
                title: "Latest Weight",
                value: summary.weightTrend.last.map { String(format: "%.1f %@", displayWeight($0.weightKg), isImperial ? "lbs" : "kg") } ?? "-"
            )
            CoachStatCard(
                title: "Strength Trends",
                value: "\(summary.strengthTrend.count)"
            )
            CoachStatCard(
                title: "PRs",
                value: "\(summary.personalRecords.count)"
            )
        }
    }
}

private struct CoachStatCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct CoachWeightTrendCard: View {
    let points: [WeightDataPoint]
    let isImperial: Bool

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }

    private var unit: String { isImperial ? "lbs" : "kg" }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Weight Trend")
                .font(.headline)
            Chart(points) { point in
                LineMark(
                    x: .value("Week", shortCoachDate(point.weekStart)),
                    y: .value(unit, displayWeight(point.weightKg))
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.accentColor)

                PointMark(
                    x: .value("Week", shortCoachDate(point.weekStart)),
                    y: .value(unit, displayWeight(point.weightKg))
                )
                .foregroundStyle(Color.accentColor)
            }
            .frame(height: 180)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct CoachStrengthTrendCard: View {
    let series: [StrengthTrendSeries]
    @Binding var selectedExercise: String
    let isImperial: Bool

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }

    private var unit: String { isImperial ? "lbs" : "kg" }

    private var selectedSeries: StrengthTrendSeries? {
        if let exact = series.first(where: { $0.exerciseName == selectedExercise }) {
            return exact
        }
        return series.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Strength Trend")
                .font(.headline)

            Picker("Exercise", selection: $selectedExercise) {
                ForEach(series) { item in
                    Text(item.exerciseName).tag(item.exerciseName)
                }
            }
            .pickerStyle(.menu)

            if let selectedSeries {
                Chart(selectedSeries.points) { point in
                    LineMark(
                        x: .value("Session", shortCoachDate(point.sessionDate)),
                        y: .value(unit, displayWeight(point.bestWeightKg))
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(Color.orange)

                    PointMark(
                        x: .value("Session", shortCoachDate(point.sessionDate)),
                        y: .value(unit, displayWeight(point.bestWeightKg))
                    )
                    .foregroundStyle(Color.orange)
                }
                .frame(height: 180)
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

private func shortCoachDate(_ iso: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: iso) else { return iso }
    let out = DateFormatter()
    out.locale = Locale(identifier: "en_US_POSIX")
    out.dateFormat = "MMM d"
    return out.string(from: date)
}

