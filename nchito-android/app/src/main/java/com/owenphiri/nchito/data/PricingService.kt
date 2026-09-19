package com.owenphiri.nchito.data

/**
 * Fair-price bands — see nchito-ios/INNOVATION.md §5.1.
 *
 * Posting into a market with no reference prices leads to lowballing and slow,
 * hesitant posting. Quoting what comparable work actually settled at makes the
 * marketplace feel fair to both sides.
 *
 * Mirrors `price_band()` in 0002_phase1_defensibility.sql, and the iOS
 * PricingService, using the same linear-interpolation percentile so all three
 * agree on the same numbers.
 */
data class PriceBand(
    val low: Double,      // 25th percentile
    val median: Double,
    val high: Double,     // 75th percentile
    val sampleSize: Int,
    /** False when the local market was too thin and we widened to nationwide. */
    val isLocal: Boolean,
) {
    enum class Verdict(val message: String) {
        LOW("Below the going rate — you may get few applicants"),
        FAIR("In line with similar gigs"),
        HIGH("Above the going rate — expect fast applications"),
    }

    fun verdictFor(price: Double): Verdict = when {
        price < low -> Verdict.LOW
        price > high -> Verdict.HIGH
        else -> Verdict.FAIR
    }

    val rangeText: String get() = "${low.kwacha()}–${high.kwacha()}"

    val sourceText: String
        get() = "$sampleSize similar ${if (isLocal) "local " else ""}gig${if (sampleSize == 1) "" else "s"}"
}

object PricingService {
    /**
     * Below this, a sample says more about who happened to post than about the
     * market, so we widen the search rather than advise from noise.
     */
    const val MINIMUM_SAMPLE = 5

    /** Returns null when there isn't enough history — callers must show nothing. */
    fun band(category: GigCategory, city: String, gigs: List<Gig>): PriceBand? {
        val comparable = gigs.filter { it.category == category }
        val local = comparable.filter { it.city == city }
        val useLocal = local.size >= MINIMUM_SAMPLE
        val sample = if (useLocal) local else comparable

        if (sample.size < MINIMUM_SAMPLE) return null

        val prices = sample.map { it.payZMW }.sorted()
        return PriceBand(
            low = percentile(prices, 0.25),
            median = percentile(prices, 0.50),
            high = percentile(prices, 0.75),
            sampleSize = prices.size,
            isLocal = useLocal,
        )
    }

    /** Same method as Postgres's `percentile_cont`, so app and database agree. */
    private fun percentile(sorted: List<Double>, p: Double): Double {
        if (sorted.isEmpty()) return 0.0
        if (sorted.size == 1) return sorted[0]

        val position = p * (sorted.size - 1)
        val lowerIndex = position.toInt()
        val upperIndex = minOf(lowerIndex + 1, sorted.size - 1)
        val weight = position - lowerIndex

        val interpolated = sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight
        return Math.round(interpolated * 100) / 100.0
    }
}
