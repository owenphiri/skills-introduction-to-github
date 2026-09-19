package com.owenphiri.nchito.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Single ViewModel backing the whole MVP, on mock data.
 * Production swaps the mutators for Supabase calls:
 *  - auth: GoTrue phone OTP (POST /auth/v1/otp, /auth/v1/verify)
 *  - chat: insert into `messages`, subscribe via Realtime
 *  - wallet: read-only ledger + Edge Function cash-out
 */
class AppViewModel : ViewModel() {

    companion object {
        const val DEMO_OTP = "123456"

        /** Lives in one place so the shortcode never drifts between screens. */
        const val USSD_SHORTCODE = "*384*62448#"

        /** The handful guessed first; refused server-side too. */
        val TOO_COMMON_PINS = setOf(
            "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777",
            "8888", "9999", "1234", "4321", "1212", "0123",
        )
    }

    // Auth
    var signedInPhone by mutableStateOf("")
        private set
    var otpSentTo by mutableStateOf<String?>(null)
        private set
    var authError by mutableStateOf<String?>(null)
        private set
    val isSignedIn get() = signedInPhone.isNotEmpty()
    val isDemoMode get() = !SupabaseConfig.isConfigured

    fun requestOtp(raw: String) {
        authError = null
        val digits = raw.filter { it.isDigit() }
            .removePrefix("260").removePrefix("0")
        val prefixes = listOf("95", "96", "97", "75", "76", "77")
        if (digits.length != 9 || prefixes.none { digits.startsWith(it) }) {
            authError = "Enter a valid Zambian number, e.g. 097 123 4567."
            return
        }
        otpSentTo = "+260$digits"
    }

    fun verifyOtp(code: String) {
        val phone = otpSentTo ?: return
        if (code == DEMO_OTP) {
            signedInPhone = phone
            authError = null
        } else {
            authError = "Wrong code. In demo mode the code is $DEMO_OTP."
        }
    }

    fun changeNumber() { otpSentTo = null; authError = null }
    fun signOut() { signedInPhone = ""; otpSentTo = null }

    // Gigs
    val gigs = mutableStateListOf<Gig>().apply { addAll(MockData.gigs) }
    val appliedGigIds = mutableStateListOf<UUID>()

    fun apply(gig: Gig) {
        if (gig.id in appliedGigIds) return
        appliedGigIds.add(gig.id)
        val i = gigs.indexOfFirst { it.id == gig.id }
        if (i >= 0) gigs[i] = gigs[i].copy(applicants = gigs[i].applicants + 1)
    }

    fun postGig(gig: Gig) = gigs.add(0, gig)

    // Micro-tasks
    val microTasks = mutableStateListOf<MicroTask>().apply { addAll(MockData.microTasks) }

    fun complete(task: MicroTask) {
        val i = microTasks.indexOfFirst { it.id == task.id }
        if (i < 0 || microTasks[i].isCompleted) return
        microTasks[i] = microTasks[i].copy(
            isCompleted = true,
            slotsLeft = (microTasks[i].slotsLeft - 1).coerceAtLeast(0))
        transactions.add(0, WalletTransaction(
            kind = TxKind.TASK_REWARD, amountZMW = task.rewardZMW, note = task.title))
    }

    // Wallet
    val transactions = mutableStateListOf<WalletTransaction>().apply { addAll(MockData.transactions) }
    var payoutProvider by mutableStateOf(MobileMoneyProvider.MTN_MOMO)

    val walletBalance: Double get() = transactions.sumOf { it.amountZMW }

    fun cashOut(amount: Double): Boolean {
        if (amount <= 0 || amount > walletBalance) return false
        transactions.add(0, WalletTransaction(
            kind = TxKind.CASH_OUT, amountZMW = -amount,
            note = "Cash out to ${payoutProvider.label}"))
        return true
    }

    // USSD & WhatsApp access (INNOVATION.md §2.1)
    var hasChannelPin by mutableStateOf(false)
        private set

    /**
     * Production calls `set_channel_pin()`, which hashes with bcrypt and applies
     * the same rules. The PIN itself is never stored on the device.
     */
    fun setChannelPin(pin: String): Boolean {
        if (pin.length != 4 || !pin.all { it.isDigit() } || pin in TOO_COMMON_PINS) return false
        hasChannelPin = true
        return true
    }

    // Work Record (INNOVATION.md §1.2)
    val workRecord = mutableStateListOf<WorkRecordEntry>().apply { addAll(MockData.workRecordEntries) }

    /**
     * Private until the worker opts in — employment history is sensitive, and
     * the slug can be rotated to revoke a link already handed out.
     */
    var workRecordSharing by mutableStateOf(WorkRecordSharing())
        private set

    val workRecordSummary: WorkRecordSummary
        get() = WorkRecordService.summary(workRecord, MockData.memberSince)

    fun setWorkRecordPublic(isPublic: Boolean) {
        workRecordSharing = workRecordSharing.copy(isPublic = isPublic)
    }

    /** Issues a new slug, which invalidates any link already shared. */
    fun rotateWorkRecordLink() {
        val alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
        workRecordSharing = workRecordSharing.copy(
            slug = (1..8).map { alphabet.random() }.joinToString(""))
    }

    fun exportWorkRecordCv(context: android.content.Context) = CvExporter.export(
        context = context,
        fullName = "Owen Phiri",
        city = "Lusaka",
        phone = signedInPhone.ifEmpty { "+260 97 000 0000" },
        verification = "NRC Verified",
        entries = workRecord,
        summary = workRecordSummary,
        sharing = workRecordSharing,
    )

    // Proof of work (INNOVATION.md §4.1)
    val proofPhotos = mutableStateListOf<ProofPhoto>().apply { addAll(MockData.proofPhotos) }

    fun proofStatus(gig: Gig): ProofStatus {
        val forGig = proofPhotos.filter { it.gigId == gig.id }
        return ProofStatus(
            before = forGig.firstOrNull { it.kind == ProofKind.BEFORE },
            after = forGig.firstOrNull { it.kind == ProofKind.AFTER },
        )
    }

    /**
     * Records a capture. Demo mode simulates the photo and stamps Lusaka
     * coordinates; production uploads to the `proofs` bucket and reads the real
     * device location and capture time.
     */
    fun captureProof(kind: ProofKind, gig: Gig) {
        if (proofPhotos.any { it.gigId == gig.id && it.kind == kind }) return
        val now = SimpleDateFormat("d MMM HH:mm", Locale.getDefault()).format(Date())
        proofPhotos.add(ProofPhoto(gigId = gig.id, kind = kind, capturedAtLabel = now,
                                   latitude = -15.3875, longitude = 28.3228))
    }

    /** Mirrors the guard inside `release_escrow()`: no complete proof, no payment. */
    fun canReleaseEscrow(gig: Gig): Boolean = proofStatus(gig).isComplete

    // Pricing (INNOVATION.md §5.1)

    /**
     * Bands come from settled gigs only, so a flood of optimistic open listings
     * can't drag the suggested rate around.
     */
    fun priceBand(category: GigCategory, city: String): PriceBand? =
        PricingService.band(category, city, MockData.settledGigs)

    // Chat
    val conversations = mutableStateListOf<Conversation>().apply { addAll(MockData.conversations) }
    val messages = mutableStateListOf<ChatMessage>().apply { addAll(MockData.messages) }

    fun messagesIn(conversation: Conversation) =
        messages.filter { it.conversationId == conversation.id }

    fun send(body: String, conversation: Conversation) {
        val trimmed = body.trim()
        if (trimmed.isEmpty()) return
        val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        messages.add(ChatMessage(conversationId = conversation.id,
                                 isMine = true, body = trimmed, time = time))
    }

    fun conversationAbout(gig: Gig): Conversation {
        conversations.firstOrNull { it.gigId == gig.id }?.let { return it }
        val convo = Conversation(counterpartName = gig.posterName,
                                 counterpartRating = gig.posterRating,
                                 gigId = gig.id, gigTitle = gig.title)
        conversations.add(0, convo)
        return convo
    }
}
