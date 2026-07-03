import SwiftUI

/// Central observable state for the MVP. Backed by mock data now;
/// swap `MockDataService` for the API client when the backend ships.
@MainActor
final class AppState: ObservableObject {

    @AppStorage("hasOnboarded") var hasOnboarded = false

    @Published var user: UserProfile = MockDataService.currentUser
    @Published var gigs: [Gig] = MockDataService.gigs
    @Published var microTasks: [MicroTask] = MockDataService.microTasks
    @Published var transactions: [WalletTransaction] = MockDataService.transactions
    @Published var appliedGigIDs: Set<UUID> = []
    @Published var payoutProvider: MobileMoneyProvider = .mtnMomo

    var walletBalance: Double {
        transactions.reduce(0) { $0 + $1.amountZMW }
    }

    // MARK: - Gigs

    func apply(to gig: Gig) {
        guard !appliedGigIDs.contains(gig.id) else { return }
        appliedGigIDs.insert(gig.id)
        if let i = gigs.firstIndex(where: { $0.id == gig.id }) {
            gigs[i].applicants += 1
        }
    }

    func post(gig: Gig) {
        gigs.insert(gig, at: 0)
    }

    // MARK: - Micro-tasks

    func complete(task: MicroTask) {
        guard let i = microTasks.firstIndex(where: { $0.id == task.id }),
              !microTasks[i].isCompleted else { return }
        microTasks[i].isCompleted = true
        microTasks[i].slotsLeft = max(0, microTasks[i].slotsLeft - 1)
        transactions.insert(
            WalletTransaction(id: UUID(), kind: .taskReward,
                              amountZMW: task.rewardZMW,
                              note: task.title, date: .now),
            at: 0
        )
    }

    // MARK: - Wallet

    /// Simulates an instant cash-out to the selected mobile money wallet.
    /// Production: server-side disbursement via an aggregator (e.g. Flutterwave,
    /// Lenco or direct MTN MoMo / Airtel Money APIs) with OTP confirmation.
    @discardableResult
    func cashOut(amount: Double) -> Bool {
        guard amount > 0, amount <= walletBalance else { return false }
        transactions.insert(
            WalletTransaction(id: UUID(), kind: .cashOut,
                              amountZMW: -amount,
                              note: "Cash out to \(payoutProvider.rawValue)",
                              date: .now),
            at: 0
        )
        return true
    }
}
