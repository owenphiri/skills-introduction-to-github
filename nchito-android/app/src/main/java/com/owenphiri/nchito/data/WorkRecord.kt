package com.owenphiri.nchito.data

import java.util.Calendar
import java.util.Date
import java.util.UUID
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The Work Record — see nchito-ios/INNOVATION.md §1.2.
 *
 * One signed entry per settled gig. Because entries are written only by
 * `release_escrow()`, every line represents money that actually moved through
 * escrow — a history that cannot be self-reported, which is what makes it worth
 * showing an employer or a lender.
 *
 * Mirrors the `work_records` table in 0003_work_record.sql.
 */
data class WorkRecordEntry(
    val id: UUID = UUID.randomUUID(),
    val gigId: UUID = UUID.randomUUID(),
    val title: String,
    val category: GigCategory,
    val city: String,
    val payZMW: Double,
    val completedAt: Date,
    val posterRating: Double?,
    val onTime: Boolean,
    /**
     * Hex HMAC over the entry's canonical content, checked by
     * `verify_work_record()`. False means the row was altered after issue and
     * must not be presented as verified.
     */
    val signature: String = "",
    val isVerified: Boolean = true,
)

data class WorkRecordSummary(
    val totalGigs: Int,
    val totalEarnedZMW: Double,
    val onTimeRate: Double?,        // 0–1, null until there's history
    val averageRating: Double?,
    val memberSince: Date,
    val topCategories: List<Pair<GigCategory, Int>>,
) {
    val isEmpty: Boolean get() = totalGigs == 0

    val onTimePercent: String
        get() = onTimeRate?.let { "${(it * 100).roundToInt()}%" } ?: "—"

    val ratingText: String
        get() = averageRating?.let { String.format("%.1f★", it) } ?: "—"

    private val monthsActive: Int
        get() {
            val start = Calendar.getInstance().apply { time = memberSince }
            val now = Calendar.getInstance()
            return (now.get(Calendar.YEAR) - start.get(Calendar.YEAR)) * 12 +
                   (now.get(Calendar.MONTH) - start.get(Calendar.MONTH))
        }

    val tenureText: String
        get() = when {
            monthsActive < 1 -> "New this month"
            monthsActive < 12 -> "$monthsActive month${if (monthsActive == 1) "" else "s"} on Nchito"
            else -> {
                val years = monthsActive / 12
                "$years year${if (years == 1) "" else "s"} on Nchito"
            }
        }

    /**
     * A deliberately simple, explainable reliability score out of 100.
     *
     * Anything a lender might price risk from has to be defensible line by line,
     * so this is a transparent weighted sum rather than an opaque model: volume
     * of settled work, punctuality, rating, and tenure.
     *
     * Punctuality and rating are shrunk toward a neutral prior, because a
     * perfect record over one job is not evidence of anything — without this, a
     * single flawless gig scores about the same as fifteen good ones.
     */
    val reliabilityScore: Int?
        get() {
            if (totalGigs == 0) return null
            val n = totalGigs.toDouble()
            val k = PRIOR_WEIGHT

            // Volume saturates at 50 gigs — beyond that, more work says little extra.
            val volume = min(n / 50.0, 1.0) * 40

            val shrunkOnTime = ((onTimeRate ?: NEUTRAL_ON_TIME) * n + NEUTRAL_ON_TIME * k) / (n + k)
            val punctuality = shrunkOnTime * 30

            val shrunkRating = ((averageRating ?: NEUTRAL_RATING) * n + NEUTRAL_RATING * k) / (n + k)
            val quality = (shrunkRating / 5.0) * 20

            val tenure = min(monthsActive / 12.0, 1.0) * 10
            return (volume + punctuality + quality + tenure).roundToInt()
        }

    companion object {
        /**
         * Weight given to the neutral prior when shrinking rates. Five is
         * roughly where a worker's own numbers start outweighing the assumption.
         */
        const val PRIOR_WEIGHT = 5.0
        const val NEUTRAL_ON_TIME = 0.5
        const val NEUTRAL_RATING = 3.5
    }

    val scoreBand: String
        get() = when (val s = reliabilityScore) {
            null -> "Not yet rated"
            in 80..Int.MAX_VALUE -> "Excellent"
            in 60..79 -> "Strong"
            in 40..59 -> "Building"
            else -> "Getting started"
        }
}

/**
 * Opt-in sharing. Employment history is sensitive, so a record stays private
 * until the worker chooses otherwise, and the link can be rotated to revoke
 * access already granted.
 */
data class WorkRecordSharing(
    val isPublic: Boolean = false,
    val slug: String = "k7mq2xrp",
) {
    val shareUrl: String get() = "https://nchito.zm/w/$slug"

    val shareMessage: String
        get() = "Here's my verified Nchito work record — every job on it was paid through escrow: $shareUrl"
}

object WorkRecordService {

    fun summary(entries: List<WorkRecordEntry>, memberSince: Date): WorkRecordSummary {
        val ratings = entries.mapNotNull { it.posterRating }
        val categories = entries.groupBy { it.category }
            .map { (category, list) -> category to list.size }
            .sortedByDescending { it.second }

        return WorkRecordSummary(
            totalGigs = entries.size,
            totalEarnedZMW = entries.sumOf { it.payZMW },
            onTimeRate = if (entries.isEmpty()) null
                         else entries.count { it.onTime }.toDouble() / entries.size,
            averageRating = if (ratings.isEmpty()) null else ratings.average(),
            memberSince = memberSince,
            topCategories = categories.take(4),
        )
    }
}
