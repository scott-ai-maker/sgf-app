import Foundation

enum APIClientError: LocalizedError {
    case missingAuth
    case invalidResponse
    case server(String)
    case decoding

    var errorDescription: String? {
        switch self {
        case .missingAuth:
            return "You are not signed in."
        case .invalidResponse:
            return "Invalid server response."
        case let .server(message):
            return message
        case .decoding:
            return "Could not decode server response."
        }
    }
}

struct APIClient {
    let token: String

    private func endpoint(_ path: String) -> URL {
        let cleaned = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return AppConfig.apiBaseURL.appendingPathComponent(cleaned)
    }

    func fetchDashboard() async throws -> DashboardResponse {
        try await request(path: "/api/mobile/dashboard", method: "GET", body: Optional<Int>.none)
    }

    func fetchMessages(clientId: String? = nil) async throws -> [Message] {
        var path = "/api/messages"
        if let clientId, !clientId.isEmpty {
            path += "?clientId=\(clientId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? clientId)"
        }
        let response: MessagesResponse = try await request(path: path, method: "GET", body: Optional<Int>.none)
        return response.messages
    }

    func sendMessage(_ text: String, clientId: String? = nil) async throws -> Message {
        struct Payload: Encodable {
            let message: String
            let clientId: String?
        }

        struct Response: Decodable {
            let message: Message
        }

        let body = Payload(message: text, clientId: clientId)
        let response: Response = try await request(path: "/api/messages", method: "POST", body: body)
        return response.message
    }

    func fetchAvailableSlots() async throws -> [SessionSlot] {
        try await request(path: "/api/sessions/available", method: "GET", body: Optional<Int>.none)
    }

    func bookSession(packageId: String, scheduledAt: String) async throws {
        let body = BookSessionRequest(packageId: packageId, scheduledAt: scheduledAt)
        struct EmptyResponse: Decodable {}
        let _: EmptyResponse = try await request(path: "/api/sessions/book", method: "POST", body: body)
    }

    func fetchFitnessProfile() async throws -> FitnessProfile? {
        let response: FitnessProfileResponse = try await request(path: "/api/fitness/profile", method: "GET", body: Optional<Int>.none)
        return response.profile
    }

    func fetchProgressPhotos() async throws -> [ProgressPhoto] {
        let response: ProgressPhotosResponse = try await request(path: "/api/fitness/progress-photos", method: "GET", body: Optional<Int>.none)
        return response.photos
    }

    func fetchSettings() async throws -> SettingsProfile {
        let response: SettingsResponse = try await request(path: "/api/account/settings", method: "GET", body: Optional<Int>.none)
        return response.profile
    }

    func fetchAvatarURL() async throws -> String? {
        let response: AvatarResponse = try await request(path: "/api/account/avatar", method: "GET", body: Optional<Int>.none)
        return response.avatarUrl
    }

    func uploadAvatar(data: Data, mimeType: String, filename: String = "avatar.jpg") async throws -> String? {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"avatar\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        let response: AvatarResponse = try await rawRequest(
            path: "/api/account/avatar",
            method: "POST",
            headers: ["Content-Type": "multipart/form-data; boundary=\(boundary)"],
            body: body
        )

        return response.avatarUrl
    }

    func deleteAvatar() async throws -> String? {
        let response: AvatarResponse = try await request(path: "/api/account/avatar", method: "DELETE", body: Optional<Int>.none)
        return response.avatarUrl
    }

    func updateSettings(fullName: String, phone: String) async throws -> SettingsProfile {
        let payload = SettingsUpdateRequest(fullName: fullName, phone: phone)
        let response: SettingsResponse = try await request(path: "/api/account/settings", method: "PATCH", body: payload)
        return response.profile
    }

    func fetchWeeklyCheckins() async throws -> [WeeklyCheckin] {
        let response: WeeklyCheckinsResponse = try await request(path: "/api/fitness/checkin", method: "GET", body: Optional<Int>.none)
        return response.checkins
    }

    func submitWeeklyCheckin(_ payload: WeeklyCheckinPayload) async throws -> WeeklyCheckin {
        try await request(path: "/api/fitness/checkin", method: "POST", body: payload)
    }

    func fetchCoachClients() async throws -> [CoachClient] {
        let response: CoachClientsResponse = try await request(path: "/api/coach/clients", method: "GET", body: Optional<Int>.none)
        return response.clients
    }

    func fetchCoachClientCheckins(clientId: String) async throws -> [WeeklyCheckin] {
        let response: WeeklyCheckinsResponse = try await request(path: "/api/coach/clients/\(clientId)/checkins", method: "GET", body: Optional<Int>.none)
        return response.checkins
    }

    func patchCoachFeedback(clientId: String, checkinId: String, feedback: String) async throws -> WeeklyCheckin {
        struct Body: Encodable {
            let checkin_id: String
            let coach_feedback: String
        }
        return try await request(
            path: "/api/coach/clients/\(clientId)/checkins",
            method: "PATCH",
            body: Body(checkin_id: checkinId, coach_feedback: feedback)
        )
    }

    func fetchClientPackages() async throws -> [ClientPackage] {
        let dashboard = try await fetchDashboard()
        return dashboard.packages ?? []
    }

    func submitOnboarding<T: Encodable>(_ payload: T) async throws {
        let _: EmptyDecodable = try await request(path: "/api/fitness/profile", method: "POST", body: payload)
    }

    func fetchWorkoutPlans() async throws -> [WorkoutPlan] {
        let response: WorkoutPlansResponse = try await request(path: "/api/workouts/plans", method: "GET", body: Optional<Int>.none)
        return response.plans
    }

    func registerPushToken(_ deviceToken: String) async throws {
        struct Body: Encodable { let deviceToken: String; let platform: String }
        let _: EmptyDecodable = try await request(
            path: "/api/account/push-token",
            method: "POST",
            body: Body(deviceToken: deviceToken, platform: "ios")
        )
    }

    private func request<T: Decodable, B: Encodable>(path: String, method: String, body: B?) async throws -> T {
        var rawBody: Data? = nil
        if let body {
            rawBody = try JSONEncoder().encode(body)
        }

        return try await rawRequest(
            path: path,
            method: method,
            headers: ["Content-Type": rawBody == nil ? "" : "application/json"],
            body: rawBody
        )
    }

    private func rawRequest<T: Decodable>(
        path: String,
        method: String,
        headers: [String: String],
        body: Data?
    ) async throws -> T {
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        if let contentType = headers["Content-Type"], !contentType.isEmpty {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        if let body {
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            throw APIClientError.server(apiError?.error ?? "Request failed")
        }

        guard !data.isEmpty else {
            if let value = EmptyDecodable() as? T {
                return value
            }
            throw APIClientError.decoding
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIClientError.decoding
        }
    }
}

private struct EmptyDecodable: Decodable {}
