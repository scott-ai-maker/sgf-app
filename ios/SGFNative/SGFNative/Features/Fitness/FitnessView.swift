import SwiftUI

struct FitnessView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var profile: FitnessProfile?
    @State private var checkins: [WeeklyCheckin] = []
    @State private var photos: [ProgressPhoto] = []

    @State private var sleepQuality = 3
    @State private var stressLevel = 3
    @State private var sorenessLevel = 3
    @State private var energyLevel = 3
    @State private var weightInput = ""
    @State private var waistInput = ""
    @State private var hipInput = ""
    @State private var neckInput = ""
    @State private var notes = ""

    @State private var loading = false
    @State private var error: String?
    @State private var status: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading fitness profile...")
                } else if let error {
                    ContentUnavailableView("Could not load profile", systemImage: "heart.slash", description: Text(error))
                } else if let profile {
                    List {
                        Section("Profile") {
                            LabeledContent("Preferred Units", value: profile.preferredUnits ?? "-")
                            LabeledContent("Training Days", value: profile.trainingDaysPerWeek.map(String.init) ?? "-")
                            LabeledContent("Goal", value: profile.fitnessGoal ?? "-")
                            LabeledContent("Experience", value: profile.experienceLevel ?? "-")
                        }

                        Section("Weekly Check-In") {
                            Stepper("Sleep Quality: \(sleepQuality)", value: $sleepQuality, in: 1...5)
                            Stepper("Stress Level: \(stressLevel)", value: $stressLevel, in: 1...5)
                            Stepper("Soreness Level: \(sorenessLevel)", value: $sorenessLevel, in: 1...5)
                            Stepper("Energy Level: \(energyLevel)", value: $energyLevel, in: 1...5)
                            let isImperial = sessionStore.preferredUnits == "imperial"
                            let measureUnit = isImperial ? "in" : "cm"
                            TextField(isImperial ? "Weight (lbs)" : "Weight (kg)", text: $weightInput)
                                .keyboardType(.decimalPad)
                            TextField("Waist (\(measureUnit))", text: $waistInput)
                                .keyboardType(.decimalPad)
                            TextField("Hips (\(measureUnit))", text: $hipInput)
                                .keyboardType(.decimalPad)
                            TextField("Neck (\(measureUnit))", text: $neckInput)
                                .keyboardType(.decimalPad)
                            TextField("Notes", text: $notes)

                            Button("Submit Check-In") {
                                Task {
                                    await submitCheckin()
                                }
                            }
                        }

                        if let status {
                            Section {
                                Text(status)
                                    .foregroundStyle(.green)
                            }
                        }

                        if !checkins.isEmpty {
                            Section("Recent Check-Ins") {
                                ForEach(checkins.prefix(6)) { checkin in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(checkin.weekStart).bold()
                                        Text("Sleep \(checkin.sleepQuality ?? 0), Stress \(checkin.stressLevel ?? 0), Soreness \(checkin.sorenessLevel ?? 0), Energy \(checkin.energyLevel ?? 0)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        if let wkg = checkin.weightKg {
                                            let isImperial = sessionStore.preferredUnits == "imperial"
                                            let displayed = isImperial ? wkg / 0.453592 : wkg
                                            let unit = isImperial ? "lbs" : "kg"
                                            Text(String(format: "Weight: %.1f %@", displayed, unit))
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }

                        if !photos.isEmpty {
                            Section("Progress Photos") {
                                ForEach(photos.prefix(12)) { photo in
                                    AsyncImage(url: URL(string: photo.photoURL)) { image in
                                        image
                                            .resizable()
                                            .scaledToFill()
                                    } placeholder: {
                                        Color.gray.opacity(0.2)
                                    }
                                    .frame(height: 160)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(alignment: .bottomLeading) {
                                        Text(photo.takenAt)
                                            .font(.caption2)
                                            .padding(6)
                                            .background(.ultraThinMaterial)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    ContentUnavailableView("No profile yet", systemImage: "figure.run")
                }
            }
            .navigationTitle("Fitness")
            .task {
                await loadProfile()
            }
            .refreshable {
                await loadProfile()
            }
        }
    }

    private func loadProfile() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil
        status = nil

        do {
            async let profileTask = APIClient(token: token).fetchFitnessProfile()
            async let checkinsTask = APIClient(token: token).fetchWeeklyCheckins()
            async let photosTask = APIClient(token: token).fetchProgressPhotos()

            profile = try await profileTask
            checkins = try await checkinsTask
            photos = try await photosTask
            // Publish the unit preference so all views stay in sync
            if let units = profile?.preferredUnits {
                sessionStore.setPreferredUnits(units)
            }
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func submitCheckin() async {
        guard let token = sessionStore.accessToken else { return }

        do {
            let raw = Double(weightInput.trimmingCharacters(in: .whitespacesAndNewlines))
            // Convert to kg for storage; backend always stores metric
            let weightValue = raw.map { sessionStore.preferredUnits == "imperial" ? $0 * 0.453592 : $0 }
            // Convert inches → cm for storage if imperial; backend always stores metric
            let inchesToCm: (Double) -> Double = { $0 * 2.54 }
            let waistValue = Double(waistInput.trimmingCharacters(in: .whitespacesAndNewlines))
                .map { sessionStore.preferredUnits == "imperial" ? inchesToCm($0) : $0 }
            let hipValue = Double(hipInput.trimmingCharacters(in: .whitespacesAndNewlines))
                .map { sessionStore.preferredUnits == "imperial" ? inchesToCm($0) : $0 }
            let neckValue = Double(neckInput.trimmingCharacters(in: .whitespacesAndNewlines))
                .map { sessionStore.preferredUnits == "imperial" ? inchesToCm($0) : $0 }
            let payload = WeeklyCheckinPayload(
                weekStart: currentWeekStartISODate(),
                sleepQuality: sleepQuality,
                stressLevel: stressLevel,
                sorenessLevel: sorenessLevel,
                energyLevel: energyLevel,
                weightKg: weightValue,
                waistCm: waistValue,
                hipCm: hipValue,
                neckCm: neckValue,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            _ = try await APIClient(token: token).submitWeeklyCheckin(payload)
            status = "Check-in saved."
            await loadProfile()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func currentWeekStartISODate() -> String {
        let calendar = Calendar(identifier: .iso8601)
        let now = Date()
        let interval = calendar.dateInterval(of: .weekOfYear, for: now)
        let weekStart = interval?.start ?? now
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: weekStart)
    }
}
