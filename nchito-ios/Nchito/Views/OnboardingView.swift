import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var state: AppState
    @State private var page = 0

    private let pages: [(icon: String, title: String, body: String)] = [
        ("briefcase.fill", "Find work near you",
         "Deliveries, tutoring, repairs, design gigs and more — posted by real people in Lusaka, Kitwe, Ndola and beyond."),
        ("bolt.fill", "Earn in your spare time",
         "Short surveys, app testing and data tasks pay K10–K70 each. Turn dead time into airtime, data and groceries."),
        ("banknote.fill", "Get paid instantly",
         "Your earnings land in your Nchito wallet and cash out to MTN MoMo, Airtel Money or Zamtel Kwacha in seconds."),
        ("shield.checkerboard", "Safe for both sides",
         "Payments are held in escrow until the job is confirmed done. NRC-verified profiles and ratings keep everyone honest."),
    ]

    var body: some View {
        VStack {
            HStack {
                Text("Nchito")
                    .font(.largeTitle.bold())
                    .foregroundStyle(Theme.green)
                Text("🇿🇲").font(.largeTitle)
                Spacer()
                if page < pages.count - 1 {
                    Button("Skip") { state.hasOnboarded = true }
                        .foregroundStyle(.secondary)
                }
            }
            .padding()

            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { i, p in
                    VStack(spacing: 24) {
                        Image(systemName: p.icon)
                            .font(.system(size: 72))
                            .foregroundStyle(Theme.copper)
                        Text(p.title)
                            .font(.title.bold())
                            .multilineTextAlignment(.center)
                        Text(p.body)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .tag(i)
                }
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(page == pages.count - 1 ? "Start earning" : "Next") {
                if page == pages.count - 1 {
                    state.hasOnboarded = true
                } else {
                    withAnimation { page += 1 }
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .padding()
        }
    }
}

#Preview {
    OnboardingView().environmentObject(AppState())
}
