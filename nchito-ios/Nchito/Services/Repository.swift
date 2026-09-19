import Foundation

/// Everything the app needs from a backend.
///
/// Two implementations sit behind this: `LiveRepository` talks to Supabase,
/// `MockRepository` serves the seed data. Keeping demo mode working has been a
/// design rule from the start — the app must stay fully demoable with no
/// backend at all, for pitches, screenshots and offline development — and this
/// is what makes that sustainable rather than a growing pile of `if` statements.
protocol NchitoRepository: Sendable {

    // Reads
    func loadProfile() async throws -> UserProfile
    func loadGigs(city: String?, category: GigCategory?) async throws -> [Gig]
    func loadSettledGigs() async throws -> [Gig]
    func loadMicroTasks() async throws -> [MicroTask]
    func loadTransactions() async throws -> [WalletTransaction]
    func loadConversations() async throws -> [Conversation]
    func loadMessages(conversationID: UUID) async throws -> [ChatMessage]
    func loadWorkRecord() async throws -> [WorkRecordEntry]
    func loadProofPhotos(gigIDs: [UUID]) async throws -> [ProofPhoto]
    func loadAdvances() async throws -> [WageAdvance]
    func loadAppliedGigIDs() async throws -> Set<UUID>

    // Writes
    func post(gig: Gig) async throws -> Gig
    func apply(gigID: UUID) async throws -> String
    func complete(taskID: UUID) async throws
    func send(message body: String, conversationID: UUID) async throws -> ChatMessage
    func startConversation(gigID: UUID, posterName: String, posterRating: Double) async throws -> Conversation
    func captureProof(_ kind: ProofPhoto.Kind, gigID: UUID,
                      imageData: Data?, latitude: Double?, longitude: Double?) async throws -> ProofPhoto
    func cashOut(amount: Double) async throws -> String
    func requestAdvance(gigID: UUID, amount: Double) async throws -> String
    func advanceEligibility(gigID: UUID) async throws -> AdvanceOffer
    func setWorkRecordSharing(isPublic: Bool, rotate: Bool) async throws -> String
    func setChannelPIN(_ pin: String) async throws
}

// MARK: - Mock

/// Serves `MockDataService` through the same interface, so demo mode exercises
/// the identical code paths the live app does.
actor MockRepository: NchitoRepository {

    private var gigs = MockDataService.gigs
    private var tasks = MockDataService.microTasks
    private var transactions = MockDataService.transactions
    private var conversations = MockDataService.conversations
    private var messages = MockDataService.messages
    private var proofs = MockDataService.proofPhotos
    private var advances: [WageAdvance] = []
    private var applied: Set<UUID> = []
    private var sharingSlug = "k7mq2xrp"

    /// A short delay so loading states are actually visible in demo mode; a
    /// screen that never shows a spinner hides bugs that only appear on a real
    /// connection.
    private func simulateLatency() async {
        try? await Task.sleep(nanoseconds: 250_000_000)
    }

    func loadProfile() async throws -> UserProfile {
        await simulateLatency(); return MockDataService.currentUser
    }

    func loadGigs(city: String?, category: GigCategory?) async throws -> [Gig] {
        await simulateLatency()
        return gigs.filter { gig in
            (city == nil || city == "All Cities" || gig.city == city)
            && (category == nil || gig.category == category)
        }
    }

    func loadSettledGigs() async throws -> [Gig] { MockDataService.settledGigs }
    func loadMicroTasks() async throws -> [MicroTask] { await simulateLatency(); return tasks }
    func loadTransactions() async throws -> [WalletTransaction] { await simulateLatency(); return transactions }
    func loadConversations() async throws -> [Conversation] { await simulateLatency(); return conversations }

    func loadMessages(conversationID: UUID) async throws -> [ChatMessage] {
        messages.filter { $0.conversationID == conversationID }.sorted { $0.date < $1.date }
    }

    func loadWorkRecord() async throws -> [WorkRecordEntry] {
        await simulateLatency(); return MockDataService.workRecordEntries
    }

    func loadProofPhotos(gigIDs: [UUID]) async throws -> [ProofPhoto] {
        proofs.filter { gigIDs.contains($0.gigID) }
    }

    func loadAdvances() async throws -> [WageAdvance] { advances }
    func loadAppliedGigIDs() async throws -> Set<UUID> { applied }

    func post(gig: Gig) async throws -> Gig { gigs.insert(gig, at: 0); return gig }

    func apply(gigID: UUID) async throws -> String {
        guard !applied.contains(gigID) else { return "You have already applied for this gig." }
        applied.insert(gigID)
        if let i = gigs.firstIndex(where: { $0.id == gigID }) { gigs[i].applicants += 1 }
        return "Applied. You will get an SMS if you are picked."
    }

    func complete(taskID: UUID) async throws {
        guard let i = tasks.firstIndex(where: { $0.id == taskID }), !tasks[i].isCompleted else { return }
        tasks[i].isCompleted = true
        tasks[i].slotsLeft = max(0, tasks[i].slotsLeft - 1)
        transactions.insert(WalletTransaction(id: UUID(), kind: .taskReward,
                                              amountZMW: tasks[i].rewardZMW,
                                              note: tasks[i].title, date: .now), at: 0)
    }

    func send(message body: String, conversationID: UUID) async throws -> ChatMessage {
        let message = ChatMessage(id: UUID(), conversationID: conversationID,
                                  isMine: true, body: body, date: .now)
        messages.append(message)
        return message
    }

    func startConversation(gigID: UUID, posterName: String,
                           posterRating: Double) async throws -> Conversation {
        if let existing = conversations.first(where: { $0.gigID == gigID }) { return existing }
        let title = gigs.first { $0.id == gigID }?.title ?? ""
        let convo = Conversation(id: UUID(), counterpartName: posterName,
                                 counterpartRating: posterRating, gigID: gigID,
                                 gigTitle: title, lastActivity: .now)
        conversations.insert(convo, at: 0)
        return convo
    }

    func captureProof(_ kind: ProofPhoto.Kind, gigID: UUID, imageData: Data?,
                      latitude: Double?, longitude: Double?) async throws -> ProofPhoto {
        let photo = ProofPhoto(id: UUID(), gigID: gigID, kind: kind, storagePath: "",
                               capturedAt: .now, latitude: latitude ?? -15.3875,
                               longitude: longitude ?? 28.3228)
        proofs.append(photo)
        return photo
    }

    func cashOut(amount: Double) async throws -> String {
        let balance = transactions.reduce(0) { $0 + $1.amountZMW }
        guard amount > 0, amount <= balance else { return "Not enough balance." }
        transactions.insert(WalletTransaction(id: UUID(), kind: .cashOut, amountZMW: -amount,
                                              note: "Cash out", date: .now), at: 0)
        return "Sent \(amount.kwacha) to your mobile money."
    }

    func requestAdvance(gigID: UUID, amount: Double) async throws -> String {
        let fee = AdvanceTerms.fee(on: amount)
        let title = gigs.first { $0.id == gigID }?.title ?? ""
        advances.insert(WageAdvance(id: UUID(), gigID: gigID, gigTitle: title,
                                    amountZMW: amount, feeZMW: fee,
                                    status: .outstanding, createdAt: .now), at: 0)
        transactions.insert(WalletTransaction(id: UUID(), kind: .wageAdvance, amountZMW: amount,
                                              note: "Early payment on \(title)", date: .now), at: 0)
        return "Paid \(amount.kwacha) now."
    }

    /// Demo mode can't reproduce the server's checks, so it reports eligible and
    /// lets `AppState`'s local rules decide — the same rules the server enforces.
    func advanceEligibility(gigID: UUID) async throws -> AdvanceOffer {
        AdvanceOffer(isEligible: true, maxAmount: 0, reason: "")
    }

    func setWorkRecordSharing(isPublic: Bool, rotate: Bool) async throws -> String {
        if rotate {
            let alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
            sharingSlug = String((0..<8).map { _ in alphabet.randomElement()! })
        }
        return sharingSlug
    }

    func setChannelPIN(_ pin: String) async throws {}
}
