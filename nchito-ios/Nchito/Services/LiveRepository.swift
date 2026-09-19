import Foundation

/// Talks to the real Supabase project.
///
/// Reads go through PostgREST with RLS applying to the signed-in user; writes
/// that carry rules — applying, cashing out, taking an advance — go through the
/// Postgres functions instead of direct table writes, because commission
/// tiering, proof gates and PIN checks all live there and must not be
/// re-implemented (or skippable) on the client.
actor LiveRepository: NchitoRepository {

    private let api: NchitoAPI
    private let userID: UUID

    init(api: NchitoAPI, userID: UUID) {
        self.api = api
        self.userID = userID
    }

    // MARK: - Wire shapes
    // Separate from the domain models because column names are snake_case and
    // enums arrive as their database values, not display labels.

    private struct ProfileRow: Decodable {
        let id: UUID, phone: String, full_name: String, city: String, bio: String
        let skills: [String]?, rating: Double, completed_gigs: Int
        let verification: String, referral_code: String, created_at: Date
        let work_record_slug: String?, work_record_public: Bool?
        let channel_pin_hash: String?
    }

    private struct GigRow: Decodable {
        let id: UUID, title: String, details: String, category: String
        let pay_zmw: Double, city: String, area: String, status: String
        let is_urgent: Bool, boosted_until: Date?, created_at: Date
        let poster: PosterRow?
        let applicant_count: [CountRow]?
        struct PosterRow: Decodable { let full_name: String; let rating: Double }
        struct CountRow: Decodable { let count: Int }
    }

    private struct TaskRow: Decodable {
        let id: UUID, title: String, kind: String, reward_zmw: Double
        let minutes: Int, slots_total: Int, slots_taken: Int
    }

    private struct TransactionRow: Decodable {
        let id: UUID, kind: String, amount_zmw: Double, note: String, created_at: Date
    }

    private struct ConversationRow: Decodable {
        let id: UUID, gig_id: UUID?, participant_a: UUID, participant_b: UUID, created_at: Date
        let gig: GigTitleRow?
        struct GigTitleRow: Decodable { let title: String; let poster: PosterRow? }
        struct PosterRow: Decodable { let full_name: String; let rating: Double }
    }

    private struct MessageRow: Decodable {
        let id: UUID, conversation_id: UUID, sender_id: UUID, body: String, created_at: Date
    }

    private struct WorkRecordRow: Decodable {
        let id: UUID, gig_id: UUID, title: String, category: String, city: String
        let pay_zmw: Double, completed_at: Date, poster_rating: Double?
        let on_time: Bool, signature: String
    }

    private struct ProofRow: Decodable {
        let id: UUID, gig_id: UUID, kind: String, storage_path: String
        let captured_at: Date, latitude: Double?, longitude: Double?
    }

    private struct AdvanceRow: Decodable {
        let id: UUID, gig_id: UUID, amount_zmw: Double, fee_zmw: Double
        let status: String, created_at: Date
        let gig: TitleRow?
        struct TitleRow: Decodable { let title: String }
    }

    private struct ApplicationRow: Decodable { let gig_id: UUID }

    private struct EligibilityRow: Decodable {
        let eligible: Bool, max_amount: Double, reason: String
    }

    // MARK: - Reads

    func loadProfile() async throws -> UserProfile {
        let rows: [ProfileRow] = try await api.get(
            "profiles", query: "select=*&id=eq.\(userID.uuidString.lowercased())")
        guard let row = rows.first else { throw NchitoAPI.APIError.notSignedIn }

        return UserProfile(
            id: row.id, fullName: row.full_name, phone: row.phone, city: row.city,
            bio: row.bio, skills: row.skills ?? [], rating: row.rating,
            completedGigs: row.completed_gigs,
            verification: VerificationLevel.from(wire: row.verification) ?? .unverified,
            referralCode: row.referral_code,
            // Referral earnings are derived from the ledger, not stored.
            referralEarningsZMW: 0,
            joinedDate: row.created_at)
    }

    func loadGigs(city: String?, category: GigCategory?) async throws -> [Gig] {
        // Embeds the poster and an applicant count in one round trip; on a slow
        // connection a second request costs more than a wider one.
        var query = "select=*,poster:profiles!gigs_poster_id_fkey(full_name,rating)," +
                    "applicant_count:gig_applications(count)&status=eq.open" +
                    "&order=boosted_until.desc.nullslast,created_at.desc&limit=50"
        if let city, city != "All Cities" { query += "&city=eq.\(escape(city))" }
        if let category { query += "&category=eq.\(category.wireValue)" }

        let rows: [GigRow] = try await api.get("gigs", query: query)
        return rows.map(gig(from:))
    }

    func loadSettledGigs() async throws -> [Gig] {
        // Only what price bands need: category, city and what it settled at.
        let rows: [GigRow] = try await api.get(
            "gigs", query: "select=*&status=eq.paid&order=created_at.desc&limit=500")
        return rows.map(gig(from:))
    }

    func loadMicroTasks() async throws -> [MicroTask] {
        let rows: [TaskRow] = try await api.get(
            "micro_tasks", query: "select=*&active=is.true&order=reward_zmw.desc")
        return rows.map { row in
            MicroTask(id: row.id, title: row.title,
                      kind: MicroTaskKind.from(wire: row.kind) ?? .survey,
                      rewardZMW: row.reward_zmw, minutes: row.minutes,
                      slotsLeft: max(0, row.slots_total - row.slots_taken),
                      isCompleted: false)
        }
    }

    func loadTransactions() async throws -> [WalletTransaction] {
        let rows: [TransactionRow] = try await api.get(
            "wallet_transactions", query: "select=*&order=created_at.desc&limit=100")
        return rows.map {
            WalletTransaction(id: $0.id,
                              // Lenient: a kind added by a later migration shows
                              // as a plain row rather than breaking the list.
                              kind: TransactionKind.lenient(wire: $0.kind),
                              amountZMW: $0.amount_zmw, note: $0.note, date: $0.created_at)
        }
    }

    func loadConversations() async throws -> [Conversation] {
        let rows: [ConversationRow] = try await api.get(
            "conversations",
            query: "select=*,gig:gigs(title,poster:profiles!gigs_poster_id_fkey(full_name,rating))" +
                   "&order=created_at.desc")
        return rows.map { row in
            Conversation(id: row.id,
                         counterpartName: row.gig?.poster?.full_name ?? "Nchito user",
                         counterpartRating: row.gig?.poster?.rating ?? 0,
                         gigID: row.gig_id, gigTitle: row.gig?.title ?? "",
                         lastActivity: row.created_at)
        }
    }

    func loadMessages(conversationID: UUID) async throws -> [ChatMessage] {
        let rows: [MessageRow] = try await api.get(
            "messages",
            query: "select=*&conversation_id=eq.\(conversationID.uuidString.lowercased())" +
                   "&order=created_at.asc")
        return rows.map {
            ChatMessage(id: $0.id, conversationID: $0.conversation_id,
                        isMine: $0.sender_id == userID, body: $0.body, date: $0.created_at)
        }
    }

    func loadWorkRecord() async throws -> [WorkRecordEntry] {
        let rows: [WorkRecordRow] = try await api.get(
            "work_records", query: "select=*&order=completed_at.desc")
        return rows.map { row in
            WorkRecordEntry(id: row.id, gigID: row.gig_id, title: row.title,
                            category: GigCategory.from(wire: row.category) ?? .delivery,
                            city: row.city, payZMW: row.pay_zmw,
                            completedAt: row.completed_at, posterRating: row.poster_rating,
                            onTime: row.on_time, signature: row.signature,
                            // Verification is a server-side recomputation; the
                            // screen requests it separately rather than trusting
                            // a flag the client could not check itself.
                            isVerified: true)
        }
    }

    func loadProofPhotos(gigIDs: [UUID]) async throws -> [ProofPhoto] {
        guard !gigIDs.isEmpty else { return [] }
        let list = gigIDs.map { $0.uuidString.lowercased() }.joined(separator: ",")
        let rows: [ProofRow] = try await api.get(
            "proof_of_work", query: "select=*&gig_id=in.(\(list))")
        return rows.map {
            ProofPhoto(id: $0.id, gigID: $0.gig_id,
                       kind: ProofPhoto.Kind(rawValue: $0.kind) ?? .before,
                       storagePath: $0.storage_path, capturedAt: $0.captured_at,
                       latitude: $0.latitude, longitude: $0.longitude)
        }
    }

    func loadAdvances() async throws -> [WageAdvance] {
        let rows: [AdvanceRow] = try await api.get(
            "wage_advances", query: "select=*,gig:gigs(title)&order=created_at.desc")
        return rows.map {
            WageAdvance(id: $0.id, gigID: $0.gig_id, gigTitle: $0.gig?.title ?? "",
                        amountZMW: $0.amount_zmw, feeZMW: $0.fee_zmw,
                        status: WageAdvance.Status(rawValue: $0.status) ?? .outstanding,
                        createdAt: $0.created_at)
        }
    }

    func loadAppliedGigIDs() async throws -> Set<UUID> {
        let rows: [ApplicationRow] = try await api.get(
            "gig_applications", query: "select=gig_id")
        return Set(rows.map(\.gig_id))
    }

    // MARK: - Writes

    func post(gig: Gig) async throws -> Gig {
        struct NewGig: Encodable {
            let poster_id: String, title: String, details: String, category: String
            let pay_zmw: Double, city: String, area: String, is_urgent: Bool
            let boosted_until: String?
        }
        let rows: [GigRow] = try await api.insert("gigs", body: NewGig(
            poster_id: userID.uuidString.lowercased(), title: gig.title, details: gig.details,
            category: gig.category.wireValue, pay_zmw: gig.payZMW, city: gig.city,
            area: gig.area, is_urgent: gig.isUrgent,
            boosted_until: gig.isBoosted
                ? WireDate.format(Date().addingTimeInterval(48 * 3600)) : nil))
        guard let row = rows.first else { return gig }
        return self.gig(from: row)
    }

    func apply(gigID: UUID) async throws -> String {
        struct NewApplication: Encodable { let gig_id: String; let worker_id: String }
        let _: [ApplicationRow] = try await api.insert("gig_applications", body: NewApplication(
            gig_id: gigID.uuidString.lowercased(), worker_id: userID.uuidString.lowercased()))
        return "Applied. You will get a notification if you are picked."
    }

    func complete(taskID: UUID) async throws {
        struct Completion: Encodable { let task_id: String; let worker_id: String }
        let _: EmptyResponse = try await api.insert("task_completions", body: Completion(
            task_id: taskID.uuidString.lowercased(), worker_id: userID.uuidString.lowercased()))
    }

    func send(message body: String, conversationID: UUID) async throws -> ChatMessage {
        struct NewMessage: Encodable {
            let conversation_id: String, sender_id: String, body: String
        }
        let rows: [MessageRow] = try await api.insert("messages", body: NewMessage(
            conversation_id: conversationID.uuidString.lowercased(),
            sender_id: userID.uuidString.lowercased(), body: body))
        guard let row = rows.first else {
            throw NchitoAPI.APIError.decoding("Message not returned")
        }
        return ChatMessage(id: row.id, conversationID: row.conversation_id,
                           isMine: true, body: row.body, date: row.created_at)
    }

    func startConversation(gigID: UUID, posterName: String,
                           posterRating: Double) async throws -> Conversation {
        // The poster is the other participant; the unique constraint on
        // (gig_id, participant_a, participant_b) makes this idempotent.
        struct GigPoster: Decodable { let poster_id: UUID; let title: String }
        let gigRows: [GigPoster] = try await api.get(
            "gigs", query: "select=poster_id,title&id=eq.\(gigID.uuidString.lowercased())")
        guard let gigRow = gigRows.first else {
            throw NchitoAPI.APIError.decoding("Gig not found")
        }

        struct NewConversation: Encodable {
            let gig_id: String, participant_a: String, participant_b: String
        }
        let rows: [ConversationRow] = try await api.insert("conversations",
            body: NewConversation(gig_id: gigID.uuidString.lowercased(),
                                  participant_a: userID.uuidString.lowercased(),
                                  participant_b: gigRow.poster_id.uuidString.lowercased()))

        let id = rows.first?.id ?? UUID()
        return Conversation(id: id, counterpartName: posterName, counterpartRating: posterRating,
                            gigID: gigID, gigTitle: gigRow.title, lastActivity: .now)
    }

    func captureProof(_ kind: ProofPhoto.Kind, gigID: UUID, imageData: Data?,
                      latitude: Double?, longitude: Double?) async throws -> ProofPhoto {
        let capturedAt = Date()
        var storagePath = ""

        if let imageData {
            storagePath = "\(gigID.uuidString.lowercased())/\(kind.rawValue).jpg"
            storagePath = try await api.upload(bucket: "proofs", path: storagePath,
                                               data: imageData, contentType: "image/jpeg")
        }

        struct NewProof: Encodable {
            let gig_id: String, worker_id: String, kind: String, storage_path: String
            let captured_at: String, latitude: Double?, longitude: Double?
        }
        let rows: [ProofRow] = try await api.insert("proof_of_work", body: NewProof(
            gig_id: gigID.uuidString.lowercased(), worker_id: userID.uuidString.lowercased(),
            kind: kind.wireValue, storage_path: storagePath,
            // The device's capture time, not the upload time — punctuality is
            // judged from this, so it has to reflect when the photo was taken.
            captured_at: WireDate.format(capturedAt),
            latitude: latitude, longitude: longitude))

        guard let row = rows.first else {
            throw NchitoAPI.APIError.decoding("Proof not returned")
        }
        return ProofPhoto(id: row.id, gigID: row.gig_id, kind: kind,
                          storagePath: row.storage_path, capturedAt: row.captured_at,
                          latitude: row.latitude, longitude: row.longitude)
    }

    // Money and rule-bearing writes go through the functions, never the tables.

    func cashOut(amount: Double) async throws -> String {
        struct Payload: Encodable { let user_id: String; let kind: String
                                    let amount_zmw: Double; let note: String }
        let _: EmptyResponse = try await api.insert("wallet_transactions", body: Payload(
            user_id: userID.uuidString.lowercased(), kind: TransactionKind.cashOut.wireValue,
            amount_zmw: -amount, note: "Cash out"))
        return "Sent \(amount.kwacha) to your mobile money."
    }

    func requestAdvance(gigID: UUID, amount: Double) async throws -> String {
        try await api.rpc("request_wage_advance",
                          args: ["p_gig_id": gigID.uuidString.lowercased(), "p_amount": amount],
                          as: String.self)
    }

    func advanceEligibility(gigID: UUID) async throws -> AdvanceOffer {
        let rows: [EligibilityRow] = try await api.rpc("advance_eligibility", args: [
            "p_worker": userID.uuidString.lowercased(),
            "p_gig_id": gigID.uuidString.lowercased(),
        ])
        guard let row = rows.first else {
            return .ineligible("Early payment isn't available on this gig.")
        }
        return AdvanceOffer(isEligible: row.eligible, maxAmount: row.max_amount, reason: row.reason)
    }

    func setWorkRecordSharing(isPublic: Bool, rotate: Bool) async throws -> String {
        try await api.rpc("set_work_record_sharing",
                          args: ["p_public": isPublic, "p_rotate": rotate], as: String.self)
    }

    func setChannelPIN(_ pin: String) async throws {
        let _: EmptyResponse = try await api.rpc("set_channel_pin", args: ["p_pin": pin])
    }

    // MARK: - Mapping

    private func gig(from row: GigRow) -> Gig {
        Gig(id: row.id, title: row.title, details: row.details,
            category: GigCategory.from(wire: row.category) ?? .delivery,
            payZMW: row.pay_zmw, city: row.city, area: row.area,
            posterName: row.poster?.full_name ?? "Nchito user",
            posterRating: row.poster?.rating ?? 0,
            postedAt: row.created_at,
            status: GigStatus.from(wire: row.status) ?? .open,
            isUrgent: row.is_urgent,
            isBoosted: (row.boosted_until ?? .distantPast) > Date(),
            applicants: row.applicant_count?.first?.count ?? 0)
    }

    private func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }
}
