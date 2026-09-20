package com.owenphiri.nchito.data

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Translation between the app's domain enums and the values Postgres actually
 * stores, defined in nchito-ios/supabase/migrations/.
 *
 * This exists because the enums carry DISPLAY text — `GigCategory.DELIVERY.label`
 * is "Delivery & Errands" — while the database enum is 'delivery'. Sending the
 * label would be rejected, or worse, quietly write nonsense. Every enum that
 * crosses the wire is mapped explicitly here.
 */

// GigCategory carries its own wire value (generated in ServiceCatalog.kt).
// These two aliases keep it addressable through the same names as every
// other enum here, so call sites do not have to know which is which.
val GigCategory.wireValue: String get() = wire

fun gigCategoryFromWire(wire: String): GigCategory? = GigCategory.fromWire(wire)

val GigStatus.wireValue: String
    get() = when (this) {
        GigStatus.OPEN -> "open"
        GigStatus.ASSIGNED -> "assigned"
        GigStatus.COMPLETED -> "completed"
        GigStatus.PAID -> "paid"
    }

fun gigStatusFromWire(wire: String): GigStatus? =
    GigStatus.entries.firstOrNull { it.wireValue == wire }

val MicroTaskKind.wireValue: String
    get() = when (this) {
        MicroTaskKind.SURVEY -> "survey"
        MicroTaskKind.APP_TEST -> "app_test"
        MicroTaskKind.DATA_LABEL -> "data_label"
        MicroTaskKind.SOCIAL -> "social"
        MicroTaskKind.MYSTERY_SHOP -> "mystery_shop"
    }

fun microTaskKindFromWire(wire: String): MicroTaskKind? =
    MicroTaskKind.entries.firstOrNull { it.wireValue == wire }

val TxKind.wireValue: String
    get() = when (this) {
        TxKind.GIG_PAYOUT -> "gig_payout"
        TxKind.TASK_REWARD -> "task_reward"
        TxKind.REFERRAL_BONUS -> "referral_bonus"
        TxKind.CASH_OUT -> "cash_out"
        TxKind.WAGE_ADVANCE -> "wage_advance"
        TxKind.ADVANCE_REPAYMENT -> "advance_repayment"
        TxKind.ADVANCE_RECOVERY -> "advance_recovery"
        TxKind.ESCROW_IN -> "escrow_in"
        TxKind.ESCROW_REFUND -> "escrow_refund"
        TxKind.OTHER -> "other"
    }

/**
 * Never fails: a kind this build doesn't recognise becomes OTHER, so one
 * unfamiliar row can't take down a user's whole transaction list. Mobile
 * versions live in the wild for a long time after a migration adds a value.
 */
fun txKindFromWire(wire: String): TxKind =
    TxKind.entries.firstOrNull { it.wireValue == wire } ?: TxKind.OTHER

val AdvanceStatus.wireValue: String
    get() = when (this) {
        AdvanceStatus.OUTSTANDING -> "outstanding"
        AdvanceStatus.SETTLED -> "settled"
        AdvanceStatus.RECOVERING -> "recovering"
        AdvanceStatus.WRITTEN_OFF -> "written_off"
    }

fun advanceStatusFromWire(wire: String): AdvanceStatus =
    AdvanceStatus.entries.firstOrNull { it.wireValue == wire } ?: AdvanceStatus.OUTSTANDING

val ProofKind.wireValue: String
    get() = if (this == ProofKind.BEFORE) "before" else "after"

fun proofKindFromWire(wire: String): ProofKind =
    if (wire == "after") ProofKind.AFTER else ProofKind.BEFORE

/**
 * Postgres returns timestamptz with a variable number of fractional digits, so
 * parsing tries the fractional form first and falls back.
 */
object WireDate {
    private fun formatter(pattern: String) =
        SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }

    private val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
    )

    fun parse(value: String): Date? {
        for (p in patterns) {
            runCatching { return formatter(p).parse(value) }
        }
        return null
    }

    fun format(date: Date): String = formatter("yyyy-MM-dd'T'HH:mm:ss.SSSXXX").format(date)
}
