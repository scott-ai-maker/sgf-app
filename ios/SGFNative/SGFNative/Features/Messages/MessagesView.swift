import SwiftUI

struct MessagesView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)
    private let cardWhite = Color.white
    private let textNavy = Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0)
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)

    @State private var messages: [Message] = []
    @State private var draft = ""
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                if loading && messages.isEmpty {
                    ProgressView("Loading messages...")
                }

                if let error {
                    Text(error)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                }

                List(messages) { message in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(message.messageBody)
                            .foregroundStyle(textNavy)
                        Text(message.createdAt)
                            .font(.caption)
                            .foregroundStyle(textSlate)
                    }
                }
                .scrollContentBackground(.hidden)
                .background(surfaceIvory)
                .listRowBackground(cardWhite)

                HStack {
                    TextField("Message", text: $draft, axis: .vertical)
                        .textFieldStyle(.roundedBorder)

                    Button("Send") {
                        Task {
                            await sendMessage()
                        }
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .background(surfaceIvory)
            .navigationTitle("Messages")
            .task {
                await loadMessages()
            }
        }
    }

    private func loadMessages() async {
        guard let token = sessionStore.accessToken else { return }

        loading = true
        error = nil

        do {
            messages = try await APIClient(token: token).fetchMessages()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func sendMessage() async {
        guard let token = sessionStore.accessToken else { return }

        let messageText = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !messageText.isEmpty else { return }

        do {
            let sent = try await APIClient(token: token).sendMessage(messageText)
            messages.append(sent)
            draft = ""
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
