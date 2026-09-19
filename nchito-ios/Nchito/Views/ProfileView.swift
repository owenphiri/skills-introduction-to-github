import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var state: AppState
    @EnvironmentObject private var auth: AuthService
    @State private var copiedReferral = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    profileHeader
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                Section {
                    NavigationLink {
                        WorkRecordView()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "doc.text.fill")
                                .font(.title3)
                                .frame(width: 38, height: 38)
                                .background(Theme.green.opacity(0.12),
                                            in: RoundedRectangle(cornerRadius: 10))
                                .foregroundStyle(Theme.green)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("My Work Record").font(.subheadline.weight(.semibold))
                                Text("\(state.workRecordSummary.totalGigs) verified jobs · export as a CV")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                } footer: {
                    Text("A work history employers and lenders can verify. Only jobs paid through Nchito count.")
                }

                Section("Trust & verification") {
                    HStack {
                        Label("Verification", systemImage: "checkmark.seal.fill")
                        Spacer()
                        PillTag(text: state.user.verification.rawValue,
                                color: state.user.verification == .nrcVerified ? Theme.green : Theme.copper)
                    }
                    if state.user.verification != .nrcVerified {
                        Label("Verify your NRC to unlock higher-paying gigs and zero cash-out fees",
                              systemImage: "arrow.up.circle")
                            .font(.caption)
                            .foregroundStyle(Theme.copper)
                    }
                }

                Section("Skills") {
                    FlowChips(items: state.user.skills)
                }

                Section("Invite friends, earn passively") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("You earn **K20** for every friend who joins with your code and finishes their first gig — plus **2%** of their task rewards for 3 months.")
                            .font(.caption)
                        HStack {
                            Text(state.user.referralCode)
                                .font(.title3.monospaced().bold())
                                .foregroundStyle(Theme.green)
                            Spacer()
                            Button {
                                UIPasteboard.general.string = state.user.referralCode
                                copiedReferral = true
                            } label: {
                                Label(copiedReferral ? "Copied" : "Copy", systemImage: "doc.on.doc")
                                    .font(.caption.weight(.semibold))
                            }
                            ShareLink(item: "Join me on Nchito 🇿🇲 — find gigs and quick tasks, get paid straight to mobile money. Use my code \(state.user.referralCode) and we both earn K20! ") {
                                Label("Share", systemImage: "square.and.arrow.up")
                                    .font(.caption.weight(.semibold))
                            }
                        }
                        Label("Referral earnings so far: \(state.user.referralEarningsZMW.kwacha)",
                              systemImage: "person.2.wave.2.fill")
                            .font(.caption)
                            .foregroundStyle(Theme.copper)
                    }
                }

                Section {
                    Label("Notifications", systemImage: "bell.badge.fill")
                    Label("Low-data mode", systemImage: "antenna.radiowaves.left.and.right")
                    Label("Help & safety", systemImage: "lifepreserver.fill")
                }

                Section {
                    Button(role: .destructive) {
                        auth.signOut()
                    } label: {
                        Label("Sign out (\(auth.signedInPhone))", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }

    private var profileHeader: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.green)
            Text(state.user.fullName).font(.title2.bold())
            Text("\(state.user.city) · Joined \(state.user.joinedDate.formatted(.dateTime.month(.wide).year()))")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 0) {
                StatChip(value: String(format: "%.1f ★", state.user.rating), label: "Rating")
                Divider().frame(height: 32)
                StatChip(value: "\(state.user.completedGigs)", label: "Gigs done")
                Divider().frame(height: 32)
                StatChip(value: state.walletBalance.kwacha, label: "Balance")
            }
            .padding(.vertical, 12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical)
    }
}

/// Simple wrapping chip layout for skills.
private struct FlowChips: View {
    let items: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 110))], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { skill in
                Text(skill)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(Theme.green.opacity(0.12), in: Capsule())
                    .foregroundStyle(Theme.green)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    ProfileView()
        .environmentObject(AppState())
        .environmentObject(AuthService())
}
