import Foundation

struct APIErrorResponse: Decodable {
    let error: String
}

struct SupabaseAuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

struct AuthUser: Decodable {
    let id: String
    let email: String?
}

struct DashboardResponse: Decodable {
    let role: String
    let user: DashboardUser
    let packages: [ClientPackage]?
    let upcomingSessions: [UpcomingSession]?
    let metrics: DashboardMetrics
}

struct DashboardUser: Decodable {
    let id: String
    let email: String
}

struct DashboardMetrics: Decodable {
    let packageCount: Int?
    let sessionsRemaining: Int?
    let upcomingSessionCount: Int?
    let assignedClients: Int?
    let unassignedClients: Int?
}

struct ClientPackage: Decodable, Identifiable, Hashable {
    let id: String
    let packageName: String
    let sessionsRemaining: Int
    let purchasedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case packageName = "package_name"
        case sessionsRemaining = "sessions_remaining"
        case purchasedAt = "purchased_at"
    }
}

struct UpcomingSession: Decodable, Identifiable {
    let id: String
    let scheduledAt: String
    let status: String
    let durationMinutes: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case scheduledAt = "scheduled_at"
        case status
        case durationMinutes = "duration_minutes"
    }
}

struct Message: Decodable, Identifiable {
    let id: String
    let clientId: String
    let coachId: String
    let senderId: String
    let messageBody: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case coachId = "coach_id"
        case senderId = "sender_id"
        case messageBody = "message_body"
        case createdAt = "created_at"
    }
}

struct MessagesResponse: Decodable {
    let messages: [Message]
}

struct SessionSlot: Decodable, Identifiable {
    var id: String { datetime }
    let date: String
    let time: String
    let datetime: String
}

struct BookSessionRequest: Encodable {
    let packageId: String
    let scheduledAt: String
}

struct FitnessProfileResponse: Decodable {
    let profile: FitnessProfile?
}

struct ProgressPhotosResponse: Decodable {
    let photos: [ProgressPhoto]
}

struct ProgressPhoto: Decodable, Identifiable {
    let id: String
    let photoURL: String
    let takenAt: String
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case photoURL = "photo_url"
        case takenAt = "taken_at"
        case notes
    }
}

struct FitnessProfile: Decodable {
    let preferredUnits: String?
    let trainingDaysPerWeek: Int?
    let fitnessGoal: String?
    let experienceLevel: String?

    enum CodingKeys: String, CodingKey {
        case preferredUnits = "preferred_units"
        case trainingDaysPerWeek = "training_days_per_week"
        case fitnessGoal = "fitness_goal"
        case experienceLevel = "experience_level"
    }
}

struct SettingsResponse: Decodable {
    let profile: SettingsProfile
}

struct SettingsProfile: Decodable {
    let email: String
    let fullName: String
    let phone: String
    let role: String
}

struct SettingsUpdateRequest: Encodable {
    let fullName: String
    let phone: String
}

struct AvatarResponse: Decodable {
    let avatarUrl: String?
}

struct WeeklyCheckinsResponse: Decodable {
    let checkins: [WeeklyCheckin]
}

struct WeeklyCheckin: Decodable, Identifiable {
    let id: String
    let weekStart: String
    let sleepQuality: Int?
    let stressLevel: Int?
    let sorenessLevel: Int?
    let energyLevel: Int?
    let weightKg: Double?
    let notes: String?
    let coachFeedback: String?

    enum CodingKeys: String, CodingKey {
        case id
        case weekStart = "week_start"
        case sleepQuality = "sleep_quality"
        case stressLevel = "stress_level"
        case sorenessLevel = "soreness_level"
        case energyLevel = "energy_level"
        case weightKg = "weight_kg"
        case notes
        case coachFeedback = "coach_feedback"
    }
}

struct WeeklyCheckinPayload: Encodable {
    let weekStart: String
    let sleepQuality: Int
    let stressLevel: Int
    let sorenessLevel: Int
    let energyLevel: Int
    let weightKg: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case weekStart = "week_start"
        case sleepQuality = "sleep_quality"
        case stressLevel = "stress_level"
        case sorenessLevel = "soreness_level"
        case energyLevel = "energy_level"
        case weightKg = "weight_kg"
        case notes
    }
}

struct CoachClientsResponse: Decodable {
    let clients: [CoachClient]
}

struct WorkoutPlansResponse: Decodable {
    let plans: [WorkoutPlan]
}

struct WorkoutPlan: Decodable, Identifiable {
    let id: String
    let name: String
    let goal: String?
    let nasmOptPhase: Int
    let phaseName: String
    let sessionsPerWeek: Int
    let estimatedDurationMins: Int
    let planJson: WorkoutPlanJson
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, goal
        case nasmOptPhase = "nasm_opt_phase"
        case phaseName = "phase_name"
        case sessionsPerWeek = "sessions_per_week"
        case estimatedDurationMins = "estimated_duration_mins"
        case planJson = "plan_json"
        case createdAt = "created_at"
    }
}

struct WorkoutPlanJson: Decodable {
    let workouts: [WorkoutDay]
}

struct WorkoutDay: Decodable, Identifiable {
    var id: String { dayTag ?? name ?? UUID().uuidString }
    let name: String?
    let dayTag: String?
    let exercises: [PlanExercise]

    enum CodingKeys: String, CodingKey {
        case name
        case dayTag = "day_tag"
        case exercises
    }
}

struct PlanExercise: Decodable, Identifiable {
    var id: String { "\(name ?? "")-\(sets ?? 0)-\(reps ?? "")" }
    let name: String?
    let sets: Int?
    let reps: String?
    let restSeconds: Int?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case name, sets, reps, notes
        case restSeconds = "rest_seconds"
    }
}

struct CoachClient: Decodable, Identifiable {
    let id: String
    let email: String?
    let fullName: String?
    let onboardingCompletedAt: String?
    let sessionsRemaining: Int
    let lastCheckinDate: String?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case onboardingCompletedAt = "onboarding_completed_at"
        case sessionsRemaining = "sessions_remaining"
        case lastCheckinDate = "last_checkin_date"
    }
}
