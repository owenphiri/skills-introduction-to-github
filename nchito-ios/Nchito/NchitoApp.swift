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
                        .task(id: auth.accessToken) {
                            // Runs on sign-in and again if the token is renewed.
                            // Without a token PostgREST falls back to the anon
                            // role and RLS quietly returns nothing.
                            if let userID = auth.userID {
                                await state.connect(accessToken: auth.accessToken, userID: userID)
                            }
                        }
                }
            }
            .environmentObject(state)
            .environmentObject(auth)
            .tint(Theme.green)
        }
    }
}
