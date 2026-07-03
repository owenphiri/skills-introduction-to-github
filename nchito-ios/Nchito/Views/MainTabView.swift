import SwiftUI

struct MainTabView: View {
    @State private var showPostGig = false

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Gigs", systemImage: "briefcase.fill") }

            TasksView()
                .tabItem { Label("Quick Tasks", systemImage: "bolt.fill") }

            PostGigLauncher(showPostGig: $showPostGig)
                .tabItem { Label("Post", systemImage: "plus.circle.fill") }

            WalletView()
                .tabItem { Label("Wallet", systemImage: "banknote.fill") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
        }
        .sheet(isPresented: $showPostGig) { PostGigView() }
    }
}

/// Dedicated tab that immediately opens the post-gig sheet —
/// keeps "hire someone" one tap away for the demand side.
private struct PostGigLauncher: View {
    @Binding var showPostGig: Bool

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(Theme.copper)
            Text("Need something done?")
                .font(.title2.bold())
            Text("Post a gig and get applicants from trusted, rated workers near you within minutes.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Post a gig") { showPostGig = true }
                .buttonStyle(PrimaryButtonStyle(color: Theme.copper))
                .padding(.horizontal, 48)
        }
        .onAppear { showPostGig = true }
    }
}

#Preview {
    MainTabView().environmentObject(AppState())
}
