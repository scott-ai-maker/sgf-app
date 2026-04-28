import SwiftUI
import PhotosUI

struct SettingsView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let surfaceIvory = Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0)
    private let cardWhite = Color.white
    private let textSlate = Color(red: 106.0 / 255.0, green: 116.0 / 255.0, blue: 130.0 / 255.0)

    @State private var profile: SettingsProfile?
    @State private var avatarURL: String?
    @State private var avatarBusy = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var fullName = ""
    @State private var phone = ""
    @State private var loading = false
    @State private var saving = false
    @State private var status: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Avatar") {
                    HStack(spacing: 12) {
                        if let avatarURL,
                           let url = URL(string: avatarURL) {
                            AsyncImage(url: url) { image in
                                image
                                    .resizable()
                                    .scaledToFill()
                            } placeholder: {
                                Color.gray.opacity(0.2)
                            }
                            .frame(width: 64, height: 64)
                            .clipShape(Circle())
                        } else {
                            Circle()
                                .fill(Color.gray.opacity(0.2))
                                .frame(width: 64, height: 64)
                                .overlay {
                                    Image(systemName: "person.fill")
                                    .foregroundStyle(textSlate)
                                }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                                Text(avatarBusy ? "Uploading..." : "Choose Photo")
                            }
                            .disabled(avatarBusy)

                            Button("Remove Avatar", role: .destructive) {
                                Task {
                                    await removeAvatar()
                                }
                            }
                            .disabled(avatarBusy || avatarURL == nil)
                        }
                    }
                }

                if let profile {
                    Section("Account") {
                        LabeledContent("Email", value: profile.email)
                        LabeledContent("Role", value: profile.role.capitalized)
                    }
                }

                Section("Profile") {
                    TextField("Full Name", text: $fullName)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)

                    Button {
                        Task {
                            await save()
                        }
                    } label: {
                        if saving {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(fullName.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || saving)
                }

                if let status {
                    Section {
                        Text(status).foregroundStyle(.green)
                    }
                }

                if let error {
                    Section {
                        Text(error).foregroundStyle(.red)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(surfaceIvory)
            .listRowBackground(cardWhite)
            .navigationTitle("Settings")
            .task {
                await load()
            }
            .onChange(of: selectedPhotoItem) { _, newValue in
                guard let newValue else { return }

                Task {
                    await uploadSelectedPhoto(newValue)
                }
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
        status = nil

        do {
            let loaded = try await APIClient(token: token).fetchSettings()
            profile = loaded
            fullName = loaded.fullName
            phone = loaded.phone
            avatarURL = try await APIClient(token: token).fetchAvatarURL()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        loading = false
    }

    private func save() async {
        guard let token = sessionStore.accessToken else { return }

        saving = true
        error = nil
        status = nil

        do {
            let updated = try await APIClient(token: token).updateSettings(
                fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            profile = updated
            fullName = updated.fullName
            phone = updated.phone
            status = "Saved."
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        saving = false
    }

    private func uploadSelectedPhoto(_ item: PhotosPickerItem) async {
        guard let token = sessionStore.accessToken else { return }

        avatarBusy = true
        error = nil
        status = nil

        defer {
            avatarBusy = false
            selectedPhotoItem = nil
        }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIClientError.server("Could not read selected photo")
            }

            let uploaded = try await APIClient(token: token).uploadAvatar(data: data, mimeType: "image/jpeg")
            avatarURL = uploaded
            status = "Avatar updated."
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func removeAvatar() async {
        guard let token = sessionStore.accessToken else { return }

        avatarBusy = true
        error = nil
        status = nil

        defer {
            avatarBusy = false
        }

        do {
            _ = try await APIClient(token: token).deleteAvatar()
            avatarURL = nil
            status = "Avatar removed."
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
