import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var onboardingComplete = false
    @State private var checkingOnboarding = false
    @State private var needsOnboarding = false

    var body: some View {
        Group {
            switch sessionStore.state {
            case .loading:
                ProgressView("Loading...")
            case .signedOut:
                LoginView()
            case .signedIn:
                if checkingOnboarding {
                    ProgressView("Loading...")
                } else if needsOnboarding && !onboardingComplete {
                    OnboardingView {
                        onboardingComplete = true
                        needsOnboarding = false
                    }
                } else {
                    MainTabView()
                }
            }
        }
        .task {
            sessionStore.restoreSessionIfNeeded()
        }
        .onChange(of: sessionStore.state) { _, newState in
            guard case .signedIn = newState,
                  let token = sessionStore.accessToken,
                  (sessionStore.role == nil || sessionStore.role == "client") else { return }
            Task { await checkOnboarding(token: token) }
        }
    }

    private func checkOnboarding(token: String) async {
        checkingOnboarding = true
        defer { checkingOnboarding = false }
        do {
            let profile = try await APIClient(token: token).fetchFitnessProfile()
            needsOnboarding = (profile == nil)
        } catch {
            needsOnboarding = false
        }
    }
}

#Preview {
    RootView()
        .environmentObject(SessionStore())
}
