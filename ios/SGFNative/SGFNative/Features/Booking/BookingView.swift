import SwiftUI

struct BookingView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var slots: [SessionSlot] = []
    @State private var selectedSlot: SessionSlot?
    @State private var packageId = ""
    @State private var loading = false
    @State private var error: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TextField("Package ID", text: $packageId)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal)

                if loading && slots.isEmpty {
                    ProgressView("Loading slots...")
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
                .disabled(selectedSlot == nil || packageId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .padding(.bottom, 8)
            }
            .navigationTitle("Book Session")
            .task {
                await loadSlots()
            }
            .refreshable {
                await loadSlots()
            }
        }
    }

    private func loadSlots() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil

        do {
            slots = try await APIClient(token: token).fetchAvailableSlots()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func bookSelectedSlot() async {
        guard let token = sessionStore.accessToken,
              let selectedSlot else { return }

        do {
            try await APIClient(token: token).bookSession(
                packageId: packageId.trimmingCharacters(in: .whitespacesAndNewlines),
                scheduledAt: selectedSlot.datetime
            )
            successMessage = "Session booked."
            await loadSlots()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
