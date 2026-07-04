import Foundation

/// Fill these in from your Supabase project (Settings → API) to go live.
/// Left empty, the app runs in demo mode: any phone number signs in with OTP 123456.
enum SupabaseConfig {
    static let projectURL = ""   // e.g. "https://abcdefgh.supabase.co"
    static let anonKey = ""      // the anon/public key (safe to ship in the app)

    static var isConfigured: Bool {
        !projectURL.isEmpty && !anonKey.isEmpty
    }
}
