import SwiftUI

struct PhoneAuthView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var phone = ""
    @State private var code = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("Nchito").font(.system(size: 44, weight: .bold))
                    .foregroundStyle(Theme.green)
                Text("Sign in with your phone — no passwords, no email.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            switch auth.step {
            case .enterPhone:
                phoneEntry
            case .enterCode(let sentTo):
                codeEntry(sentTo: sentTo)
            }

            if let error = auth.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Theme.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            if auth.isDemoMode {
                Label("Demo mode — any number works, code is \(AuthService.demoOTP)",
                      systemImage: "info.circle")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()
            Spacer()
        }
        .padding()
        .onAppear { focused = true }
    }

    private var phoneEntry: some View {
        VStack(spacing: 16) {
            HStack {
                Text("🇿🇲 +260")
                    .font(.headline)
                    .padding(.vertical, 14)
                    .padding(.horizontal, 12)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                TextField("97 123 4567", text: $phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .focused($focused)
                    .font(.headline)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            }

            Button {
                Task { await auth.requestOTP(phone: phone) }
            } label: {
                if auth.isBusy {
                    ProgressView().tint(.white)
                } else {
                    Text("Send code")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(auth.isBusy || phone.filter(\.isNumber).count < 9)
        }
    }

    private func codeEntry(sentTo: String) -> some View {
        VStack(spacing: 16) {
            Text("Enter the 6-digit code sent to **\(sentTo)**")
                .font(.subheadline)
                .multilineTextAlignment(.center)

            TextField("••••••", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .padding(14)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                .onChange(of: code) { _, new in
                    code = String(new.filter(\.isNumber).prefix(6))
                    if code.count == 6 {
                        Task { await auth.verifyOTP(code: code) }
                    }
                }

            Button {
                Task { await auth.verifyOTP(code: code) }
            } label: {
                if auth.isBusy {
                    ProgressView().tint(.white)
                } else {
                    Text("Verify & sign in")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(auth.isBusy || code.count < 6)

            Button("Use a different number") {
                code = ""
                auth.step = .enterPhone
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    PhoneAuthView().environmentObject(AuthService())
}
