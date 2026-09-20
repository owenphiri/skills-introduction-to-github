package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.owenphiri.nchito.data.AdvanceTerms
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.Gig
import com.owenphiri.nchito.data.WageAdvance
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Earned wage access on a gig in progress — see nchito-ios/INNOVATION.md §3.2.
 *
 * When the worker isn't eligible it says why, in a sentence: a greyed-out button
 * with no explanation is how someone concludes the feature is broken and stops
 * looking for it.
 */
@Composable
fun WageAdvanceCard(vm: AppViewModel, gig: Gig) {
    var showSheet by remember { mutableStateOf(false) }
    val offer = vm.advanceOffer(gig)
    val existing = vm.advances.firstOrNull { it.gigId == gig.id }

    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Get paid before the job ends", fontWeight = FontWeight.SemiBold)

            when {
                existing != null -> TakenState(existing, gig)

                offer.isEligible -> {
                    Text("You've started this job, so you can take up to " +
                         "${offer.maxAmount.kwacha()} of your ${gig.workerPayout.kwacha()} " +
                         "payout right now. The rest arrives when the poster confirms the work.",
                         style = MaterialTheme.typography.bodySmall)
                    Button(
                        onClick = { showSheet = true },
                        colors = ButtonDefaults.buttonColors(containerColor = NchitoColors.Copper),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Take early payment") }
                }

                else -> Text(offer.reason, style = MaterialTheme.typography.bodySmall,
                             color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }

    if (showSheet) {
        WageAdvanceSheet(vm, gig, offer.maxAmount, onDismiss = { showSheet = false })
    }
}

@Composable
private fun TakenState(advance: WageAdvance, gig: Gig) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${advance.amountZMW.kwacha()} paid early",
                 fontWeight = FontWeight.SemiBold, color = NchitoColors.Copper)
            Spacer(Modifier.weight(1f))
            Text(advance.status.label, style = MaterialTheme.typography.labelSmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text("${advance.totalDueZMW.kwacha()} (including the ${advance.feeZMW.kwacha()} fee) " +
             "comes off this gig's payout. You'll receive " +
             "${(gig.workerPayout - advance.totalDueZMW).kwacha()} when it settles.",
             style = MaterialTheme.typography.bodySmall)
    }
}

/**
 * Every number the worker will experience is on one screen before they commit —
 * what arrives now, the fee, and what is left at the end — because a surprise at
 * settlement is how trust in early payment dies.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WageAdvanceSheet(
    vm: AppViewModel,
    gig: Gig,
    maxAmount: Double,
    onDismiss: () -> Unit,
) {
    // Opens at half the cap rather than the maximum, so the default isn't the
    // largest debt the worker could take on.
    var amount by remember {
        mutableStateOf(max(AdvanceTerms.MINIMUM_ADVANCE, (maxAmount / 2 / 10).roundToInt() * 10.0))
    }
    val fee = AdvanceTerms.fee(amount)
    val dueBack = amount + fee

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Early payment", style = MaterialTheme.typography.titleLarge,
                 fontWeight = FontWeight.Bold)

            Text(amount.kwacha(), fontSize = 42.sp, fontWeight = FontWeight.Bold,
                 color = NchitoColors.Copper)
            Text("paid to your wallet now", style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            Slider(
                value = amount.toFloat(),
                onValueChange = { amount = it.toDouble() },
                valueRange = AdvanceTerms.MINIMUM_ADVANCE.toFloat()..
                             max(maxAmount, AdvanceTerms.MINIMUM_ADVANCE).toFloat(),
                steps = 0,
                modifier = Modifier.fillMaxWidth(),
            )

            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    SummaryRow("Gig payout", gig.workerPayout.kwacha())
                    SummaryRow("Paid now", amount.kwacha(), emphasis = true)
                    SummaryRow("Service fee", fee.kwacha())
                    HorizontalDivider()
                    SummaryRow("Comes off at settlement", dueBack.kwacha())
                    SummaryRow("You receive at the end",
                               (gig.workerPayout - dueBack).kwacha(), emphasis = true)
                }
            }

            Text("A one-off fee, not interest — it doesn't grow if the job takes longer. " +
                 "Nchito already holds this money in escrow; this just releases part of it early.",
                 style = MaterialTheme.typography.labelSmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant,
                 textAlign = TextAlign.Center)

            Button(
                onClick = { if (vm.takeAdvance(gig, amount)) onDismiss() },
                enabled = amount >= AdvanceTerms.MINIMUM_ADVANCE,
                colors = ButtonDefaults.buttonColors(containerColor = NchitoColors.Copper),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Confirm — pay me ${amount.kwacha()} now") }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String, emphasis: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium,
             fontWeight = if (emphasis) FontWeight.SemiBold else FontWeight.Normal)
        Spacer(Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium,
             fontWeight = if (emphasis) FontWeight.Bold else FontWeight.Normal,
             color = if (emphasis) NchitoColors.Copper else MaterialTheme.colorScheme.onSurface)
    }
}
