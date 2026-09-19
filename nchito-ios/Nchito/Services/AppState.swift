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
    @Published var proofPhotos: [ProofPhoto] = MockDataService.proofPhotos

    @Published var workRecord: [WorkRecordEntry] = MockDataService.workRecordEntries

    /// Private until the worker opts in — employment history is sensitive, and
    /// the slug can be rotated to revoke a link already handed out.
    @Published var workRecordSharing = WorkRecordSharing(isPublic: false, slug: "k7mq2xrp")

    /// Settled gigs kept for price comparison only — never shown in the feed.
    let settledGigs: [Gig] = MockDataService.settledGigs

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

    // MARK: - Proof of work (INNOVATION.md §4.1)

    func proofStatus(for gig: Gig) -> ProofStatus {
        let forGig = proofPhotos.filter { $0.gigID == gig.id }
        return ProofStatus(before: forGig.first { $0.kind == .before },
                           after: forGig.first { $0.kind == .after })
    }

    /// Records a capture. Demo mode simulates the photo and stamps Lusaka
    /// coordinates; production uploads to the `proofs` bucket and reads the
    /// real device location and capture time.
    func captureProof(_ kind: ProofPhoto.Kind, for gig: Gig) {
        guard !proofPhotos.contains(where: { $0.gigID == gig.id && $0.kind == kind }) else { return }
        proofPhotos.append(ProofPhoto(id: UUID(), gigID: gig.id, kind: kind,
                                      storagePath: "", capturedAt: .now,
                                      latitude: -15.3875, longitude: 28.3228))
    }

    /// Mirrors the guard inside `release_escrow()`: no complete proof, no payment.
    func canReleaseEscrow(for gig: Gig) -> Bool {
        proofStatus(for: gig).isComplete
    }

    // MARK: - Pricing (INNOVATION.md §5.1)

    /// Price bands are computed from settled gigs only, so a flood of
    /// optimistic open listings can't drag the suggested rate around.
    func priceBand(for category: GigCategory, city: String) -> PriceBand? {
        PricingService.band(for: category, city: city, in: settledGigs)
    }

    // MARK: - Work Record (INNOVATION.md §1.2)

    var workRecordSummary: WorkRecordSummary {
        WorkRecordService.summary(for: workRecord, memberSince: user.joinedDate)
    }

    func setWorkRecordPublic(_ isPublic: Bool) {
        workRecordSharing.isPublic = isPublic
    }

    /// Issues a new slug, which invalidates any link already shared.
    func rotateWorkRecordLink() {
        let alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
        workRecordSharing.slug = String((0..<8).map { _ in alphabet.randomElement()! })
    }

    func exportWorkRecordCV() -> URL? {
        WorkRecordService.exportCV(user: user, entries: workRecord,
                                   summary: workRecordSummary,
                                   sharing: workRecordSharing)
    }

    // MARK: - Earned wage access (INNOVATION.md §3.2)

    @Published var advances: [WageAdvance] = []

    /// Whatever the worker still owes, if anything. Surfaced plainly so a
    /// balance never quietly goes negative with no explanation.
    var outstandingAdvance: WageAdvance? {
        advances.first { $0.status == .outstanding || $0.status == .recovering }
    }

    /// Mirrors `advance_eligibility()`. The server re-checks on request, since
    /// eligibility can change between drawing this screen and tapping confirm.
    func advanceOffer(for gig: Gig) -> AdvanceOffer {
        guard appliedGigIDs.contains(gig.id) else {
            return .ineligible("Advances are only available once a gig is assigned to you.")
        }
        guard !advances.contains(where: { $0.gigID == gig.id && $0.status != .writtenOff }) else {
            return .ineligible("You have already taken an advance on this gig.")
        }

        // Work must demonstrably have started. The "before" photo carries a
        // device capture time and location, so this is evidence, not a claim —
        // and it is why proof-of-work had to exist before this feature could.
        guard proofStatus(for: gig).before != nil else {
            return .ineligible("Take your \"before\" photo on this gig first — that is what shows the work has started.")
        }

        // Standing, read from the Work Record.
        let summary = workRecordSummary
        guard summary.totalGigs >= AdvanceTerms.minimumCompletedJobs else {
            return .ineligible("Complete \(AdvanceTerms.minimumCompletedJobs) jobs through Nchito to unlock early payment.")
        }
        guard (summary.onTimeRate ?? 0) >= AdvanceTerms.minimumOnTimeRate else {
            return .ineligible("Early payment needs most of your recent jobs delivered on time.")
        }

        // One at a time. Stacking advances across gigs is how a worker ends up
        // owing more than they are about to earn.
        guard outstandingAdvance == nil else {
            return .ineligible("Finish the gig you already took an advance on first.")
        }

        let cap = AdvanceTerms.maxAdvance(onPayout: gig.workerPayout)
        guard cap >= AdvanceTerms.minimumAdvance else {
            return .ineligible("This gig is too small for an early payment.")
        }

        return AdvanceOffer(isEligible: true, maxAmount: cap,
                            reason: "You can take up to \(cap.kwacha) now.")
    }

    /// Credits the full amount requested; the fee comes off at settlement, so
    /// what lands in the wallet is exactly what was quoted.
    @discardableResult
    func takeAdvance(on gig: Gig, amount: Double) -> Bool {
        let offer = advanceOffer(for: gig)
        guard offer.isEligible, amount > 0, amount <= offer.maxAmount else { return false }

        let fee = AdvanceTerms.fee(on: amount)
        advances.insert(WageAdvance(id: UUID(), gigID: gig.id, gigTitle: gig.title,
                                    amountZMW: amount, feeZMW: fee,
                                    status: .outstanding, createdAt: .now), at: 0)

        transactions.insert(
            WalletTransaction(id: UUID(), kind: .wageAdvance, amountZMW: amount,
                              note: "Early payment on \(gig.title)", date: .now),
            at: 0)
        return true
    }

    // MARK: - USSD & WhatsApp access (INNOVATION.md §2.1)

    /// Shown wherever the offline channels are mentioned, so the shortcode
    /// lives in exactly one place.
    static let ussdShortcode = "*384*62448#"

    @Published private(set) var hasChannelPIN = false

    private static let tooCommonPINs: Set<String> = [
        "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777",
        "8888", "9999", "1234", "4321", "1212", "0123",
    ]

    /// Production calls `set_channel_pin()`, which hashes with bcrypt and
    /// applies the same rules. The PIN itself is never stored on the device.
    @discardableResult
    func setChannelPIN(_ pin: String) -> Bool {
        guard pin.count == 4, pin.allSatisfy(\.isNumber),
              !Self.tooCommonPINs.contains(pin) else { return false }
        hasChannelPIN = true
        return true
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
