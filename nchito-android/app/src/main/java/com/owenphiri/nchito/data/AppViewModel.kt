package com.owenphiri.nchito.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
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
/** Replaces a state list's contents in place, so Compose sees one update. */
private fun <T> androidx.compose.runtime.snapshots.SnapshotStateList<T>.replaceAll(items: List<T>) {
    clear(); addAll(items)
}

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

    // Backend

    /**
     * LiveRepository when Supabase is configured, MockRepository otherwise.
     * Demo mode has been a design rule from the start — the app stays fully
     * demoable with no backend, for pitches, screenshots and offline work.
     */
    private var repository: NchitoRepository = MockRepository()
    private val api = NchitoApi()

    var isLoading by mutableStateOf(false)
        private set
    /** Set when a load fails, so the user sees a reason rather than a blank screen. */
    var loadError by mutableStateOf<String?>(null)

    val isLive: Boolean get() = SupabaseConfig.isConfigured

    /**
     * Called once signed in. Until then there is no token, and PostgREST falls
     * back to the anon role and quietly returns nothing.
     */
    fun connect(accessToken: String, userId: UUID) {
        if (!SupabaseConfig.isConfigured || accessToken.isEmpty()) return
        api.setAccessToken(accessToken)
        repository = LiveRepository(api, userId)
        refresh()
    }

    /** Loads everything the tabs need, concurrently where the reads are independent. */
    fun refresh() {
        viewModelScope.launch {
            isLoading = true
            loadError = null
            try {
                // On Zambian mobile data, sequential round trips are visibly slow.
                val gigsJob = async { repository.loadGigs(null, null) }
                val tasksJob = async { repository.loadMicroTasks() }
                val ledgerJob = async { repository.loadTransactions() }
                val chatsJob = async { repository.loadConversations() }
                val appliedJob = async { repository.loadAppliedGigIds() }
                val recordJob = async { repository.loadWorkRecord() }
                val advancesJob = async { repository.loadAdvances() }

                gigs.replaceAll(gigsJob.await())
                microTasks.replaceAll(tasksJob.await())
                transactions.replaceAll(ledgerJob.await())
                conversations.replaceAll(chatsJob.await())
                appliedGigIds.replaceAll(appliedJob.await())
                workRecord.replaceAll(recordJob.await())
                advances.replaceAll(advancesJob.await())

                proofPhotos.replaceAll(repository.loadProofPhotos(appliedGigIds.toList()))
            } catch (e: Exception) {
                loadError = e.message
                    ?: "Couldn't load your data. Check your connection and pull to refresh."
            } finally {
                isLoading = false
            }
        }
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

    var isAuthBusy by mutableStateOf(false)
        private set

    fun requestOtp(raw: String) {
        authError = null
        val digits = raw.filter { it.isDigit() }
            .removePrefix("260").removePrefix("0")
        val prefixes = listOf("95", "96", "97", "75", "76", "77")
        if (digits.length != 9 || prefixes.none { digits.startsWith(it) }) {
            authError = "Enter a valid Zambian number, e.g. 097 123 4567."
            return
        }
        val phone = "+260$digits"

        if (isDemoMode) { otpSentTo = phone; return }

        viewModelScope.launch {
            isAuthBusy = true
            try {
                AuthApi.requestOtp(phone)
                otpSentTo = phone
            } catch (e: Exception) {
                authError = "Couldn't send the code. Check your connection and try again."
            } finally {
                isAuthBusy = false
            }
        }
    }

    fun verifyOtp(code: String) {
        val phone = otpSentTo ?: return
        authError = null

        if (isDemoMode) {
            if (code == DEMO_OTP) signedInPhone = phone
            else authError = "Wrong code. In demo mode the code is $DEMO_OTP."
            return
        }

        viewModelScope.launch {
            isAuthBusy = true
            try {
                val session = AuthApi.verifyOtp(phone, code)
                signedInPhone = phone
                // Only now is there a token; without it PostgREST falls back to
                // the anon role and RLS returns nothing.
                connect(session.accessToken, session.userId)
            } catch (e: Exception) {
                authError = "That code didn't work. Request a new one and try again."
            } finally {
                isAuthBusy = false
            }
        }
    }

    fun changeNumber() { otpSentTo = null; authError = null }
    fun signOut() { signedInPhone = ""; otpSentTo = null }

    // Gigs
    val gigs = mutableStateListOf<Gig>().apply { addAll(MockData.gigs) }
    val appliedGigIds = mutableStateListOf<UUID>()

    /**
     * Updates the UI immediately and reconciles after. A worker on a slow
     * connection tapping Apply should see it land at once; a failed write rolls
     * the change back and surfaces the reason.
     */
    fun apply(gig: Gig) {
        if (gig.id in appliedGigIds) return
        appliedGigIds.add(gig.id)
        val i = gigs.indexOfFirst { it.id == gig.id }
        if (i >= 0) gigs[i] = gigs[i].copy(applicants = gigs[i].applicants + 1)

        viewModelScope.launch {
            try {
                repository.apply(gig.id)
            } catch (e: Exception) {
                appliedGigIds.remove(gig.id)
                if (i >= 0) gigs[i] = gigs[i].copy(applicants = gigs[i].applicants - 1)
                loadError = e.message
            }
        }
    }

    fun postGig(gig: Gig) {
        gigs.add(0, gig)
        viewModelScope.launch {
            try {
                // Replace with the server's copy, which carries the real id.
                val saved = repository.postGig(gig)
                val i = gigs.indexOfFirst { it.id == gig.id }
                if (i >= 0) gigs[i] = saved
            } catch (e: Exception) {
                gigs.removeAll { it.id == gig.id }
                loadError = e.message
            }
        }
    }

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

        viewModelScope.launch {
            try {
                repository.completeTask(task.id)
                // The reward is credited server-side, so re-read the ledger
                // rather than trusting the optimistic row.
                transactions.replaceAll(repository.loadTransactions())
            } catch (e: Exception) {
                microTasks[i] = microTasks[i].copy(isCompleted = false,
                                                   slotsLeft = microTasks[i].slotsLeft + 1)
                transactions.removeAt(0)
                loadError = e.message
            }
        }
    }

    // Wallet
    val transactions = mutableStateListOf<WalletTransaction>().apply { addAll(MockData.transactions) }
    var payoutProvider by mutableStateOf(MobileMoneyProvider.MTN_MOMO)

    val walletBalance: Double get() = transactions.sumOf { it.amountZMW }

    fun cashOut(amount: Double): Boolean {
        if (amount <= 0 || amount > walletBalance) return false
        val pending = WalletTransaction(kind = TxKind.CASH_OUT, amountZMW = -amount,
                                        note = "Cash out to ${payoutProvider.label}")
        transactions.add(0, pending)

        viewModelScope.launch {
            try {
                repository.cashOut(amount)
                // The real disbursement is confirmed by an aggregator webhook,
                // so the server's ledger is the only accurate view.
                transactions.replaceAll(repository.loadTransactions())
            } catch (e: Exception) {
                transactions.remove(pending)
                loadError = e.message
            }
        }
        return true
    }

    // Agent liquidity (INNOVATION.md §3.1)
    val agents = mutableStateListOf<MobileMoneyAgent>().apply { addAll(MockData.agents) }

    /** Ranked so confirmed cash leads; known-dry agents stay listed, not hidden. */
    fun nearbyAgents(): List<MobileMoneyAgent> = LiquidityService.rank(agents)

    /**
     * Records what someone found. This is the whole data source: the map is only
     * as good as its reports, and the natural moment to ask is right after a
     * cash-out, when the answer is fresh and unambiguous.
     */
    fun reportAgent(agent: MobileMoneyAgent, outcome: AgentReportOutcome,
                    amount: Double? = null) {
        val i = agents.indexOfFirst { it.id == agent.id }
        if (i < 0) return
        // Folded in locally so the reporter sees their own contribution at once;
        // the server is authoritative and refresh() reconciles.
        agents[i] = agents[i].copy(
            liquidity = LiquidityService.liquidity(
                listOf(LiquidityService.Report(outcome, amount, Date()))))
    }

    // Earned wage access (INNOVATION.md §3.2)
    val advances = mutableStateListOf<WageAdvance>()

    /**
     * Whatever the worker still owes, if anything. Surfaced plainly so a
     * balance never quietly goes negative with no explanation.
     */
    val outstandingAdvance: WageAdvance?
        get() = advances.firstOrNull {
            it.status == AdvanceStatus.OUTSTANDING || it.status == AdvanceStatus.RECOVERING
        }

    /**
     * Mirrors `advance_eligibility()`. The server re-checks on request, since
     * eligibility can change between drawing the screen and tapping confirm.
     */
    fun advanceOffer(gig: Gig): AdvanceOffer {
        if (gig.id !in appliedGigIds) {
            return AdvanceOffer.ineligible("Advances are only available once a gig is assigned to you.")
        }
        if (advances.any { it.gigId == gig.id && it.status != AdvanceStatus.WRITTEN_OFF }) {
            return AdvanceOffer.ineligible("You have already taken an advance on this gig.")
        }

        // Work must demonstrably have started. The "before" photo carries a
        // device capture time and location, so this is evidence, not a claim —
        // and it is why proof-of-work had to exist before this feature could.
        if (proofStatus(gig).before == null) {
            return AdvanceOffer.ineligible(
                "Take your \"before\" photo on this gig first — that is what shows the work has started.")
        }

        val summary = workRecordSummary
        if (summary.totalGigs < AdvanceTerms.MINIMUM_COMPLETED_JOBS) {
            return AdvanceOffer.ineligible(
                "Complete ${AdvanceTerms.MINIMUM_COMPLETED_JOBS} jobs through Nchito to unlock early payment.")
        }
        if ((summary.onTimeRate ?: 0.0) < AdvanceTerms.MINIMUM_ON_TIME_RATE) {
            return AdvanceOffer.ineligible(
                "Early payment needs most of your recent jobs delivered on time.")
        }

        // One at a time. Stacking advances across gigs is how a worker ends up
        // owing more than they are about to earn.
        if (outstandingAdvance != null) {
            return AdvanceOffer.ineligible("Finish the gig you already took an advance on first.")
        }

        val cap = AdvanceTerms.maxAdvance(gig.workerPayout)
        if (cap < AdvanceTerms.MINIMUM_ADVANCE) {
            return AdvanceOffer.ineligible("This gig is too small for an early payment.")
        }

        return AdvanceOffer(true, cap, "You can take up to ${cap.kwacha()} now.")
    }

    /**
     * Credits the full amount requested; the fee comes off at settlement, so
     * what lands in the wallet is exactly what was quoted.
     */
    fun takeAdvance(gig: Gig, amount: Double): Boolean {
        val offer = advanceOffer(gig)
        if (!offer.isEligible || amount <= 0 || amount > offer.maxAmount) return false

        val fee = AdvanceTerms.fee(amount)
        advances.add(0, WageAdvance(gigId = gig.id, gigTitle = gig.title,
                                    amountZMW = amount, feeZMW = fee))
        transactions.add(0, WalletTransaction(
            kind = TxKind.WAGE_ADVANCE, amountZMW = amount,
            note = "Early payment on ${gig.title}"))

        viewModelScope.launch {
            try {
                // The server re-checks eligibility and recomputes the fee, so
                // reload rather than trusting what this screen assumed.
                repository.requestAdvance(gig.id, amount)
                advances.replaceAll(repository.loadAdvances())
                transactions.replaceAll(repository.loadTransactions())
            } catch (e: Exception) {
                advances.removeAll { it.gigId == gig.id }
                transactions.removeAt(0)
                loadError = e.message
            }
        }
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
        viewModelScope.launch {
            try {
                repository.setChannelPin(pin)
            } catch (e: Exception) {
                hasChannelPin = false
                loadError = e.message
            }
        }
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
        viewModelScope.launch {
            runCatching { repository.setWorkRecordSharing(isPublic, false) }
                .onSuccess { workRecordSharing = workRecordSharing.copy(slug = it) }
        }
    }

    /** Issues a new slug, which invalidates any link already shared. */
    fun rotateWorkRecordLink() {
        viewModelScope.launch {
            try {
                workRecordSharing = workRecordSharing.copy(
                    slug = repository.setWorkRecordSharing(workRecordSharing.isPublic, true))
            } catch (e: Exception) {
                loadError = e.message
            }
        }
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
    /**
     * `image` is null in demo mode, where the capture is simulated. In
     * production the camera supplies the JPEG and location services the
     * coordinates; both are stamped at capture, not at upload.
     */
    fun captureProof(kind: ProofKind, gig: Gig, image: ByteArray? = null,
                     latitude: Double? = null, longitude: Double? = null) {
        if (proofPhotos.any { it.gigId == gig.id && it.kind == kind }) return
        viewModelScope.launch {
            try {
                proofPhotos.add(repository.captureProof(kind, gig.id, image, latitude, longitude))
            } catch (e: Exception) {
                loadError = e.message
            }
        }
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
        val pending = ChatMessage(conversationId = conversation.id,
                                  isMine = true, body = trimmed, time = time)
        messages.add(pending)

        viewModelScope.launch {
            try {
                val saved = repository.sendMessage(trimmed, conversation.id)
                val i = messages.indexOfFirst { it.id == pending.id }
                if (i >= 0) messages[i] = saved
            } catch (e: Exception) {
                messages.remove(pending)
                loadError = e.message
            }
        }
    }

    /**
     * Pulls a thread fresh — production also subscribes to Supabase Realtime on
     * `messages`, but a read on open covers the gap while that connects.
     */
    fun refreshMessages(conversation: Conversation) {
        viewModelScope.launch {
            runCatching { repository.loadMessages(conversation.id) }.onSuccess { fetched ->
                messages.removeAll { it.conversationId == conversation.id }
                messages.addAll(fetched)
            }
        }
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
