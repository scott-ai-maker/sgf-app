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
    let waistCm: Double?
    let hipCm: Double?
    let neckCm: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case weekStart = "week_start"
        case sleepQuality = "sleep_quality"
        case stressLevel = "stress_level"
        case sorenessLevel = "soreness_level"
        case energyLevel = "energy_level"
        case weightKg = "weight_kg"
        case waistCm = "waist_cm"
        case hipCm = "hip_cm"
        case neckCm = "neck_cm"
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
    let workouts: [ProgramWorkout]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        workouts = (try? c.decode([ProgramWorkout].self, forKey: .workouts)) ?? []
    }

    enum CodingKeys: String, CodingKey { case workouts }
}

struct ProgramWorkout: Decodable, Identifiable {
    var id: String { "\(day)" }
    let day: Int
    let focus: String
    let scheduledDate: String?
    let notes: String?
    let exercises: [ProgramExercise]
}

struct ProgramExercise: Decodable, Identifiable {
    var id: String { "\(name)-\(sets)-\(reps)" }
    let name: String
    let sets: String
    let reps: String
    let rest: String?
    let tempo: String?
    let notes: String?
    let exerciseDescription: String?
    let coachingCues: [String]
    let imageUrl: String?
    let videoUrl: String?
    let openExternallyOnly: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name)) ?? "Exercise"
        sets = (try? c.decode(String.self, forKey: .sets)) ?? "3"
        reps = (try? c.decode(String.self, forKey: .reps)) ?? "10"
        rest = try? c.decodeIfPresent(String.self, forKey: .rest)
        tempo = try? c.decodeIfPresent(String.self, forKey: .tempo)
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
        exerciseDescription = try? c.decodeIfPresent(String.self, forKey: .exerciseDescription)
        coachingCues = (try? c.decode([String].self, forKey: .coachingCues)) ?? []
        imageUrl = try? c.decodeIfPresent(String.self, forKey: .imageUrl)
        videoUrl = try? c.decodeIfPresent(String.self, forKey: .videoUrl)
        openExternallyOnly = (try? c.decode(Bool.self, forKey: .openExternallyOnly)) ?? false
    }

    enum CodingKeys: String, CodingKey {
        case name, sets, reps, rest, tempo, notes, coachingCues, imageUrl, videoUrl, openExternallyOnly
        case exerciseDescription = "description"
    }
}

struct WorkoutVideoEventRequest: Encodable {
    let workoutPlanId: String?
    let exerciseName: String
    let videoUrl: String
    let eventType: String
    let watchSeconds: Int?
    let metadata: [String: String]?
}

// MARK: - Workout Logging

struct WorkoutLogsResponse: Decodable {
    let logs: [WorkoutLog]
}

struct WorkoutLogResponse: Decodable {
    let log: WorkoutLog
}

struct WorkoutLog: Decodable, Identifiable {
    let id: String
    let workoutPlanId: String?
    let sessionDate: String
    let sessionTitle: String
    let completed: Bool
    let exertionRpe: Int?
    let notes: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case workoutPlanId = "workout_plan_id"
        case sessionDate = "session_date"
        case sessionTitle = "session_title"
        case completed
        case exertionRpe = "exertion_rpe"
        case notes
        case createdAt = "created_at"
    }
}

struct WorkoutLogRequest: Encodable {
    let workoutPlanId: String?
    let sessionDate: String
    let sessionTitle: String
    let completed: Bool
    let exertionRpe: Int?
    let notes: String?
}

struct SetLogsResponse: Decodable {
    let setLogs: [SetLog]
}

struct SetLogResponse: Decodable {
    let setLog: SetLog
}

struct SetLog: Decodable, Identifiable {
    let id: String
    let workoutPlanId: String?
    let sessionDate: String
    let exerciseName: String
    let setNumber: Int?
    let reps: Int
    let weightKg: Double?
    let rpe: Double?
    let notes: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case workoutPlanId = "workout_plan_id"
        case sessionDate = "session_date"
        case exerciseName = "exercise_name"
        case setNumber = "set_number"
        case reps
        case weightKg = "weight_kg"
        case rpe
        case notes
        case createdAt = "created_at"
    }
}

struct SetLogRequest: Encodable {
    let workoutPlanId: String
    let sessionDate: String
    let exerciseName: String
    let setNumber: Int
    let reps: Int
    let weightKg: Double?
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

// MARK: - Progress Summary

struct WeightDataPoint: Decodable, Identifiable {
    var id: String { weekStart }
    let weekStart: String
    let weightKg: Double

    enum CodingKeys: String, CodingKey {
        case weekStart = "weekStart"
        case weightKg = "weightKg"
    }
}

struct MeasurementDataPoint: Decodable, Identifiable {
    var id: String { weekStart }
    let weekStart: String
    let waistCm: Double?
    let hipCm: Double?
    let neckCm: Double?

    enum CodingKeys: String, CodingKey {
        case weekStart = "weekStart"
        case waistCm = "waistCm"
        case hipCm = "hipCm"
        case neckCm = "neckCm"
    }
}

struct WellnessDataPoint: Decodable, Identifiable {
    var id: String { weekStart }
    let weekStart: String
    let sleepQuality: Int?
    let energyLevel: Int?
    let stressLevel: Int?
    let sorenessLevel: Int?

    enum CodingKeys: String, CodingKey {
        case weekStart = "weekStart"
        case sleepQuality = "sleepQuality"
        case energyLevel = "energyLevel"
        case stressLevel = "stressLevel"
        case sorenessLevel = "sorenessLevel"
    }
}

struct PersonalRecord: Decodable, Identifiable {
    var id: String { exerciseName }
    let exerciseName: String
    let weightKg: Double
    let reps: Int?
    let achievedAt: String

    enum CodingKeys: String, CodingKey {
        case exerciseName = "exerciseName"
        case weightKg = "weightKg"
        case reps = "reps"
        case achievedAt = "achievedAt"
    }
}

struct StrengthTrendPoint: Decodable, Identifiable {
    var id: String { sessionDate }
    let sessionDate: String
    let bestWeightKg: Double
    let bestReps: Int?

    enum CodingKeys: String, CodingKey {
        case sessionDate = "sessionDate"
        case bestWeightKg = "bestWeightKg"
        case bestReps = "bestReps"
    }
}

struct StrengthTrendSeries: Decodable, Identifiable {
    var id: String { exerciseName }
    let exerciseName: String
    let points: [StrengthTrendPoint]

    enum CodingKeys: String, CodingKey {
        case exerciseName = "exerciseName"
        case points = "points"
    }
}

struct ProgressSummaryResponse: Decodable {
    let weightTrend: [WeightDataPoint]
    let measurementTrend: [MeasurementDataPoint]
    let wellnessTrend: [WellnessDataPoint]
    let strengthTrend: [StrengthTrendSeries]
    let personalRecords: [PersonalRecord]
}
