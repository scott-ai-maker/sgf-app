import Foundation

@MainActor
final class SessionStore: ObservableObject {
    enum State {
        case loading
        case signedOut
        case signedIn(UserSession)
    }

    struct UserSession {
        let userId: String
        let email: String?
        let accessToken: String
        let refreshToken: String
    }

    @Published private(set) var state: State = .loading
    @Published var lastError: String?

    private let authService = SupabaseAuthService()
    private let tokenKey = "sgf.accessToken"
    private let refreshKey = "sgf.refreshToken"
    private let userIdKey = "sgf.userId"
    private let userEmailKey = "sgf.userEmail"

    var accessToken: String? {
        if case let .signedIn(session) = state {
            return session.accessToken
        }
        return nil
    }

    func restoreSessionIfNeeded() {
        guard case .loading = state else { return }

        let defaults = UserDefaults.standard
        guard let token = defaults.string(forKey: tokenKey),
              let refresh = defaults.string(forKey: refreshKey),
              let userId = defaults.string(forKey: userIdKey) else {
            state = .signedOut
            return
        }

        state = .signedIn(
            UserSession(
                userId: userId,
                email: defaults.string(forKey: userEmailKey),
                accessToken: token,
                refreshToken: refresh
            )
        )
    }

    func signIn(email: String, password: String) async {
        lastError = nil

        do {
            let response = try await authService.signIn(email: email, password: password)
            persist(response: response)
            state = .signedIn(
                UserSession(
                    userId: response.user.id,
                    email: response.user.email,
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken
                )
            )
        } catch {
            state = .signedOut
            lastError = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func signOut() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: refreshKey)
        defaults.removeObject(forKey: userIdKey)
        defaults.removeObject(forKey: userEmailKey)
        lastError = nil
        state = .signedOut
    }

    private func persist(response: SupabaseAuthResponse) {
        let defaults = UserDefaults.standard
        defaults.set(response.accessToken, forKey: tokenKey)
        defaults.set(response.refreshToken, forKey: refreshKey)
        defaults.set(response.user.id, forKey: userIdKey)
        defaults.set(response.user.email, forKey: userEmailKey)
    }
}
