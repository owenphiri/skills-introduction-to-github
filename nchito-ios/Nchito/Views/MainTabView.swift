import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Gigs", systemImage: "briefcase.fill") }

            TasksView()
                .tabItem { Label("Quick Tasks", systemImage: "bolt.fill") }

            ChatListView()
                .tabItem { Label("Chats", systemImage: "bubble.left.and.bubble.right.fill") }

            WalletView()
                .tabItem { Label("Wallet", systemImage: "banknote.fill") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AppState())
        .environmentObject(AuthService())
}
