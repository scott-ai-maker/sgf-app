import SwiftUI

struct CoachClientCheckinsView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    let client: CoachClient

    @State private var checkins: [WeeklyCheckin] = []
    @State private var loading = false
    @State private var error: String?
    @State private var feedbackDrafts: [String: String] = [:]
    @State private var savingId: String? = nil

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
                    .padding(.vertical, 4)
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

