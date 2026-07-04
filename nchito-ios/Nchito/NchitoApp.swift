import SwiftUI

@main
struct NchitoApp: App {
    @StateObject private var state = AppState()
    @StateObject private var auth = AuthService()

    var body: some Scene {
        WindowGroup {
            Group {
                if !state.hasOnboarded {
                    OnboardingView()
                } else if !auth.isSignedIn {
                    PhoneAuthView()
                } else {
                    MainTabView()
                }
            }
            .environmentObject(state)
            .environmentObject(auth)
            .tint(Theme.green)
        }
    }
}
