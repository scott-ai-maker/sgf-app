import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private let navy = Color(red: 13.0/255, green: 27.0/255, blue: 42.0/255)
    private let gold = Color(red: 212.0/255, green: 160.0/255, blue: 23.0/255)
    private let ivory = Color(red: 245.0/255, green: 240.0/255, blue: 232.0/255)

    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false

    var body: some View {
        ZStack {
            navy.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Logo
                    Image("BrandLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 110, height: 110)
                        .shadow(color: gold.opacity(0.4), radius: 16, x: 0, y: 6)
                        .padding(.top, 60)
                        .padding(.bottom, 16)

                    Text("Scott Gordon Fitness")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(ivory)

                    Text("Personal Coaching")
                        .font(.subheadline)
                        .foregroundStyle(gold)
                        .padding(.bottom, 40)

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .padding()
                            .background(Color.white.opacity(0.08))
                            .foregroundStyle(ivory)
                            .tint(gold)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.15), lineWidth: 1))

                        SecureField("Password", text: $password)
                            .padding()
                            .background(Color.white.opacity(0.08))
                            .foregroundStyle(ivory)
                            .tint(gold)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.15), lineWidth: 1))
                    }

                    if let error = sessionStore.lastError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 8)
                    }

                    Button {
                        isSubmitting = true
                        Task {
                            await sessionStore.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                            isSubmitting = false
                        }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                                .tint(navy)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 4)
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 4)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(gold)
                    .foregroundStyle(navy)
                    .disabled(email.isEmpty || password.isEmpty || isSubmitting)
                    .padding(.top, 24)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(SessionStore())
}
