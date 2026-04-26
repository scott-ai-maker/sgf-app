import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        Group {
            switch sessionStore.state {
            case .loading:
                ProgressView("Loading...")
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabView()
            }
        }
        .task {
            sessionStore.restoreSessionIfNeeded()
        }
    }
}

#Preview {
    RootView()
        .environmentObject(SessionStore())
}
