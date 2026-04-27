import SwiftUI

struct BookingView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var packages: [ClientPackage] = []
    @State private var selectedPackage: ClientPackage?
    @State private var slots: [SessionSlot] = []
    @State private var selectedSlot: SessionSlot?
    @State private var loading = false
    @State private var error: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                if loading && slots.isEmpty {
                    ProgressView("Loading...")
                }

                if let error {
                    Text(error)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                }

                if let successMessage {
                    Text(successMessage)
                        .foregroundStyle(.green)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                }

                if packages.isEmpty && !loading {
                    ContentUnavailableView("No active packages", systemImage: "creditcard.slash", description: Text("Purchase a package to book sessions."))
                } else {
                    if !packages.isEmpty {
                        Picker("Package", selection: $selectedPackage) {
                            Text("Select a package").tag(Optional<ClientPackage>.none)
                            ForEach(packages) { pkg in
                                Text("\(pkg.packageName) (\(pkg.sessionsRemaining) left)")
                                    .tag(Optional(pkg))
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(.horizontal)
                    }

                    List(slots) { slot in
                        Button {
                            selectedSlot = slot
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(slot.date) \(slot.time)")
                                    Text(slot.datetime)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if selectedSlot?.id == slot.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Button("Book Selected Slot") {
                        Task {
                            await bookSelectedSlot()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(selectedSlot == nil || selectedPackage == nil)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle("Book Session")
            .task {
                await load()
            }
            .refreshable {
                await load()
            }
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil

        do {
            async let packagesTask = APIClient(token: token).fetchClientPackages()
            async let slotsTask = APIClient(token: token).fetchAvailableSlots()
            packages = try await packagesTask
            slots = try await slotsTask
            if selectedPackage == nil, let first = packages.first {
                selectedPackage = first
            }
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func bookSelectedSlot() async {
        guard let token = sessionStore.accessToken,
              let selectedSlot,
              let selectedPackage else { return }

        do {
            try await APIClient(token: token).bookSession(
                packageId: selectedPackage.id,
                scheduledAt: selectedSlot.datetime
            )
            successMessage = "Session booked."
            await load()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

