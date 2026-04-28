import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var sessionStore: SessionStore

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

                                if dashboard.role == "coach" {
                                    Text("You are in coach mode. Client package/session counts appear when signed in as a client account.")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                } else {
                                    Text("Sessions remaining: \(dashboard.metrics.sessionsRemaining ?? 0) • Upcoming: \(dashboard.metrics.upcomingSessionCount ?? 0)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 6)
                        }

                        Section("Account") {
                            Text(dashboard.user.email)
                            Text("Role: \(dashboard.role)")
                        }

                        Section("Metrics") {
                            if dashboard.role == "coach" {
                                LabeledContent("Assigned Clients", value: String(dashboard.metrics.assignedClients ?? 0))
                                LabeledContent("Unassigned Clients", value: String(dashboard.metrics.unassignedClients ?? 0))
                            } else {
                                LabeledContent("Packages", value: String(dashboard.metrics.packageCount ?? 0))
                                LabeledContent("Sessions Remaining", value: String(dashboard.metrics.sessionsRemaining ?? 0))
                                LabeledContent("Upcoming Sessions", value: String(dashboard.metrics.upcomingSessionCount ?? 0))
                            }
                        }

                        if let packages = dashboard.packages, !packages.isEmpty {
                            Section("Packages") {
                                ForEach(packages) { package in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(package.packageName).bold()
                                        Text("\(package.sessionsRemaining) sessions remaining")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }

                        if let sessions = dashboard.upcomingSessions, !sessions.isEmpty {
                            Section("Upcoming") {
                                ForEach(sessions) { session in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(session.scheduledAt)
                                        Text(session.status.capitalized)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
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
