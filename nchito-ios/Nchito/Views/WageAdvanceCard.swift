import SwiftUI

/// Earned wage access on a gig in progress — see INNOVATION.md §3.2.
///
/// Appears on gigs the worker has taken. When they aren't eligible it says why,
/// in a sentence: a greyed-out button with no explanation is how someone
/// concludes the feature is broken and stops looking for it.
struct WageAdvanceCard: View {
    @EnvironmentObject private var state: AppState
    let gig: Gig
    @State private var showRequest = false

    private var offer: AdvanceOffer { state.advanceOffer(for: gig) }
    private var existing: WageAdvance? {
        state.advances.first { $0.gigID == gig.id }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Get paid before the job ends", systemImage: "bolt.badge.clock.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer()
            }

            if let advance = existing {
                takenState(advance)
            } else if offer.isEligible {
                availableState
            } else {
                Text(offer.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.copper.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showRequest) {
            WageAdvanceSheet(gig: gig, offer: offer)
                .presentationDetents([.medium])
        }
    }

    private var availableState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("You've started this job, so you can take up to **\(offer.maxAmount.kwacha)** of your \(gig.workerPayout.kwacha) payout right now. The rest arrives when the poster confirms the work.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button("Take early payment") { showRequest = true }
                .buttonStyle(PrimaryButtonStyle(color: Theme.copper))
        }
    }

    private func takenState(_ advance: WageAdvance) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(advance.amountZMW.kwacha) paid early")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.copper)
                Spacer()
                Text(advance.status.label)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Text("\(advance.totalDueZMW.kwacha) (including the \(advance.feeZMW.kwacha) fee) comes off this gig's payout. You'll receive \((gig.workerPayout - advance.totalDueZMW).kwacha) when it settles.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// Confirmation sheet. Every number the worker will experience is on one
/// screen before they commit — what arrives now, what the fee is, and what is
/// left at the end — because a surprise at settlement is how trust in early
/// payment dies.
struct WageAdvanceSheet: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.dismiss) private var dismiss
    let gig: Gig
    let offer: AdvanceOffer

    @State private var amount: Double = 0
    @State private var failed = false

    private var fee: Double { AdvanceTerms.fee(on: amount) }
    private var dueBack: Double { amount + fee }
    private var remainder: Double { gig.workerPayout - dueBack }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                VStack(spacing: 4) {
                    Text(amount.kwacha)
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.copper)
                    Text("paid to your wallet now")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Slider(value: $amount,
                       in: AdvanceTerms.minimumAdvance...max(offer.maxAmount, AdvanceTerms.minimumAdvance),
                       step: 10)
                    .tint(Theme.copper)
                    .padding(.horizontal)

                VStack(spacing: 8) {
                    row("Gig payout", gig.workerPayout.kwacha)
                    row("Paid now", amount.kwacha, emphasis: true)
                    row("Service fee", fee.kwacha)
                    Divider()
                    row("Comes off at settlement", dueBack.kwacha)
                    row("You receive at the end", remainder.kwacha, emphasis: true)
                }
                .padding()
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))

                Text("A one-off fee, not interest — it doesn't grow if the job takes longer. Nchito already holds this money in escrow; this just releases part of it early.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button("Confirm — pay me \(amount.kwacha) now") {
                    if state.takeAdvance(on: gig, amount: amount) {
                        dismiss()
                    } else {
                        failed = true
                    }
                }
                .buttonStyle(PrimaryButtonStyle(color: Theme.copper))
                .disabled(amount < AdvanceTerms.minimumAdvance)

                Spacer()
            }
            .padding()
            .navigationTitle("Early payment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear {
                // Open at half the cap rather than the maximum, so the default
                // isn't the largest debt the worker could take on.
                amount = max(AdvanceTerms.minimumAdvance,
                             (offer.maxAmount / 2 / 10).rounded() * 10)
            }
            .alert("Couldn't take the advance", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(state.advanceOffer(for: gig).reason)
            }
        }
    }

    private func row(_ label: String, _ value: String, emphasis: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(emphasis ? .subheadline.weight(.semibold) : .subheadline)
            Spacer()
            Text(value)
                .font(emphasis ? .subheadline.weight(.bold) : .subheadline)
                .foregroundStyle(emphasis ? Theme.copper : Theme.ink)
        }
    }
}

#Preview {
    WageAdvanceCard(gig: MockDataService.gigs[1])
        .environmentObject(AppState())
        .padding()
}
