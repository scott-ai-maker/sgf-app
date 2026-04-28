import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)
    private let cardWhite = Color.white
    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)

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
                        NavigationLink {
                            ProgramView()
                        } label: {
                            Label("My Program", systemImage: "dumbbell")
                                .foregroundStyle(textNavy)
                        }

                        NavigationLink {
                            ClientProgressView()
                        } label: {
                            Label("Progress", systemImage: "chart.line.uptrend.xyaxis")
                                .foregroundStyle(textNavy)
                        }

                        NavigationLink {
                            FitnessView()
                        } label: {
                            Label("Fitness", systemImage: "heart.text.square")
                                .foregroundStyle(textNavy)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .background(surfaceIvory)
                    .listRowBackground(cardWhite)
                    .foregroundStyle(textSlate)
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
