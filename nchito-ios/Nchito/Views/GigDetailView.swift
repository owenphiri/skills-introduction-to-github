import SwiftUI

struct GigDetailView: View {
    @EnvironmentObject private var state: AppState
    let gig: Gig
    @State private var showApplied = false

    private var hasApplied: Bool { state.appliedGigIDs.contains(gig.id) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    PillTag(text: gig.category.rawValue)
                    if gig.isUrgent { PillTag(text: "URGENT", color: Theme.red) }
                    Spacer()
                    Text(gig.status.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Text(gig.title).font(.title2.bold())

                HStack(spacing: 0) {
                    StatChip(value: gig.payZMW.kwacha, label: "Gig pay")
                    Divider().frame(height: 32)
                    StatChip(value: gig.workerPayout.kwacha, label: "You receive")
                    Divider().frame(height: 32)
                    StatChip(value: "\(gig.applicants)", label: "Applicants")
                }
                .padding(.vertical, 12)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))

                section("Details") {
                    Text(gig.details)
                }

                section("Location") {
                    Label("\(gig.city) — \(gig.area)", systemImage: "mappin.and.ellipse")
                }

                section("Posted by") {
                    HStack {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.title)
                            .foregroundStyle(.secondary)
                        VStack(alignment: .leading) {
                            Text(gig.posterName).font(.subheadline.weight(.semibold))
                            Label(String(format: "%.1f rating", gig.posterRating),
                                  systemImage: "star.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.copper)
                        }
                        Spacer()
                        NavigationLink {
                            ChatThreadView(conversation: state.conversation(about: gig))
                        } label: {
                            Label("Message", systemImage: "bubble.left.fill")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Theme.green.opacity(0.12), in: Capsule())
                                .foregroundStyle(Theme.green)
                        }
                    }
                }

                escrowNotice
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Gig details")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button(hasApplied ? "Application sent ✓" : "Apply for this gig") {
                state.apply(to: gig)
                showApplied = true
            }
            .buttonStyle(PrimaryButtonStyle(color: hasApplied ? .gray : Theme.green))
            .disabled(hasApplied)
            .padding()
            .background(.thinMaterial)
        }
        .alert("Application sent!", isPresented: $showApplied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("\(gig.posterName) will review your profile and rating. You'll get a push notification if you're picked.")
        }
    }

    private var escrowNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.shield.fill")
                .font(.title2)
                .foregroundStyle(Theme.green)
            VStack(alignment: .leading, spacing: 4) {
                Text("Escrow protected").font(.subheadline.weight(.semibold))
                Text("The poster's payment of \(gig.payZMW.kwacha) is held by Nchito and released to your wallet the moment they confirm the job is done. A 10% service fee applies.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Theme.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            content()
        }
    }
}

#Preview {
    NavigationStack {
        GigDetailView(gig: MockDataService.gigs[0])
    }
    .environmentObject(AppState())
}
