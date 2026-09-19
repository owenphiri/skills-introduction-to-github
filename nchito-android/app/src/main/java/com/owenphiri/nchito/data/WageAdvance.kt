package com.owenphiri.nchito.data

import java.util.Date
import java.util.UUID
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToLong

/**
 * Earned wage access — see nchito-ios/INNOVATION.md §3.2.
 *
 * The single reason a worker takes a cash job over a Nchito gig is that cash
 * pays today. This closes that gap: once work is verifiably underway, part of
 * the payout is released immediately.
 *
 * It is not a loan. The poster has already funded escrow, so Nchito is holding
 * this worker's money — an advance is early release of funds already deposited
 * against work already started. Nothing accrues, there is no interest, and the
 * flat fee is quoted in kwacha before the worker agrees.
 *
 * Mirrors `wage_advances` in 0005_wage_advances.sql.
 */
enum class AdvanceStatus(val label: String) {
    OUTSTANDING("Comes off your next payout"),
    SETTLED("Repaid"),
    RECOVERING("Owed back — gig not completed"),
    WRITTEN_OFF("Written off"),
}

data class WageAdvance(
    val id: UUID = UUID.randomUUID(),
    val gigId: UUID,
    val gigTitle: String,
    val amountZMW: Double,
    val feeZMW: Double,
    val status: AdvanceStatus = AdvanceStatus.OUTSTANDING,
    val createdAt: Date = Date(),
) {
    val totalDueZMW: Double get() = amountZMW + feeZMW
}

/**
 * The offer for one gig, or the reason there isn't one.
 *
 * A refusal always carries a sentence explaining itself — greying out a button
 * with no reason is how a worker concludes the feature is broken and stops
 * looking for it.
 */
data class AdvanceOffer(
    val isEligible: Boolean,
    val maxAmount: Double,
    val reason: String,
) {
    companion object {
        fun ineligible(reason: String) = AdvanceOffer(false, 0.0, reason)
    }
}

object AdvanceTerms {
    /**
     * Share of the worker's payout that may be released early. Half leaves
     * ample headroom for the fee and for a commission tier that is never worse
     * than the one quoted, so repayment is always covered by the escrow.
     */
    const val MAX_SHARE = 0.50

    const val FEE_RATE = 0.04
    const val MINIMUM_FEE = 5.0

    /** Below this a gig isn't worth the paperwork for either side. */
    const val MINIMUM_ADVANCE = 20.0

    /** Standing thresholds, read from the Work Record. */
    const val MINIMUM_COMPLETED_JOBS = 3
    const val MINIMUM_ON_TIME_RATE = 0.6

    /**
     * Flat service fee — not interest. It does not compound and does not grow
     * if settlement takes longer.
     */
    fun fee(amount: Double): Double =
        max((amount * FEE_RATE * 100).roundToLong() / 100.0, MINIMUM_FEE)

    fun maxAdvance(payout: Double): Double = floor(payout * MAX_SHARE)
}
