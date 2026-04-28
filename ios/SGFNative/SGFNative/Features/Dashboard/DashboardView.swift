import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)
    private let cardWhite = Color.white
    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)

    @State private var dashboard: DashboardResponse?
    @State private var coachClients: [CoachClient] = []
    @State private var composeTarget: CoachClient?
    @State private var loading = false
    @State private var error: String?

    private var needsAttentionClients: [CoachClient] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoBasic = ISO8601DateFormatter()
        return coachClients.filter { client in
            let noRecentCheckin: Bool = {
                guard let s = client.lastCheckinDate,
                      let d = iso.date(from: s) ?? isoBasic.date(from: s) else { return true }
                return d < cutoff
            }()
            return noRecentCheckin || client.sessionsRemaining <= 2 || client.onboardingCompletedAt == nil
        }
        .sorted { urgencyScore($0, cutoff: cutoff, iso: iso, isoBasic: isoBasic) > urgencyScore($1, cutoff: cutoff, iso: iso, isoBasic: isoBasic) }
    }

    private func urgencyScore(_ c: CoachClient, cutoff: Date, iso: ISO8601DateFormatter, isoBasic: ISO8601DateFormatter) -> Int {
        var score = 0
        if c.onboardingCompletedAt == nil { score += 4 }
        if let s = c.lastCheckinDate, let d = iso.date(from: s) ?? isoBasic.date(from: s) {
            if d < cutoff { score += 2 }
        } else {
            score += 3
        }
        if c.sessionsRemaining <= 2 { score += 1 }
        return score
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading dashboard...")
                } else if let error {
                    ContentUnavailableView("Could not load dashboard", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if let dashboard {
                    List {
                        if dashboard.role == "coach" && !needsAttentionClients.isEmpty {
                            Section {
                                ForEach(needsAttentionClients) { client in
                                    NeedsAttentionRow(client: client) {
                                        composeTarget = client
                                    }
                                    .listRowBackground(cardWhite)
                                }
                            } header: {
                                HStack(spacing: 6) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .foregroundStyle(Color(red: 212.0/255, green: 160.0/255, blue: 23.0/255))
                                    Text("Needs Attention")
                                        .foregroundStyle(textNavy)
                                        .textCase(nil)
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                        Section {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(dashboard.role == "coach" ? "Coach Overview" : "Client Overview")
                                    .font(.headline)
                                    .foregroundStyle(textNavy)

                                if dashboard.role == "coach" {
                                    Text("You are in coach mode. Client package/session counts appear when signed in as a client account.")
                                        .font(.subheadline)
                                        .foregroundStyle(textSlate)
                                }
                            }
                            .padding(.vertical, 6)
                        }

                        if dashboard.role != "coach" {
                            Section {
                                ClientHeroCard(dashboard: dashboard)
                                    .listRowBackground(cardWhite)
                            }
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
            .sheet(item: $composeTarget) { client in
                QuickMessageSheet(client: client)
                    .environmentObject(sessionStore)
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
            if loaded.role == "coach" {
                coachClients = (try? await APIClient(token: token).fetchCoachClients()) ?? []
            }
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }
}

// MARK: - Needs Attention Row

private struct NeedsAttentionRow: View {
    let client: CoachClient
    let onMessage: () -> Void

    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)
    private let gold = Color(red: 212.0 / 255.0, green: 160.0 / 255.0, blue: 23.0 / 255.0)

    private var riskTags: [String] {
        var tags: [String] = []
        if client.onboardingCompletedAt == nil { tags.append("Not onboarded") }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoBasic = ISO8601DateFormatter()
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        if let s = client.lastCheckinDate, let d = iso.date(from: s) ?? isoBasic.date(from: s) {
            if d < cutoff {
                let days = Calendar.current.dateComponents([.day], from: d, to: Date()).day ?? 0
                tags.append("No check-in \(days)d")
            }
        } else {
            tags.append("Never checked in")
        }
        if client.sessionsRemaining <= 2 { tags.append("\(client.sessionsRemaining) sessions left") }
        return tags
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(client.fullName ?? client.email ?? "Unknown")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(textNavy)
                HStack(spacing: 6) {
                    ForEach(riskTags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .fontWeight(.medium)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(gold.opacity(0.15), in: Capsule())
                            .foregroundStyle(gold)
                    }
                }
            }
            Spacer()
            Button(action: onMessage) {
                Label("Message", systemImage: "bubble.left.fill")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(red: 13.0/255, green: 27.0/255, blue: 42.0/255), in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Quick Message Sheet

private struct QuickMessageSheet: View {
    let client: CoachClient
    @EnvironmentObject private var sessionStore: SessionStore
    @Environment(\.dismiss) private var dismiss

    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)

    @State private var draft = ""
    @State private var sending = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("To: \(client.fullName ?? client.email ?? "client")")
                    .font(.subheadline)
                    .foregroundStyle(textNavy.opacity(0.7))
                    .padding(.horizontal)

                TextEditor(text: $draft)
                    .padding(8)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 10))
                    .frame(minHeight: 120)
                    .padding(.horizontal)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                }

                Spacer()
            }
            .padding(.top, 16)
            .background(surfaceIvory)
            .navigationTitle("Quick Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task { await send() }
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                }
            }
        }
    }

    private func send() async {
        guard let token = sessionStore.accessToken else { return }
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true
        do {
            _ = try await APIClient(token: token).sendMessage(text, clientId: client.id)
            dismiss()
        } catch {
            errorMessage = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
        sending = false
    }
}

// MARK: - Client Hero Card

private struct ClientHeroCard: View {
    let dashboard: DashboardResponse

    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)
    private let gold = Color(red: 212.0 / 255.0, green: 160.0 / 255.0, blue: 23.0 / 255.0)

    private var sessionsRemaining: Int {
        dashboard.metrics.sessionsRemaining ?? 0
    }

    private var nextSession: UpcomingSession? {
        dashboard.upcomingSessions?
            .sorted { $0.scheduledAt < $1.scheduledAt }
            .first
    }

    private var nextSessionFormatted: String? {
        guard let s = nextSession else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoBasic = ISO8601DateFormatter()
        guard let date = iso.date(from: s.scheduledAt) ?? isoBasic.date(from: s.scheduledAt) else {
            return s.scheduledAt
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE, MMM d 'at' h:mm a"
        return f.string(from: date)
    }

    private var todayAction: (icon: String, text: String) {
        if sessionsRemaining == 0 {
            return ("cart.badge.plus", "Purchase a package to book sessions")
        } else if nextSession == nil {
            return ("calendar.badge.plus", "Book your next session")
        } else {
            return ("checkmark.circle", "Check in with your coach this week")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Sessions remaining
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(sessionsRemaining)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(sessionsRemaining > 2 ? textNavy : gold)
                VStack(alignment: .leading, spacing: 2) {
                    Text("sessions")
                        .font(.subheadline)
                        .foregroundStyle(textSlate)
                    Text("remaining")
                        .font(.subheadline)
                        .foregroundStyle(textSlate)
                }
            }

            Divider()

            // Next session
            HStack(spacing: 10) {
                Image(systemName: "calendar")
                    .foregroundStyle(textNavy)
                    .frame(width: 20)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next session")
                        .font(.caption)
                        .foregroundStyle(textSlate)
                    Text(nextSessionFormatted ?? "No sessions booked")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(textNavy)
                }
            }

            // Today's action
            HStack(spacing: 10) {
                Image(systemName: todayAction.icon)
                    .foregroundStyle(gold)
                    .frame(width: 20)
                Text(todayAction.text)
                    .font(.subheadline)
                    .foregroundStyle(textNavy)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(gold.opacity(0.18), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(gold.opacity(0.35), lineWidth: 1))
        }
        .padding(.vertical, 4)
    }
}
