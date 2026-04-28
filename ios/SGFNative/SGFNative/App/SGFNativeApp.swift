import SwiftUI

private enum SGFTheme {
    static let navy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    static let navyMid = Color(red: 18.0 / 255.0, green: 35.0 / 255.0, blue: 54.0 / 255.0)
    static let gold = Color(red: 212.0 / 255.0, green: 160.0 / 255.0, blue: 23.0 / 255.0)
}

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

    init() {
        configureAppearance()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessionStore)
                .tint(SGFTheme.gold)
                .task {
                    appDelegate.sessionStore = sessionStore
                    await PushNotificationManager.shared.requestPermission()
                }
        }
    }

    private func configureAppearance() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = UIColor(SGFTheme.navy)
        nav.titleTextAttributes = [.foregroundColor: UIColor.white]
        nav.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav

        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(SGFTheme.navyMid)

        let selected = UIColor(SGFTheme.gold)
        let normal = UIColor(white: 0.78, alpha: 1.0)

        tab.stackedLayoutAppearance.selected.iconColor = selected
        tab.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: selected]
        tab.stackedLayoutAppearance.normal.iconColor = normal
        tab.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: normal]

        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }
}

