import SwiftUI

// MARK: - Payload types

private struct ParqAnswers: Encodable {
    var q1: Bool = false
    var q2: Bool = false
    var q3: Bool = false
    var q4: Bool = false
    var q5: Bool = false
    var q6: Bool = false
    var q7: Bool = false
}

private struct IntakePayload: Encodable {
    let parqAnswers: ParqAnswers
    let liabilityWaiver: Bool
    let informedConsent: Bool
    let privacyPractices: Bool
    let coachingAgreement: Bool
    let emergencyCare: Bool
    let signatureName: String
    let emergencyContactName: String
    let emergencyContactPhone: String
    let medicalConditions: String?
    let medications: String?
}

private struct OnboardingPayload: Encodable {
    let intake: IntakePayload
    let preferredUnits: String
    let fitnessGoal: String?
    let experienceLevel: String?
    let trainingDaysPerWeek: Int
    let preferredTrainingDays: [String]
    let activityLevel: String?
    let age: Int?
    let sex: String?
    let heightCm: Double?
    let weightKg: Double?
    let workoutLocation: String?
    let injuriesLimitations: String?
    let equipmentAccess: [String]
}

// MARK: - View

struct OnboardingView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    var onComplete: () -> Void

    // Step
    @State private var step = 0

    // Personal
    @State private var age = ""
    @State private var sex = "prefer_not_to_say"
    @State private var heightCm = ""
    @State private var weightKg = ""
    @State private var preferredUnits = "imperial"

    // Goals
    @State private var fitnessGoal = "general_fitness"
    @State private var experienceLevel = "beginner"
    @State private var activityLevel = "moderately_active"
    @State private var workoutLocation = "gym"
    @State private var trainingDaysPerWeek = 3
    @State private var preferredTrainingDays: Set<String> = []
    @State private var injuriesLimitations = ""

    // PAR-Q
    @State private var parq = ParqAnswers()

    // Health
    @State private var medicalConditions = ""
    @State private var medications = ""

    // Consent
    @State private var liabilityWaiver = false
    @State private var informedConsent = false
    @State private var privacyPractices = false
    @State private var coachingAgreement = false
    @State private var emergencyCare = false
    @State private var signatureName = ""
    @State private var emergencyContactName = ""
    @State private var emergencyContactPhone = ""

    @State private var saving = false
    @State private var error: String?

    private let totalSteps = 5

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ProgressView(value: Double(step + 1), total: Double(totalSteps))
                    .padding(.horizontal)
                    .padding(.top, 8)

                TabView(selection: $step) {
                    personalStep.tag(0)
                    goalsStep.tag(1)
                    parqStep.tag(2)
                    healthStep.tag(3)
                    consentStep.tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: step)
            }
            .navigationTitle(stepTitle)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Step titles

    private var stepTitle: String {
        switch step {
        case 0: return "About You"
        case 1: return "Your Goals"
        case 2: return "Health Screening"
        case 3: return "Medical History"
        case 4: return "Agreements"
        default: return ""
        }
    }

    // MARK: - Step 0: Personal

    private var personalStep: some View {
        Form {
            Section("Units") {
                Picker("Preferred Units", selection: $preferredUnits) {
                    Text("Imperial (lbs, ft)").tag("imperial")
                    Text("Metric (kg, cm)").tag("metric")
                }
            }

            Section("Demographics") {
                Picker("Sex", selection: $sex) {
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                    Text("Prefer not to say").tag("prefer_not_to_say")
                }
                TextField("Age", text: $age)
                    .keyboardType(.numberPad)
                TextField(preferredUnits == "imperial" ? "Height (cm)" : "Height (cm)", text: $heightCm)
                    .keyboardType(.decimalPad)
                TextField("Weight (kg)", text: $weightKg)
                    .keyboardType(.decimalPad)
            }

            nextButton(enabled: true)
        }
    }

    // MARK: - Step 1: Goals

    private var goalsStep: some View {
        Form {
            Section("Primary Goal") {
                Picker("Goal", selection: $fitnessGoal) {
                    Text("General Fitness").tag("general_fitness")
                    Text("Weight Loss").tag("weight_loss")
                    Text("Muscle Gain").tag("muscle_gain")
                    Text("Strength").tag("strength")
                    Text("Endurance").tag("endurance")
                    Text("Athletic Performance").tag("athletic_performance")
                }
            }

            Section("Experience") {
                Picker("Experience Level", selection: $experienceLevel) {
                    Text("Beginner (< 1 year)").tag("beginner")
                    Text("Intermediate (1–3 years)").tag("intermediate")
                    Text("Advanced (3+ years)").tag("advanced")
                }
            }

            Section("Activity Level") {
                Picker("Current Activity", selection: $activityLevel) {
                    Text("Sedentary").tag("sedentary")
                    Text("Lightly Active").tag("lightly_active")
                    Text("Moderately Active").tag("moderately_active")
                    Text("Very Active").tag("very_active")
                }
            }

            Section("Training Location") {
                Picker("Location", selection: $workoutLocation) {
                    Text("Gym").tag("gym")
                    Text("Home").tag("home")
                    Text("Outdoors").tag("outdoors")
                    Text("Mixed").tag("mixed")
                }
            }

            trainingDaysSection

            Section("Injuries / Limitations") {
                TextField("Any injuries or movement limitations?", text: $injuriesLimitations, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
            }

            nextButton(enabled: preferredTrainingDays.count == trainingDaysPerWeek)
        }
    }

    @ViewBuilder
    private var trainingDaysSection: some View {
        Section("Training Schedule") {
            Stepper("Days per week: \(trainingDaysPerWeek)", value: $trainingDaysPerWeek, in: 2...7)
                .onChange(of: trainingDaysPerWeek) { _, _ in
                    preferredTrainingDays = []
                }

            Text("Select \(trainingDaysPerWeek) preferred day\(trainingDaysPerWeek == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)

            dayRow("monday")
            dayRow("tuesday")
            dayRow("wednesday")
            dayRow("thursday")
            dayRow("friday")
            dayRow("saturday")
            dayRow("sunday")
        }
    }

    @ViewBuilder
    private func dayRow(_ day: String) -> some View {
        Button {
            if preferredTrainingDays.contains(day) {
                preferredTrainingDays.remove(day)
            } else if preferredTrainingDays.count < trainingDaysPerWeek {
                preferredTrainingDays.insert(day)
            }
        } label: {
            HStack {
                Text(day.capitalized)
                Spacer()
                if preferredTrainingDays.contains(day) {
                    Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Step 2: PAR-Q

    private var parqStep: some View {
        Form {
            Section {
                Text("Answer honestly — 'Yes' to any question doesn't prevent you from training but helps your coach program safely for you.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Q1") {
                Text("Has a doctor ever said you have a heart condition and recommended only medically supervised physical activity?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q1)
            }
            Section("Q2") {
                Text("Do you feel pain in your chest when you do physical activity?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q2)
            }
            Section("Q3") {
                Text("In the past month, have you had chest pain when you were not doing physical activity?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q3)
            }
            Section("Q4") {
                Text("Do you lose your balance because of dizziness, or do you ever lose consciousness?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q4)
            }
            Section("Q5") {
                Text("Do you have a bone or joint problem that could be made worse by physical activity?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q5)
            }
            Section("Q6") {
                Text("Is a doctor currently prescribing medication for your blood pressure or heart condition?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q6)
            }
            Section("Q7") {
                Text("Do you know of any other reason why you should not participate in physical activity?")
                    .font(.subheadline)
                Toggle("Yes", isOn: $parq.q7)
            }

            nextButton(enabled: true)
        }
    }

    // MARK: - Step 3: Medical

    private var healthStep: some View {
        Form {
            Section("Medical Conditions") {
                TextField("Any diagnosed conditions? (leave blank if none)", text: $medicalConditions, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
            }

            Section("Medications") {
                TextField("Current medications? (leave blank if none)", text: $medications, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
            }

            Section("Emergency Contact") {
                TextField("Name", text: $emergencyContactName)
                TextField("Phone", text: $emergencyContactPhone)
                    .keyboardType(.phonePad)
            }

            nextButton(enabled: !emergencyContactName.trimmingCharacters(in: .whitespaces).isEmpty &&
                       !emergencyContactPhone.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    // MARK: - Step 4: Consent

    private var consentStep: some View {
        Form {
            Section("Legal Agreements") {
                Toggle("Liability Waiver", isOn: $liabilityWaiver)
                Toggle("Informed Consent", isOn: $informedConsent)
                Toggle("Privacy Practices", isOn: $privacyPractices)
                Toggle("Coaching Agreement", isOn: $coachingAgreement)
                Toggle("Emergency Care Authorization", isOn: $emergencyCare)
            }

            Section("Electronic Signature") {
                TextField("Full legal name", text: $signatureName)
                Text("By typing your name above, you agree to all documents checked above.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let error {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    if saving {
                        ProgressView()
                    } else {
                        Text("Submit & Continue")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!allConsentsGiven || signatureName.trimmingCharacters(in: .whitespaces).count < 2 || saving)
            }
        }
    }

    private var allConsentsGiven: Bool {
        liabilityWaiver && informedConsent && privacyPractices && coachingAgreement && emergencyCare
    }

    // MARK: - Navigation

    private func nextButton(enabled: Bool) -> some View {
        Section {
            Button("Continue") {
                withAnimation { step += 1 }
            }
            .frame(maxWidth: .infinity)
            .buttonStyle(.borderedProminent)
            .disabled(!enabled)
        }
    }

    // MARK: - Submit

    private func submit() async {
        guard let token = sessionStore.accessToken else { return }

        saving = true
        error = nil

        let intake = IntakePayload(
            parqAnswers: parq,
            liabilityWaiver: liabilityWaiver,
            informedConsent: informedConsent,
            privacyPractices: privacyPractices,
            coachingAgreement: coachingAgreement,
            emergencyCare: emergencyCare,
            signatureName: signatureName.trimmingCharacters(in: .whitespaces),
            emergencyContactName: emergencyContactName.trimmingCharacters(in: .whitespaces),
            emergencyContactPhone: emergencyContactPhone.trimmingCharacters(in: .whitespaces),
            medicalConditions: medicalConditions.isEmpty ? nil : medicalConditions,
            medications: medications.isEmpty ? nil : medications
        )

        let payload = OnboardingPayload(
            intake: intake,
            preferredUnits: preferredUnits,
            fitnessGoal: fitnessGoal,
            experienceLevel: experienceLevel,
            trainingDaysPerWeek: trainingDaysPerWeek,
            preferredTrainingDays: Array(preferredTrainingDays),
            activityLevel: activityLevel,
            age: Int(age),
            sex: sex,
            heightCm: Double(heightCm),
            weightKg: Double(weightKg),
            workoutLocation: workoutLocation,
            injuriesLimitations: injuriesLimitations.isEmpty ? nil : injuriesLimitations,
            equipmentAccess: workoutLocation == "home" ? ["bodyweight"] : ["barbell", "dumbbell", "cable_machine", "bench"]
        )

        do {
            try await APIClient(token: token).submitOnboarding(payload)
            onComplete()
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }

        saving = false
    }
}
