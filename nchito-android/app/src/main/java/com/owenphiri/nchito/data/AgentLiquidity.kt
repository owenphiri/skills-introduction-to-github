package com.owenphiri.nchito.data

import java.util.Date
import java.util.UUID
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Mobile money agent liquidity — see nchito-ios/INNOVATION.md §3.1.
 *
 * Field reporting puts the problem exactly: "a wallet credit you cannot convert
 * is not the same thing as money." Agents run out of float, and a worker who
 * can't cash out stops trusting the wallet.
 *
 * The governing constraint: **a false positive costs someone a trip.** Bus fare
 * to a dry agent is real money to someone earning K150 a day, so everything here
 * admits uncertainty rather than guessing.
 *
 * Mirrors 0006_agent_liquidity.sql and the iOS LiquidityService.
 */
enum class AgentStatus(val wireValue: String, val label: String) {
    HAS_CASH("has_cash", "Had cash"),
    NO_CASH("no_cash", "No cash"),
    MIXED("mixed", "Mixed reports"),
    UNKNOWN("unknown", "Not reported recently");

    companion object {
        fun fromWire(wire: String) = entries.firstOrNull { it.wireValue == wire } ?: UNKNOWN
    }
}

enum class AgentReportOutcome(val wireValue: String, val label: String) {
    CASH_AVAILABLE("cash_available", "I got my cash"),
    NO_CASH("no_cash", "They had no cash"),
    CLOSED("closed", "They were closed"),
    NOT_FOUND("not_found", "I couldn't find them"),
}

data class AgentLiquidity(
    val status: AgentStatus,
    val confidence: Double,
    val lastReportAt: Date?,
    /** Largest withdrawal actually confirmed here recently. */
    val confirmedUpTo: Double?,
    val reportCount: Int,
) {
    /** Recency is the whole story with agent float, so it is never hidden. */
    val freshnessText: String
        get() {
            val last = lastReportAt ?: return "No reports yet"
            val minutes = ((System.currentTimeMillis() - last.time) / 60_000).toInt()
            return when {
                minutes < 2 -> "just now"
                minutes < 60 -> "$minutes min ago"
                minutes < 120 -> "1 hour ago"
                minutes < 1440 -> "${minutes / 60} hours ago"
                else -> "over a day ago"
            }
        }

    /**
     * Says how thin the evidence is, in the user's own terms.
     *
     * A single fresh report is enough for the backend to say "had cash" — that
     * is deliberate, since demanding two would leave the map blank when it most
     * needs to earn trust. The honest compensation is telling people how many
     * reports the judgment rests on, so they can decide if it's worth the fare.
     */
    val evidenceText: String
        get() = when {
            status == AgentStatus.UNKNOWN ->
                "Nobody has reported here recently — you'd be finding out for everyone."
            reportCount == 1 -> "1 person reported $freshnessText."
            else -> "$reportCount people reported in the last day, most recently $freshnessText."
        }

    /** Shown as a caveat rather than downgrading the status. */
    fun amountCaveat(amount: Double): String? {
        if (status != AgentStatus.HAS_CASH) return null
        val confirmed = confirmedUpTo ?: return null
        if (confirmed >= amount) return null
        return "Only withdrawals up to ${confirmed.kwacha()} confirmed here — " +
               "call ahead for ${amount.kwacha()}."
    }
}

data class MobileMoneyAgent(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    val area: String,
    val landmark: String,
    val latitude: Double,
    val longitude: Double,
    val distanceKm: Double,
    val isOperatorVerified: Boolean,
    val liquidity: AgentLiquidity,
) {
    val walkingMinutes: Int get() = max(1, (distanceKm / 5.0 * 60).roundToInt())
    val directionsText: String get() = if (landmark.isEmpty()) area else "$area — near $landmark"
}

object LiquidityService {
    /**
     * Agent float turns over across a day, not a week. Short by design: stale
     * optimism is what sends people on wasted journeys.
     */
    const val HALF_LIFE_HOURS = 3.0

    /** Below this the answer is "we don't know" — honest, and it costs nobody a fare. */
    const val MINIMUM_CONFIDENCE = 0.8

    const val WINDOW_HOURS = 24.0

    data class Report(
        val outcome: AgentReportOutcome,
        val amountZMW: Double?,
        val createdAt: Date,
    )

    fun liquidity(reports: List<Report>, wanting: Double? = null,
                  now: Date = Date()): AgentLiquidity {
        var positive = 0.0
        var negative = 0.0

        val recent = reports.filter {
            (now.time - it.createdAt.time) / 3_600_000.0 <= WINDOW_HOURS
        }

        for (report in recent) {
            val ageHours = (now.time - report.createdAt.time) / 3_600_000.0
            val weight = 0.5.pow(ageHours / HALF_LIFE_HOURS)
            when (report.outcome) {
                AgentReportOutcome.CASH_AVAILABLE -> {
                    // A confirmation only counts up to what was actually withdrawn.
                    if (wanting != null && (report.amountZMW ?: 0.0) < wanting) continue
                    positive += weight
                }
                AgentReportOutcome.NO_CASH, AgentReportOutcome.CLOSED -> negative += weight
                // Says the pin is wrong, not that the agent is dry.
                AgentReportOutcome.NOT_FOUND -> continue
            }
        }

        val total = positive + negative
        val status = when {
            total < MINIMUM_CONFIDENCE -> AgentStatus.UNKNOWN
            positive / total >= 0.6 -> AgentStatus.HAS_CASH
            positive / total <= 0.4 -> AgentStatus.NO_CASH
            else -> AgentStatus.MIXED
        }

        return AgentLiquidity(
            status = status,
            confidence = Math.round(total * 100) / 100.0,
            lastReportAt = reports.maxByOrNull { it.createdAt.time }?.createdAt,
            confirmedUpTo = recent.filter { it.outcome == AgentReportOutcome.CASH_AVAILABLE }
                .mapNotNull { it.amountZMW }.maxOrNull(),
            reportCount = recent.size,
        )
    }

    /** Great-circle distance in km, matching distance_km() in SQL. */
    fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        return Math.round(r * 2 * asin(sqrt(a)) * 100) / 100.0
    }

    /**
     * Confirmed cash first, then unknowns, then known-dry last but still listed:
     * an agent reported dry an hour ago may have been restocked, and hiding it
     * would be its own kind of false claim.
     */
    fun rank(agents: List<MobileMoneyAgent>): List<MobileMoneyAgent> {
        fun order(s: AgentStatus) = when (s) {
            AgentStatus.HAS_CASH -> 0
            AgentStatus.UNKNOWN -> 1
            AgentStatus.MIXED -> 2
            AgentStatus.NO_CASH -> 3
        }
        return agents.sortedWith(
            compareBy({ order(it.liquidity.status) }, { it.distanceKm }))
    }
}

/** The database enum value; `label` is the display name. */
val MobileMoneyProvider.wireValue: String
    get() = when (this) {
        MobileMoneyProvider.MTN_MOMO -> "mtn_momo"
        MobileMoneyProvider.AIRTEL_MONEY -> "airtel_money"
        MobileMoneyProvider.ZAMTEL_KWACHA -> "zamtel_kwacha"
    }

fun mobileMoneyProviderFromWire(wire: String): MobileMoneyProvider? =
    MobileMoneyProvider.entries.firstOrNull { it.wireValue == wire }
