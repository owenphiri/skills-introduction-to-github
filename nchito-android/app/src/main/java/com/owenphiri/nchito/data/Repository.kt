package com.owenphiri.nchito.data

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.Date
import java.util.UUID

/**
 * Everything the app needs from a backend.
 *
 * Two implementations sit behind this: LiveRepository talks to Supabase,
 * MockRepository serves the seed data. Keeping demo mode working has been a
 * design rule from the start — the app must stay fully demoable with no backend
 * for pitches, screenshots and offline development — and this is what makes
 * that sustainable rather than a growing pile of `if` statements.
 */
interface NchitoRepository {
    suspend fun loadGigs(city: String?, category: GigCategory?): List<Gig>
    suspend fun loadSettledGigs(): List<Gig>
    suspend fun loadMicroTasks(): List<MicroTask>
    suspend fun loadTransactions(): List<WalletTransaction>
    suspend fun loadConversations(): List<Conversation>
    suspend fun loadMessages(conversationId: UUID): List<ChatMessage>
    suspend fun loadWorkRecord(): List<WorkRecordEntry>
    suspend fun loadProofPhotos(gigIds: List<UUID>): List<ProofPhoto>
    suspend fun loadAdvances(): List<WageAdvance>
    suspend fun loadAppliedGigIds(): Set<UUID>

    suspend fun postGig(gig: Gig): Gig
    suspend fun apply(gigId: UUID): String
    suspend fun completeTask(taskId: UUID)
    suspend fun sendMessage(body: String, conversationId: UUID): ChatMessage
    suspend fun captureProof(kind: ProofKind, gigId: UUID, image: ByteArray?,
                             latitude: Double?, longitude: Double?): ProofPhoto
    suspend fun cashOut(amount: Double): String
    suspend fun requestAdvance(gigId: UUID, amount: Double): String
    suspend fun setWorkRecordSharing(isPublic: Boolean, rotate: Boolean): String
    suspend fun setChannelPin(pin: String)
}

/** Serves MockData through the same interface, so demo mode exercises the same paths. */
class MockRepository : NchitoRepository {
    private val gigs = MockData.gigs.toMutableList()
    private val tasks = MockData.microTasks.toMutableList()
    private val transactions = MockData.transactions.toMutableList()
    private val messages = MockData.messages.toMutableList()
    private val proofs = MockData.proofPhotos.toMutableList()
    private val advances = mutableListOf<WageAdvance>()
    private val applied = mutableSetOf<UUID>()
    private var slug = "k7mq2xrp"

    /**
     * A short delay so loading states are visible in demo mode; a screen that
     * never shows a spinner hides bugs that only appear on a real connection.
     */
    private suspend fun latency() = kotlinx.coroutines.delay(250)

    override suspend fun loadGigs(city: String?, category: GigCategory?): List<Gig> {
        latency()
        return gigs.filter { g ->
            (city == null || city == "All Cities" || g.city == city) &&
            (category == null || g.category == category)
        }
    }

    override suspend fun loadSettledGigs() = MockData.settledGigs
    override suspend fun loadMicroTasks(): List<MicroTask> { latency(); return tasks }
    override suspend fun loadTransactions(): List<WalletTransaction> { latency(); return transactions }
    override suspend fun loadConversations(): List<Conversation> { latency(); return MockData.conversations }
    override suspend fun loadMessages(conversationId: UUID) =
        messages.filter { it.conversationId == conversationId }
    override suspend fun loadWorkRecord(): List<WorkRecordEntry> { latency(); return MockData.workRecordEntries }
    override suspend fun loadProofPhotos(gigIds: List<UUID>) = proofs.filter { it.gigId in gigIds }
    override suspend fun loadAdvances() = advances.toList()
    override suspend fun loadAppliedGigIds() = applied.toSet()

    override suspend fun postGig(gig: Gig): Gig { gigs.add(0, gig); return gig }

    override suspend fun apply(gigId: UUID): String {
        if (!applied.add(gigId)) return "You have already applied for this gig."
        val i = gigs.indexOfFirst { it.id == gigId }
        if (i >= 0) gigs[i] = gigs[i].copy(applicants = gigs[i].applicants + 1)
        return "Applied. You will get an SMS if you are picked."
    }

    override suspend fun completeTask(taskId: UUID) {
        val i = tasks.indexOfFirst { it.id == taskId }
        if (i < 0 || tasks[i].isCompleted) return
        tasks[i] = tasks[i].copy(isCompleted = true,
                                 slotsLeft = (tasks[i].slotsLeft - 1).coerceAtLeast(0))
        transactions.add(0, WalletTransaction(kind = TxKind.TASK_REWARD,
                                              amountZMW = tasks[i].rewardZMW,
                                              note = tasks[i].title))
    }

    override suspend fun sendMessage(body: String, conversationId: UUID): ChatMessage {
        val message = ChatMessage(conversationId = conversationId, isMine = true,
                                  body = body, time = "now")
        messages.add(message)
        return message
    }

    override suspend fun captureProof(kind: ProofKind, gigId: UUID, image: ByteArray?,
                                      latitude: Double?, longitude: Double?): ProofPhoto {
        val photo = ProofPhoto(gigId = gigId, kind = kind, capturedAtLabel = "now",
                               latitude = latitude ?: -15.3875, longitude = longitude ?: 28.3228)
        proofs.add(photo)
        return photo
    }

    override suspend fun cashOut(amount: Double): String {
        transactions.add(0, WalletTransaction(kind = TxKind.CASH_OUT, amountZMW = -amount,
                                              note = "Cash out"))
        return "Sent ${amount.kwacha()} to your mobile money."
    }

    override suspend fun requestAdvance(gigId: UUID, amount: Double): String {
        val title = gigs.firstOrNull { it.id == gigId }?.title.orEmpty()
        advances.add(0, WageAdvance(gigId = gigId, gigTitle = title, amountZMW = amount,
                                    feeZMW = AdvanceTerms.fee(amount)))
        transactions.add(0, WalletTransaction(kind = TxKind.WAGE_ADVANCE, amountZMW = amount,
                                              note = "Early payment on $title"))
        return "Paid ${amount.kwacha()} now."
    }

    override suspend fun setWorkRecordSharing(isPublic: Boolean, rotate: Boolean): String {
        if (rotate) slug = (1..8).map { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
        return slug
    }

    override suspend fun setChannelPin(pin: String) {}
}

/**
 * Talks to the real Supabase project.
 *
 * Reads go through PostgREST with RLS applying to the signed-in user; writes
 * that carry rules go through the Postgres functions, because commission
 * tiering, proof gates and PIN checks live there and must not be
 * re-implemented — or skippable — on the client.
 */
class LiveRepository(
    private val api: NchitoApi,
    private val userId: UUID,
) : NchitoRepository {

    private val uid get() = userId.toString().lowercase()

    private fun array(raw: String): List<JsonObject> =
        runCatching { NchitoApi.json.parseToJsonElement(raw).jsonArray.map { it.jsonObject } }
            .getOrDefault(emptyList())

    private fun JsonObject.str(key: String) = this[key]?.jsonPrimitive?.content.orEmpty()
    private fun JsonObject.strOrNull(key: String) =
        this[key]?.jsonPrimitive?.contentOrNullSafe()
    private fun JsonObject.num(key: String) = this[key]?.jsonPrimitive?.doubleOrNull ?: 0.0
    private fun JsonObject.numOrNull(key: String) = this[key]?.jsonPrimitive?.doubleOrNull
    private fun JsonObject.bool(key: String) = this[key]?.jsonPrimitive?.booleanOrNull ?: false
    private fun JsonObject.uuid(key: String) = runCatching { UUID.fromString(str(key)) }
        .getOrDefault(UUID.randomUUID())
    private fun JsonObject.date(key: String) = WireDate.parse(str(key)) ?: Date()

    private fun JsonObject.gig(): Gig {
        val poster = this["poster"]?.jsonObject
        val boostedUntil = strOrNull("boosted_until")?.let { WireDate.parse(it) }
        return Gig(
            id = uuid("id"), title = str("title"), details = str("details"),
            category = gigCategoryFromWire(str("category")) ?: GigCategory.DELIVERY,
            payZMW = num("pay_zmw"), city = str("city"), area = str("area"),
            posterName = poster?.str("full_name") ?: "Nchito user",
            posterRating = poster?.num("rating") ?: 0.0,
            minutesAgo = ((System.currentTimeMillis() - date("created_at").time) / 60_000).toInt(),
            isUrgent = bool("is_urgent"),
            isBoosted = boostedUntil != null && boostedUntil.after(Date()),
            applicants = this["applicant_count"]?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("count")?.jsonPrimitive?.int ?: 0,
            status = gigStatusFromWire(str("status")) ?: GigStatus.OPEN,
        )
    }

    override suspend fun loadGigs(city: String?, category: GigCategory?): List<Gig> {
        // Embeds poster and applicant count in one round trip; on a slow
        // connection a second request costs more than a wider one.
        var query = "select=*,poster:profiles!gigs_poster_id_fkey(full_name,rating)," +
                    "applicant_count:gig_applications(count)&status=eq.open" +
                    "&order=boosted_until.desc.nullslast,created_at.desc&limit=50"
        if (city != null && city != "All Cities") query += "&city=eq.$city"
        category?.let { query += "&category=eq.${it.wireValue}" }
        return array(api.get("gigs", query)).map { it.gig() }
    }

    override suspend fun loadSettledGigs(): List<Gig> =
        array(api.get("gigs", "select=*&status=eq.paid&order=created_at.desc&limit=500"))
            .map { it.gig() }

    override suspend fun loadMicroTasks(): List<MicroTask> =
        array(api.get("micro_tasks", "select=*&active=is.true&order=reward_zmw.desc")).map {
            MicroTask(
                id = it.uuid("id"), title = it.str("title"),
                kind = microTaskKindFromWire(it.str("kind")) ?: MicroTaskKind.SURVEY,
                rewardZMW = it.num("reward_zmw"), minutes = it.num("minutes").toInt(),
                slotsLeft = (it.num("slots_total") - it.num("slots_taken")).toInt().coerceAtLeast(0),
            )
        }

    override suspend fun loadTransactions(): List<WalletTransaction> =
        array(api.get("wallet_transactions", "select=*&order=created_at.desc&limit=100")).map {
            WalletTransaction(
                id = it.uuid("id"),
                // Lenient: a kind added by a later migration shows as a plain
                // row rather than breaking the list.
                kind = txKindFromWire(it.str("kind")),
                amountZMW = it.num("amount_zmw"), note = it.str("note"),
            )
        }

    override suspend fun loadConversations(): List<Conversation> =
        array(api.get("conversations",
            "select=*,gig:gigs(title,poster:profiles!gigs_poster_id_fkey(full_name,rating))" +
            "&order=created_at.desc")).map {
            val gig = it["gig"]?.jsonObject
            val poster = gig?.get("poster")?.jsonObject
            Conversation(
                id = it.uuid("id"),
                counterpartName = poster?.str("full_name") ?: "Nchito user",
                counterpartRating = poster?.num("rating") ?: 0.0,
                gigId = runCatching { UUID.fromString(it.str("gig_id")) }.getOrNull(),
                gigTitle = gig?.str("title").orEmpty(),
            )
        }

    override suspend fun loadMessages(conversationId: UUID): List<ChatMessage> =
        array(api.get("messages",
            "select=*&conversation_id=eq.${conversationId.toString().lowercase()}" +
            "&order=created_at.asc")).map {
            ChatMessage(
                id = it.uuid("id"), conversationId = it.uuid("conversation_id"),
                isMine = it.str("sender_id").equals(uid, ignoreCase = true),
                body = it.str("body"),
                time = android.text.format.DateFormat.format("HH:mm", it.date("created_at")).toString(),
            )
        }

    override suspend fun loadWorkRecord(): List<WorkRecordEntry> =
        array(api.get("work_records", "select=*&order=completed_at.desc")).map {
            WorkRecordEntry(
                id = it.uuid("id"), gigId = it.uuid("gig_id"), title = it.str("title"),
                category = gigCategoryFromWire(it.str("category")) ?: GigCategory.DELIVERY,
                city = it.str("city"), payZMW = it.num("pay_zmw"),
                completedAt = it.date("completed_at"), posterRating = it.numOrNull("poster_rating"),
                onTime = it.bool("on_time"), signature = it.str("signature"),
            )
        }

    override suspend fun loadProofPhotos(gigIds: List<UUID>): List<ProofPhoto> {
        if (gigIds.isEmpty()) return emptyList()
        val list = gigIds.joinToString(",") { it.toString().lowercase() }
        return array(api.get("proof_of_work", "select=*&gig_id=in.($list)")).map {
            ProofPhoto(
                id = it.uuid("id"), gigId = it.uuid("gig_id"),
                kind = proofKindFromWire(it.str("kind")),
                storagePath = it.str("storage_path"),
                capturedAtLabel = android.text.format.DateFormat
                    .format("d MMM HH:mm", it.date("captured_at")).toString(),
                latitude = it.numOrNull("latitude"), longitude = it.numOrNull("longitude"),
            )
        }
    }

    override suspend fun loadAdvances(): List<WageAdvance> =
        array(api.get("wage_advances", "select=*,gig:gigs(title)&order=created_at.desc")).map {
            WageAdvance(
                id = it.uuid("id"), gigId = it.uuid("gig_id"),
                gigTitle = it["gig"]?.jsonObject?.str("title").orEmpty(),
                amountZMW = it.num("amount_zmw"), feeZMW = it.num("fee_zmw"),
                status = advanceStatusFromWire(it.str("status")),
                createdAt = it.date("created_at"),
            )
        }

    override suspend fun loadAppliedGigIds(): Set<UUID> =
        array(api.get("gig_applications", "select=gig_id")).map { it.uuid("gig_id") }.toSet()

    override suspend fun postGig(gig: Gig): Gig {
        val body = buildJsonObject {
            put("poster_id", uid); put("title", gig.title); put("details", gig.details)
            put("category", gig.category.wireValue); put("pay_zmw", gig.payZMW)
            put("city", gig.city); put("area", gig.area); put("is_urgent", gig.isUrgent)
            if (gig.isBoosted) {
                put("boosted_until",
                    WireDate.format(Date(System.currentTimeMillis() + 48 * 3600_000L)))
            }
        }
        return array(api.insert("gigs", body.toString())).firstOrNull()?.gig() ?: gig
    }

    override suspend fun apply(gigId: UUID): String {
        val body = buildJsonObject {
            put("gig_id", gigId.toString().lowercase()); put("worker_id", uid)
        }
        api.insert("gig_applications", body.toString())
        return "Applied. You will get a notification if you are picked."
    }

    override suspend fun completeTask(taskId: UUID) {
        val body = buildJsonObject {
            put("task_id", taskId.toString().lowercase()); put("worker_id", uid)
        }
        api.insert("task_completions", body.toString())
    }

    override suspend fun sendMessage(body: String, conversationId: UUID): ChatMessage {
        val payload = buildJsonObject {
            put("conversation_id", conversationId.toString().lowercase())
            put("sender_id", uid); put("body", body)
        }
        val row = array(api.insert("messages", payload.toString())).firstOrNull()
        return ChatMessage(
            id = row?.uuid("id") ?: UUID.randomUUID(), conversationId = conversationId,
            isMine = true, body = body,
            time = android.text.format.DateFormat.format("HH:mm", Date()).toString(),
        )
    }

    override suspend fun captureProof(kind: ProofKind, gigId: UUID, image: ByteArray?,
                                      latitude: Double?, longitude: Double?): ProofPhoto {
        val capturedAt = Date()
        var storagePath = ""
        if (image != null) {
            storagePath = "${gigId.toString().lowercase()}/${kind.wireValue}.jpg"
            api.upload("proofs", storagePath, image, "image/jpeg")
        }
        val body = buildJsonObject {
            put("gig_id", gigId.toString().lowercase()); put("worker_id", uid)
            put("kind", kind.wireValue); put("storage_path", storagePath)
            // The device's capture time, not the upload time — punctuality is
            // judged from this, so it must reflect when the photo was taken.
            put("captured_at", WireDate.format(capturedAt))
            latitude?.let { put("latitude", it) }
            longitude?.let { put("longitude", it) }
        }
        val row = array(api.insert("proof_of_work", body.toString())).firstOrNull()
        return ProofPhoto(
            id = row?.uuid("id") ?: UUID.randomUUID(), gigId = gigId, kind = kind,
            storagePath = storagePath,
            capturedAtLabel = android.text.format.DateFormat.format("d MMM HH:mm", capturedAt).toString(),
            latitude = latitude, longitude = longitude,
        )
    }

    override suspend fun cashOut(amount: Double): String {
        val body = buildJsonObject {
            put("user_id", uid); put("kind", TxKind.CASH_OUT.wireValue)
            put("amount_zmw", -amount); put("note", "Cash out")
        }
        api.insert("wallet_transactions", body.toString())
        return "Sent ${amount.kwacha()} to your mobile money."
    }

    override suspend fun requestAdvance(gigId: UUID, amount: Double): String {
        val args = buildJsonObject {
            put("p_gig_id", gigId.toString().lowercase()); put("p_amount", amount)
        }
        return api.rpc("request_wage_advance", args.toString()).asScalarString()
    }

    override suspend fun setWorkRecordSharing(isPublic: Boolean, rotate: Boolean): String {
        val args = buildJsonObject { put("p_public", isPublic); put("p_rotate", rotate) }
        return api.rpc("set_work_record_sharing", args.toString()).asScalarString()
    }

    override suspend fun setChannelPin(pin: String) {
        // Hashed with bcrypt server-side, which re-applies the same rules; the
        // PIN itself never touches storage on the device.
        api.rpc("set_channel_pin", buildJsonObject { put("p_pin", pin) }.toString())
    }
}

/** kotlinx's `contentOrNull` treats JSON null inconsistently across versions. */
private fun kotlinx.serialization.json.JsonPrimitive.contentOrNullSafe(): String? =
    if (this is kotlinx.serialization.json.JsonNull) null else content
