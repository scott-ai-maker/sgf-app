import UserNotifications
import UIKit

@MainActor
final class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationManager()

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func requestPermission() async {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted {
            await UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Called from AppDelegate / SGFNativeApp after APNs returns a token.
    func didRegister(deviceTokenData: Data, sessionStore: SessionStore) {
        let tokenString = deviceTokenData.map { String(format: "%02x", $0) }.joined()
        guard let accessToken = sessionStore.accessToken else { return }
        Task {
            try? await APIClient(token: accessToken).registerPushToken(tokenString)
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner + sound even when app is foregrounded
        completionHandler([.banner, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }
}
