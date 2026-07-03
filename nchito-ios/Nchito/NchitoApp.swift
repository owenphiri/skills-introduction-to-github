import SwiftUI

@main
struct NchitoApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            if state.hasOnboarded {
                MainTabView()
                    .environmentObject(state)
                    .tint(Theme.green)
            } else {
                OnboardingView()
                    .environmentObject(state)
                    .tint(Theme.green)
            }
        }
    }
}
