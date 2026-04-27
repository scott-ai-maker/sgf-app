import SwiftUI

class AppDelegate: NSObject, UIApplicationDelegate {
    var sessionStore: SessionStore?

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        guard let store = sessionStore else { return }
        Task { @MainActor in
            PushNotificationManager.shared.didRegister(deviceTokenData: deviceToken, sessionStore: store)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[Push] Failed to register: \(error.localizedDescription)")
    }
}

@main
struct SGFNativeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var sessionStore = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessionStore)
                .task {
                    appDelegate.sessionStore = sessionStore
                    await PushNotificationManager.shared.requestPermission()
                }
        }
    }
}

