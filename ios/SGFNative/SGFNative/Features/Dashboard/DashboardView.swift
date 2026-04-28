import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)
    private let cardWhite = Color.white
    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)

    @State private var dashboard: DashboardResponse?
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading dashboard...")
                } else if let error {
                    ContentUnavailableView("Could not load dashboard", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if let dashboard {
                    List {
                        Section {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(dashboard.role == "coach" ? "Coach Overview" : "Client Overview")
                                    .font(.headline)
                                    .foregroundStyle(textNavy)

                                if dashboard.role == "coach" {
                                    Text("You are in coach mode. Client package/session counts appear when signed in as a client account.")
                                        .font(.subheadline)
                                        .foregroundStyle(textSlate)
                                } else {
                                    Text("Sessions remaining: \(dashboard.metrics.sessionsRemaining ?? 0) • Upcoming: \(dashboard.metrics.upcomingSessionCount ?? 0)")
                                        .font(.subheadline)
                                        .foregroundStyle(textSlate)
                                }
                            }
                            .padding(.vertical, 6)
                        }

                        Section("Account") {
                            Text(dashboard.user.email)
                                .foregroundStyle(textNavy)
                            Text("Role: \(dashboard.role)")
                                .foregroundStyle(textSlate)
                        }

                        Section("Metrics") {
                            if dashboard.role == "coach" {
                                LabeledContent("Assigned Clients", value: String(dashboard.metrics.assignedClients ?? 0))
                                    .foregroundStyle(textNavy)
                                LabeledContent("Unassigned Clients", value: String(dashboard.metrics.unassignedClients ?? 0))
                                    .foregroundStyle(textNavy)
                            } else {
                                LabeledContent("Packages", value: String(dashboard.metrics.packageCount ?? 0))
                                    .foregroundStyle(textNavy)
                                LabeledContent("Sessions Remaining", value: String(dashboard.metrics.sessionsRemaining ?? 0))
                                    .foregroundStyle(textNavy)
                                LabeledContent("Upcoming Sessions", value: String(dashboard.metrics.upcomingSessionCount ?? 0))
                                    .foregroundStyle(textNavy)
                            }
                        }

                        if let packages = dashboard.packages, !packages.isEmpty {
                            Section("Packages") {
                                ForEach(packages) { package in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(package.packageName).bold().foregroundStyle(textNavy)
                                        Text("\(package.sessionsRemaining) sessions remaining")
                                            .foregroundStyle(textSlate)
                                    }
                                }
                            }
                        }

                        if let sessions = dashboard.upcomingSessions, !sessions.isEmpty {
                            Section("Upcoming") {
                                ForEach(sessions) { session in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(session.scheduledAt)
                                            .foregroundStyle(textNavy)
                                        Text(session.status.capitalized)
                                            .foregroundStyle(textSlate)
                                    }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .background(surfaceIvory)
                    .listRowBackground(cardWhite)
                } else {
                    ContentUnavailableView("No dashboard data", systemImage: "rectangle.stack")
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign Out") {
                        sessionStore.signOut()
                    }
                }
            }
            .task {
                await loadDashboard()
            }
            .refreshable {
                await loadDashboard()
            }
        }
    }

    private func loadDashboard() async {
        guard let token = sessionStore.accessToken else {
            error = "Not authenticated"
            return
        }

        loading = true
        error = nil

        do {
            let loaded = try await APIClient(token: token).fetchDashboard()
            dashboard = loaded
            sessionStore.setRole(loaded.role)
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }
}
