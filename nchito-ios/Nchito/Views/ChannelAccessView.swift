import SwiftUI

/// Sets the PIN that authorises money movement over USSD and WhatsApp —
/// see INNOVATION.md §2.1.
///
/// On USSD the network asserts the phone number, which is a reasonable identity
/// claim, but a stolen handset would otherwise be a drained wallet. Mobile money
/// in this market always asks for a PIN before money moves and users expect it.
/// The PIN is only ever stored hashed, by `set_channel_pin()`.
struct ChannelAccessView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var pin = ""
    @State private var confirmation = ""
    @State private var error: String?
    @State private var saved = false

    /// The handful of PINs guessed first, refused server-side too.
    private static let tooCommon: Set<String> = [
        "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777",
        "8888", "9999", "1234", "4321", "1212", "0123",
    ]

    private var validationError: String? {
        guard pin.count == 4 else { return nil }
        if Self.tooCommon.contains(pin) { return "That PIN is too easy to guess. Choose another." }
        if confirmation.count == 4 && confirmation != pin { return "The two PINs don't match." }
        return nil
    }

    private var canSave: Bool {
        pin.count == 4 && confirmation == pin && validationError == nil
    }

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Use Nchito without the app", systemImage: "phone.fill")
                        .font(.subheadline.weight(.semibold))
                    Text("Dial **\(AppState.ussdShortcode)** on any phone — even without data — to find gigs, apply, check your balance and cash out. You can also message Nchito on WhatsApp.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("Your 4-digit PIN") {
                SecureField("Enter a new PIN", text: $pin)
                    .keyboardType(.numberPad)
                    .onChange(of: pin) { _, new in pin = String(new.filter(\.isNumber).prefix(4)) }

                SecureField("Enter it again", text: $confirmation)
                    .keyboardType(.numberPad)
                    .onChange(of: confirmation) { _, new in
                        confirmation = String(new.filter(\.isNumber).prefix(4))
                    }

                if let message = validationError ?? error {
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.red)
                }
            } footer: {
                Text("You'll be asked for this PIN before any money leaves your wallet over USSD or WhatsApp. Never share it — Nchito will never ask you for it.")
            }

            Section {
                Button(state.hasChannelPIN ? "Update PIN" : "Set PIN") {
                    if state.setChannelPIN(pin) {
                        saved = true
                    } else {
                        error = "That PIN is too easy to guess. Choose another."
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canSave)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
        }
        .navigationTitle("Phone & USSD access")
        .navigationBarTitleDisplayMode(.inline)
        .alert("PIN set", isPresented: $saved) {
            Button("Done") { dismiss() }
        } message: {
            Text("You can now cash out by dialling \(AppState.ussdShortcode) from \(state.user.phone), with no data needed.")
        }
    }
}

#Preview {
    NavigationStack {
        ChannelAccessView().environmentObject(AppState())
    }
}
