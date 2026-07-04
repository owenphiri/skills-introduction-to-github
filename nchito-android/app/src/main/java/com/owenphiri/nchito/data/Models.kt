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
) {
    companion object { const val COMMISSION_RATE = 0.10 }
    val workerPayout: Double get() = payZMW * (1 - COMMISSION_RATE)
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
