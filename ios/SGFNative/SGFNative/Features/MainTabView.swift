import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "house.fill")
                }

            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                }

            BookingView()
                .tabItem {
                    Label("Booking", systemImage: "calendar")
                }

            FitnessView()
                .tabItem {
                    Label("Fitness", systemImage: "figure.strengthtraining.traditional")
                }

            CoachClientsView()
                .tabItem {
                    Label("Coach", systemImage: "person.2.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
    }
}
