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

    companion object { const val DEMO_OTP = "123456" }

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
