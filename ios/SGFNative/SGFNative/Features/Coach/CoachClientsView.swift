import SwiftUI

struct CoachClientsView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var clients: [CoachClient] = []
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading clients...")
                } else if let error {
                    ContentUnavailableView(
                        "Coach Access Required",
                        systemImage: "person.2.slash",
                        description: Text(error)
                    )
                } else if clients.isEmpty {
                    ContentUnavailableView("No assigned clients", systemImage: "person.2")
                } else {
                    List(clients) { client in
                        NavigationLink {
                            CoachClientCheckinsView(client: client)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(client.fullName?.isEmpty == false ? client.fullName! : (client.email ?? "Client"))
                                    .bold()
                                Text(client.email ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("Sessions remaining: \(client.sessionsRemaining)")
                                    .font(.caption)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Coach")
            .task {
                await load()
            }
            .refreshable {
                await load()
            }
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil

        do {
            clients = try await APIClient(token: token).fetchCoachClients()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }
}
