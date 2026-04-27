import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        if sessionStore.role == "coach" {
            TabView {
                DashboardView()
                    .tabItem {
                        Label("Dashboard", systemImage: "house.fill")
                    }

                CoachClientsView()
                    .tabItem {
                        Label("Clients", systemImage: "person.2.fill")
                    }

                MessagesView()
                    .tabItem {
                        Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
        } else {
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

                NavigationStack {
                    List {
                        NavigationLink("My Program") { ProgramView() }
                        NavigationLink("Progress") { ClientProgressView() }
                        NavigationLink("Fitness") { FitnessView() }
                    }
                    .navigationTitle("Train")
                }
                .tabItem {
                    Label("Train", systemImage: "dumbbell.fill")
                }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
        }
    }
}
