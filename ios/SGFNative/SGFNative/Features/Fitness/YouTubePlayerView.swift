import SwiftUI
import SafariServices

// MARK: - Video ID Extraction

private func normalizedURLString(_ input: String) -> String {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
        return trimmed
    }
    if trimmed.hasPrefix("www.") || trimmed.contains("youtube.com") || trimmed.contains("youtu.be") {
        return "https://\(trimmed)"
    }
    return trimmed
}

private func extractYouTubeID(from urlString: String) -> String? {
    // Handles:
    //   https://www.youtube.com/watch?v=VIDEO_ID
    //   https://youtu.be/VIDEO_ID
    //   https://www.youtube.com/embed/VIDEO_ID
    //   https://www.youtube.com/shorts/VIDEO_ID
    let normalized = normalizedURLString(urlString)

    // Support raw IDs stored in data sources.
    let idPattern = "^[A-Za-z0-9_-]{11}$"
    if normalized.range(of: idPattern, options: .regularExpression) != nil {
        return normalized
    }

    guard let url = URL(string: normalized) else { return nil }

    if let host = url.host, host.contains("youtu.be") {
        return url.pathComponents.dropFirst().first
    }

    if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
       let videoId = components.queryItems?.first(where: { $0.name == "v" })?.value {
        return videoId
    }

    let pathComponents = url.pathComponents
    if let embedIdx = pathComponents.firstIndex(of: "embed") ?? pathComponents.firstIndex(of: "shorts"),
       pathComponents.indices.contains(embedIdx + 1) {
        return pathComponents[embedIdx + 1]
    }

    return nil
}

private func normalizedVideoURL(_ urlString: String) -> URL? {
    URL(string: normalizedURLString(urlString))
}

private func watchURL(for videoID: String?) -> URL? {
        guard let videoID else { return nil }
        return URL(string: "https://www.youtube.com/watch?v=\(videoID)")
}

// MARK: - Safari wrapper

private struct SafariPlayerView: UIViewControllerRepresentable {
        let url: URL

        func makeUIViewController(context: Context) -> SFSafariViewController {
                let controller = SFSafariViewController(url: url)
                controller.dismissButtonStyle = .close
                controller.preferredControlTintColor = .systemRed
                return controller
        }

        func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

// MARK: - Full Player Sheet

struct YouTubePlayerSheet: View {
    let exerciseName: String
    let videoURL: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private var videoID: String? { extractYouTubeID(from: videoURL) }
    private var watchPageURL: URL? { watchURL(for: videoID) }
    private var originalURL: URL? { normalizedVideoURL(videoURL) }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemBackground).ignoresSafeArea()
                if let watchPageURL {
                    SafariPlayerView(url: watchPageURL)
                        .ignoresSafeArea()
                } else {
                    VStack(spacing: 12) {
                        ContentUnavailableView(
                            "Video unavailable",
                            systemImage: "video.slash",
                            description: Text("Could not load the exercise video.")
                        )
                        .foregroundStyle(.secondary)

                        if let originalURL {
                            Button("Open in YouTube") {
                                openURL(originalURL)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                }
            }
            .navigationTitle(exerciseName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if let originalURL {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Open") {
                            openURL(originalURL)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Thumbnail + Tap-to-Play (reusable inline component)

/// Shows a YouTube thumbnail with a play overlay. Tap opens the player sheet.
/// Falls back gracefully if no video URL is stored for the exercise.
struct ExerciseVideoThumbnail: View {
    let exerciseName: String
    let workoutPlanId: String?
    let videoURL: String?
    let openExternallyOnly: Bool

    @EnvironmentObject private var sessionStore: SessionStore
    @Environment(\.openURL) private var openURL
    @State private var showPlayer = false
    @State private var startedAt: Date?

    private var videoID: String? {
        videoURL.flatMap { extractYouTubeID(from: $0) }
    }

    private var thumbnailURL: URL? {
        guard let id = videoID else { return nil }
        // hqdefault is 480×360 — good quality, always available
        return URL(string: "https://img.youtube.com/vi/\(id)/hqdefault.jpg")
    }

    private var playableURL: URL? {
        if let watch = watchURL(for: videoID) {
            return watch
        }
        guard let raw = videoURL else { return nil }
        return normalizedVideoURL(raw)
    }

    var body: some View {
        if let thumbURL = thumbnailURL {
            Button {
                startedAt = Date()
                Task { await track(eventType: "started", watchSeconds: nil) }

                if openExternallyOnly, let playableURL {
                    openURL(playableURL)
                    Task { await track(eventType: "completed", watchSeconds: nil) }
                } else {
                    showPlayer = true
                }
            } label: {
                ZStack {
                    CachedThumbnailImage(url: thumbURL)
                    .frame(maxWidth: .infinity)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipped()

                    // Gradient scrim so play button is always legible
                    LinearGradient(
                        colors: [.black.opacity(0.4), .clear, .black.opacity(0.25)],
                        startPoint: .bottom,
                        endPoint: .top
                    )

                    // Play button
                    ZStack {
                        Circle()
                            .fill(.black.opacity(0.55))
                            .frame(width: 52, height: 52)
                        Image(systemName: "play.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(.white)
                            .offset(x: 2)
                    }

                    // Exercise label bottom-left
                    VStack {
                        Spacer()
                        HStack {
                            Image(systemName: "play.rectangle.fill")
                                .font(.caption2)
                            Text(openExternallyOnly ? "Open in YouTube" : "Watch Demo")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(.black.opacity(0.5), in: Capsule())
                        .padding(10)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .sheet(isPresented: $showPlayer, onDismiss: {
                guard let startedAt else { return }
                let elapsed = max(0, Int(Date().timeIntervalSince(startedAt)))
                Task { await track(eventType: "completed", watchSeconds: elapsed) }
            }) {
                YouTubePlayerSheet(exerciseName: exerciseName, videoURL: videoURL ?? "")
            }
        }
        // If no video URL, render nothing — no empty space
    }

    private func track(eventType: String, watchSeconds: Int?) async {
        guard let token = sessionStore.accessToken,
              let videoURL,
              !videoURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        let payload = WorkoutVideoEventRequest(
            workoutPlanId: workoutPlanId,
            exerciseName: exerciseName,
            videoUrl: videoURL,
            eventType: eventType,
            watchSeconds: watchSeconds,
            metadata: [
                "surface": "ios_workout",
                "openExternallyOnly": openExternallyOnly ? "true" : "false",
            ]
        )

        do {
            try await APIClient(token: token).logWorkoutVideoEvent(payload)
        } catch {
            // Best-effort analytics; never block workout flow.
        }
    }
}
