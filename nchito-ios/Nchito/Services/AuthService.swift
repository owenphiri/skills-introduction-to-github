import SwiftUI

/// Phone-OTP authentication against Supabase GoTrue, implemented with plain
/// URLSession so the app keeps zero third-party dependencies. When
/// `SupabaseConfig` is empty the service falls back to demo mode
/// (any +260 number, OTP 123456) so the app is always demoable.
@MainActor
final class AuthService: ObservableObject {

    enum Step: Equatable {
        case enterPhone
        case enterCode(phone: String)
    }

    // Persisted manually: @AppStorage doesn't publish from an ObservableObject.
    @Published private(set) var signedInPhone: String {
        didSet { UserDefaults.standard.set(signedInPhone, forKey: "signedInPhone") }
    }
    @Published private(set) var accessToken: String {
        didSet { UserDefaults.standard.set(accessToken, forKey: "accessToken") }
    }
    @Published var step: Step = .enterPhone
    @Published var isBusy = false
    @Published var errorMessage: String?

    init() {
        signedInPhone = UserDefaults.standard.string(forKey: "signedInPhone") ?? ""
        accessToken = UserDefaults.standard.string(forKey: "accessToken") ?? ""
    }

    static let demoOTP = "123456"

    var isSignedIn: Bool { !signedInPhone.isEmpty }
    var isDemoMode: Bool { !SupabaseConfig.isConfigured }

    // MARK: - Public API

    func requestOTP(phone: String) async {
        errorMessage = nil
        let normalized = Self.normalize(phone: phone)
        guard Self.isValidZambianPhone(normalized) else {
            errorMessage = "Enter a valid Zambian number, e.g. 097 123 4567."
            return
        }
        guard !isDemoMode else {
            step = .enterCode(phone: normalized)
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            try await post(path: "/auth/v1/otp", body: ["phone": normalized])
            step = .enterCode(phone: normalized)
        } catch {
            errorMessage = "Couldn't send the code. Check your connection and try again."
        }
    }

    func verifyOTP(code: String) async {
        guard case .enterCode(let phone) = step else { return }
        errorMessage = nil

        if isDemoMode {
            if code == Self.demoOTP {
                signedInPhone = phone
            } else {
                errorMessage = "Wrong code. In demo mode the code is \(Self.demoOTP)."
            }
            return
        }

        isBusy = true
        defer { isBusy = false }
        do {
            let data = try await post(path: "/auth/v1/verify",
                                      body: ["phone": phone, "token": code, "type": "sms"])
            struct Session: Decodable { let access_token: String }
            let session = try JSONDecoder().decode(Session.self, from: data)
            accessToken = session.access_token
            signedInPhone = phone
        } catch {
            errorMessage = "That code didn't work. Request a new one and try again."
        }
    }

    func signOut() {
        signedInPhone = ""
        accessToken = ""
        step = .enterPhone
    }

    // MARK: - Helpers

    /// Accepts local formats (097..., 77...) and normalizes to E.164 (+260...).
    static func normalize(phone raw: String) -> String {
        var digits = raw.filter(\.isNumber)
        if digits.hasPrefix("260") { digits = String(digits.dropFirst(3)) }
        if digits.hasPrefix("0") { digits = String(digits.dropFirst()) }
        return "+260" + digits
    }

    static func isValidZambianPhone(_ e164: String) -> Bool {
        // +260 followed by a 9-digit mobile number (MTN 96/76, Airtel 97/77, Zamtel 95/75).
        let digits = e164.dropFirst(4)
        return e164.hasPrefix("+260") && digits.count == 9
            && ["95", "96", "97", "75", "76", "77"].contains(String(digits.prefix(2)))
    }

    @discardableResult
    private func post(path: String, body: [String: String]) async throws -> Data {
        guard let url = URL(string: SupabaseConfig.projectURL + path) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }
}
