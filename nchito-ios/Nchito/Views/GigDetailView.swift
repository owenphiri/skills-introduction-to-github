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

                loyaltyCard

                if hasApplied {
                    ProofOfWorkCard(gig: gig)
                    WageAdvanceCard(gig: gig)
                }

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

    /// Loyalty-decaying commission (INNOVATION.md §1.1). Showing the rate and
    /// what the next tier is worth is the whole point: it makes staying with
    /// this poster on Nchito visibly cheaper than settling in cash.
    private var loyaltyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(gig.commissionTier.label, systemImage: gig.commissionTier.badge)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.green)
                Spacer()
                Text("\(gig.commissionTier.ratePercent) fee")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.green)
            }

            if gig.completedWithPoster > 0 {
                Text("You've completed \(gig.completedWithPoster) gig\(gig.completedWithPoster == 1 ? "" : "s") with \(gig.posterName).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let remaining = gig.commissionTier.gigsToNextTier(completedTogether: gig.completedWithPoster),
               let next = gig.commissionTier.next,
               let nextPayout = gig.payoutAtNextTier {
                ProgressView(value: Double(gig.completedWithPoster),
                             total: Double(gig.completedWithPoster + remaining))
                    .tint(Theme.copper)
                Text("\(remaining) more gig\(remaining == 1 ? "" : "s") with this poster drops your fee to \(next.ratePercent) — you'd keep \(nextPayout.kwacha) on a gig this size.")
                    .font(.caption)
                    .foregroundStyle(Theme.copper)
            } else {
                Text("You're on our lowest fee with this poster. Keep working together on Nchito to stay protected by escrow.")
                    .font(.caption)
                    .foregroundStyle(Theme.copper)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }

    private var escrowNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.shield.fill")
                .font(.title2)
                .foregroundStyle(Theme.green)
            VStack(alignment: .leading, spacing: 4) {
                Text("Escrow protected").font(.subheadline.weight(.semibold))
                Text("The poster's payment of \(gig.payZMW.kwacha) is held by Nchito and released once they confirm the job is done and both proof photos are attached. Your \(gig.commissionTier.ratePercent) service fee is \(gig.commissionAmount.kwacha).")
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
