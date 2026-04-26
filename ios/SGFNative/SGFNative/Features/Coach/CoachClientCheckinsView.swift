import SwiftUI

struct CoachClientCheckinsView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    let client: CoachClient

    @State private var checkins: [WeeklyCheckin] = []
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        Group {
            if loading {
                ProgressView("Loading check-ins...")
            } else if let error {
                ContentUnavailableView("Could not load check-ins", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if checkins.isEmpty {
                ContentUnavailableView("No check-ins yet", systemImage: "doc.text")
            } else {
                List(checkins) { checkin in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(checkin.weekStart).bold()
                        Text("Sleep: \(checkin.sleepQuality ?? 0), Stress: \(checkin.stressLevel ?? 0), Soreness: \(checkin.sorenessLevel ?? 0), Energy: \(checkin.energyLevel ?? 0)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let notes = checkin.notes, !notes.isEmpty {
                            Text(notes).font(.footnote)
                        }
                        if let feedback = checkin.coachFeedback, !feedback.isEmpty {
                            Text("Feedback: \(feedback)")
                                .font(.footnote)
                                .foregroundStyle(.blue)
                        }
                    }
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
            checkins = try await APIClient(token: token).fetchCoachClientCheckins(clientId: client.id)
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }
}
