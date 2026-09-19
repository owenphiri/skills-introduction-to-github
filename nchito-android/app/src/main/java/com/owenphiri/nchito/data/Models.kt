package com.owenphiri.nchito.data

import java.util.UUID

// Mirrors nchito-ios/Nchito/Models — keep the two in sync with the
// Supabase schema in nchito-ios/supabase/migrations/0001_init.sql.

enum class MobileMoneyProvider(val label: String) {
    MTN_MOMO("MTN MoMo"),
    AIRTEL_MONEY("Airtel Money"),
    ZAMTEL_KWACHA("Zamtel Kwacha"),
}

enum class GigCategory(val label: String) {
    DELIVERY("Delivery & Errands"),
    HOME_SERVICES("Home Services"),
    TUTORING("Tutoring & Lessons"),
    DIGITAL("Digital & Design"),
    EVENTS("Events & Catering"),
    FARM("Farm & Garden"),
    BEAUTY("Beauty & Care"),
    REPAIRS("Repairs & Technical"),
}

data class Gig(
    val id: UUID = UUID.randomUUID(),
    val title: String,
    val details: String,
    val category: GigCategory,
    val payZMW: Double,
    val city: String,
    val area: String,
    val posterName: String,
    val posterRating: Double,
    val minutesAgo: Int,
    val isUrgent: Boolean = false,
    val isBoosted: Boolean = false,
    val applicants: Int = 0,
    /** Gigs this poster and the current user have already settled together. */
    val completedWithPoster: Int = 0,
    val status: GigStatus = GigStatus.OPEN,
) {
    val commissionTier: CommissionTier get() = CommissionTier.forCount(completedWithPoster)
    val commissionRate: Double get() = commissionTier.rate
    val commissionAmount: Double get() = payZMW * commissionRate
    val workerPayout: Double get() = payZMW - commissionAmount

    /** What the worker would keep at the next tier, if there is one. */
    val payoutAtNextTier: Double?
        get() = commissionTier.next()?.let { payZMW * (1 - it.rate) }
}

enum class GigStatus(val label: String) {
    OPEN("Open"),
    ASSIGNED("In Progress"),
    COMPLETED("Completed"),
    PAID("Paid Out"),
}

/**
 * Loyalty-decaying commission — see nchito-ios/INNOVATION.md §1.1.
 *
 * A flat rate forever is a standing invitation to settle in cash off-platform.
 * The rate falls as a poster and worker build history together, so the saving
 * from leaving stops covering what they'd lose: escrow, recourse, and credit
 * toward their Work Record.
 *
 * Mirrors `commission_rate()` in 0002_phase1_defensibility.sql.
 */
enum class CommissionTier(val rate: Double, val label: String) {
    STANDARD(0.10, "Standard"),
    TRUSTED(0.07, "Trusted pair"),
    PARTNER(0.05, "Partner rate");

    val ratePercent: String get() = "${(rate * 100).toInt()}%"

    fun next(): CommissionTier? = when (this) {
        STANDARD -> TRUSTED
        TRUSTED -> PARTNER
        PARTNER -> null
    }

    /** Gigs still needed with this counterpart to reach the next tier. */
    fun gigsToNextTier(completedTogether: Int): Int? = when (this) {
        STANDARD -> GIGS_FOR_TRUSTED - completedTogether
        TRUSTED -> GIGS_FOR_PARTNER - completedTogether
        PARTNER -> null
    }

    companion object {
        const val GIGS_FOR_TRUSTED = 3
        const val GIGS_FOR_PARTNER = 10

        /** Only settled gigs count, so the discount is earned through real work. */
        fun forCount(completedTogether: Int): CommissionTier = when {
            completedTogether >= GIGS_FOR_PARTNER -> PARTNER
            completedTogether >= GIGS_FOR_TRUSTED -> TRUSTED
            else -> STANDARD
        }
    }
}

/**
 * Proof-of-work capture — see nchito-ios/INNOVATION.md §4.1.
 * Mirrors the `proof_of_work` table in 0002_phase1_defensibility.sql.
 */
enum class ProofKind(val label: String, val prompt: String) {
    BEFORE("Before", "Photograph the job before you start"),
    AFTER("After", "Photograph the finished work"),
}

data class ProofPhoto(
    val id: UUID = UUID.randomUUID(),
    val gigId: UUID,
    val kind: ProofKind,
    /** Object in the `proofs` storage bucket; empty while in demo mode. */
    val storagePath: String = "",
    val capturedAtLabel: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
) {
    val hasLocation: Boolean get() = latitude != null && longitude != null
}

data class ProofStatus(
    val before: ProofPhoto? = null,
    val after: ProofPhoto? = null,
) {
    val isComplete: Boolean get() = before != null && after != null

    fun photoFor(kind: ProofKind): ProofPhoto? =
        if (kind == ProofKind.BEFORE) before else after

    val missing: List<ProofKind> get() = ProofKind.entries.filter { photoFor(it) == null }

    /** Matches the guard in `release_escrow()`: no complete proof, no payment. */
    val releaseBlockedReason: String?
        get() = if (isComplete) null
                else "${missing.joinToString(" and ") { it.label }} photo required before payment can be released"
}

enum class MicroTaskKind(val label: String) {
    SURVEY("Survey"),
    APP_TEST("App Testing"),
    DATA_LABEL("Data Labelling"),
    SOCIAL("Social Boost"),
    MYSTERY_SHOP("Mystery Shopper"),
}

data class MicroTask(
    val id: UUID = UUID.randomUUID(),
    val title: String,
    val kind: MicroTaskKind,
    val rewardZMW: Double,
    val minutes: Int,
    val slotsLeft: Int,
    val isCompleted: Boolean = false,
)

enum class TxKind(val label: String) {
    GIG_PAYOUT("Gig Payout"),
    TASK_REWARD("Task Reward"),
    REFERRAL_BONUS("Referral Bonus"),
    CASH_OUT("Cash Out"),
    WAGE_ADVANCE("Early Payment"),
    ADVANCE_REPAYMENT("Early Payment Repaid"),
    ADVANCE_RECOVERY("Early Payment Owed Back"),
}

data class WalletTransaction(
    val id: UUID = UUID.randomUUID(),
    val kind: TxKind,
    val amountZMW: Double, // negative = outflow
    val note: String,
)

data class Conversation(
    val id: UUID = UUID.randomUUID(),
    val counterpartName: String,
    val counterpartRating: Double,
    val gigId: UUID?,
    val gigTitle: String,
)

data class ChatMessage(
    val id: UUID = UUID.randomUUID(),
    val conversationId: UUID,
    val isMine: Boolean,
    val body: String,
    val time: String,
)

fun Double.kwacha(): String =
    if (this % 1.0 == 0.0) "K${this.toLong()}" else "K${"%.2f".format(this)}"
