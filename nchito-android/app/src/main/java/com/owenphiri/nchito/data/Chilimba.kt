package com.owenphiri.nchito.data

import java.util.UUID

/**
 * A rotating savings circle — INNOVATION.md §3.3, schema in
 * nchito-ios/supabase/migrations/0011_digital_chilimba.sql.
 *
 * Everything here that is not obvious exists because of how these go wrong in
 * practice. A member who collects the pot and then stops paying is the entire
 * risk in a chilimba, which is why [ChilimbaMember.netPosition] and
 * [ChilimbaMember.exitCost] are modelled rather than left for the UI to work
 * out and possibly get wrong.
 */
enum class ChilimbaStatus { FORMING, ACTIVE, COMPLETED, CANCELLED }

enum class ChilimbaCadence(val wire: String, val days: Int, val label: String) {
    WEEKLY("weekly", 7, "Every week"),
    FORTNIGHTLY("fortnightly", 14, "Every two weeks"),
    MONTHLY("monthly", 30, "Every month"),
    ;

    companion object {
        fun fromWire(wire: String): ChilimbaCadence? = entries.firstOrNull { it.wire == wire }
    }
}

data class ChilimbaMember(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    /**
     * Null while the circle is forming: the order is drawn at random when it
     * fills, never first-come, because first-come always puts whoever started
     * the circle at the front.
     */
    val position: Int? = null,
    val isActive: Boolean = true,
    val isMe: Boolean = false,
    val hasPaidThisRound: Boolean = false,
    val paidInZMW: Double = 0.0,
    val receivedZMW: Double = 0.0,
) {
    /** Positive means they have put in more than they have taken out. */
    val netPosition: Double get() = paidInZMW - receivedZMW

    /** What leaving now would take out of the other members' pockets. */
    val exitCost: Double get() = maxOf(receivedZMW - paidInZMW, 0.0)

    val mayLeave: Boolean get() = netPosition >= 0
}

data class ChilimbaCircle(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    val contributionZMW: Double,
    val cadence: ChilimbaCadence = ChilimbaCadence.MONTHLY,
    val status: ChilimbaStatus = ChilimbaStatus.FORMING,
    val currentRound: Int = 0,
    val memberTarget: Int = 5,
    /** Only while forming — once a circle starts its order is already drawn. */
    val inviteCode: String? = null,
    val members: List<ChilimbaMember> = emptyList(),
    /**
     * Off unless the member turns it on. Taking a slice of somebody's payout
     * without them choosing it is a deduction, not a savings feature.
     */
    val autoContribute: Boolean = false,
) {
    val activeMembers: List<ChilimbaMember> get() = members.filter { it.isActive }
    val pot: Double get() = contributionZMW * activeMembers.size
    val me: ChilimbaMember? get() = members.firstOrNull { it.isMe }

    /**
     * Whose turn this round is, or null when that member has left — the round
     * is skipped rather than handed to somebody else.
     */
    val recipient: ChilimbaMember? get() = activeMembers.firstOrNull { it.position == currentRound }

    val membersOutstanding: List<ChilimbaMember> get() = activeMembers.filter { !it.hasPaidThisRound }

    /** The pot moves only when everybody has paid. Nobody collects a short one. */
    val roundIsComplete: Boolean get() = membersOutstanding.isEmpty()
}

/**
 * Whether somebody can take on another circle, and the numbers behind the
 * answer — shown as it is decided, not only when it refuses. Nobody should
 * discover a cap by being told no.
 */
data class ChilimbaAffordability(
    val isAffordable: Boolean,
    val obligationZMW: Double,
    val existingObligationZMW: Double,
    val recentIncomeZMW: Double,
    val reason: String,
) {
    val capZMW: Double get() = recentIncomeZMW * INCOME_SHARE

    companion object {
        /**
         * Circles are capped at this share of recent Nchito earnings, counting
         * the ones already joined. A missed cycle costs the other members, not
         * just the person who missed it.
         */
        const val INCOME_SHARE = 0.25

        fun assess(
            contribution: Double,
            cadence: ChilimbaCadence,
            recentIncome: Double,
            existing: Double,
        ): ChilimbaAffordability {
            val obligation = contribution * (90.0 / cadence.days)
            val cap = recentIncome * INCOME_SHARE
            return when {
                recentIncome <= 0 -> ChilimbaAffordability(
                    false, obligation, existing, recentIncome,
                    "You have not been paid through Nchito in the last 90 days, so there is " +
                        "nothing to judge this against. Finish a gig first.")
                obligation + existing > cap -> ChilimbaAffordability(
                    false, obligation, existing, recentIncome,
                    "This would commit K${(obligation + existing).toInt()} over 90 days against " +
                        "K${recentIncome.toInt()} earned. Circles are capped at " +
                        "${(INCOME_SHARE * 100).toInt()}% of recent income, because a missed " +
                        "cycle costs the other members, not just you.")
                else -> ChilimbaAffordability(true, obligation, existing, recentIncome, "ok")
            }
        }
    }
}

/**
 * A recording attached to a gig, an application or a message.
 *
 * This is the whole of "speak instead of typing" that works today. Nothing off
 * the shelf transcribes any Zambian language, so [transcript] stays null rather
 * than being filled with a guess, and the other person simply listens — which
 * is how people already send job instructions on WhatsApp.
 */
data class VoiceNote(
    val id: UUID = UUID.randomUUID(),
    val subject: String,          // gig | message | application
    val subjectId: UUID,
    val storagePath: String,
    val durationSeconds: Double,
    val language: String = "en",
    /** Null until a person or a model produces one. Never invented. */
    val transcript: String? = null,
    /**
     * Explicit, revocable, off by default. A recording of someone's voice is
     * not ours to train on because they happened to use the app.
     */
    val corpusConsent: Boolean = false,
)
