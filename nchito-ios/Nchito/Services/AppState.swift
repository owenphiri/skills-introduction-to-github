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
    @Published var conversations: [Conversation] = MockDataService.conversations
    @Published var messages: [ChatMessage] = MockDataService.messages

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

    // MARK: - Chat
    // Mock implementation. Production: insert into the `messages` table and
    // receive the counterpart's replies via Supabase Realtime (see supabase/README.md).

    func messages(in conversation: Conversation) -> [ChatMessage] {
        messages.filter { $0.conversationID == conversation.id }
            .sorted { $0.date < $1.date }
    }

    func send(_ body: String, in conversation: Conversation) {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        messages.append(ChatMessage(id: UUID(), conversationID: conversation.id,
                                    isMine: true, body: trimmed, date: .now))
        touch(conversation)
    }

    /// Returns the existing conversation for a gig or starts a new one —
    /// used by the "Message poster" button on the gig detail screen.
    func conversation(about gig: Gig) -> Conversation {
        if let existing = conversations.first(where: { $0.gigID == gig.id }) {
            return existing
        }
        let convo = Conversation(id: UUID(), counterpartName: gig.posterName,
                                 counterpartRating: gig.posterRating,
                                 gigID: gig.id, gigTitle: gig.title, lastActivity: .now)
        conversations.insert(convo, at: 0)
        return convo
    }

    private func touch(_ conversation: Conversation) {
        if let i = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations[i].lastActivity = .now
        }
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
