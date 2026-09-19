package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.Gig
import com.owenphiri.nchito.data.ProofKind
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors

/**
 * Loyalty-decaying commission (nchito-ios/INNOVATION.md §1.1).
 *
 * Showing the rate and what the next tier is worth is the whole point: it makes
 * staying with this poster on Nchito visibly cheaper than settling in cash.
 */
@Composable
fun LoyaltyCard(gig: Gig) {
    val tier = gig.commissionTier
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(tier.label, fontWeight = FontWeight.SemiBold,
                     color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.weight(1f))
                Text("${tier.ratePercent} fee", fontWeight = FontWeight.Bold,
                     color = MaterialTheme.colorScheme.primary)
            }

            if (gig.completedWithPoster > 0) {
                Text("You've completed ${gig.completedWithPoster} gig" +
                     "${if (gig.completedWithPoster == 1) "" else "s"} with ${gig.posterName}.",
                     style = MaterialTheme.typography.bodySmall,
                     color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            val remaining = tier.gigsToNextTier(gig.completedWithPoster)
            val next = tier.next()
            val nextPayout = gig.payoutAtNextTier

            if (remaining != null && next != null && nextPayout != null) {
                LinearProgressIndicator(
                    progress = { gig.completedWithPoster.toFloat() / (gig.completedWithPoster + remaining) },
                    modifier = Modifier.fillMaxWidth(),
                    color = NchitoColors.Copper,
                )
                Text("$remaining more gig${if (remaining == 1) "" else "s"} with this poster drops " +
                     "your fee to ${next.ratePercent} — you'd keep ${nextPayout.kwacha()} on a gig this size.",
                     style = MaterialTheme.typography.bodySmall,
                     color = NchitoColors.Copper)
            } else {
                Text("You're on our lowest fee with this poster. Keep working together " +
                     "on Nchito to stay protected by escrow.",
                     style = MaterialTheme.typography.bodySmall,
                     color = NchitoColors.Copper)
            }
        }
    }
}

/**
 * Proof-of-work capture (nchito-ios/INNOVATION.md §4.1).
 *
 * Both photos must exist before escrow can be released, which `release_escrow()`
 * enforces server-side too — this card is the human half of that contract, not
 * the security boundary.
 */
@Composable
fun ProofOfWorkCard(vm: AppViewModel, gig: Gig) {
    val status = vm.proofStatus(gig)

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Proof of work", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                if (status.isComplete) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = "Complete",
                         tint = MaterialTheme.colorScheme.primary,
                         modifier = Modifier.height(18.dp))
                } else {
                    Text("${2 - status.missing.size}/2",
                         style = MaterialTheme.typography.labelMedium,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Text("Photos are stamped with the time and place they were taken. They " +
                 "protect your payment if the poster disputes the work.",
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProofKind.entries.forEach { kind ->
                    ProofSlot(
                        kind = kind,
                        photo = status.photoFor(kind),
                        onCapture = { vm.captureProof(kind, gig) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            val blocked = status.releaseBlockedReason
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (blocked == null) Icons.Filled.LockOpen else Icons.Filled.Lock,
                    contentDescription = null,
                    tint = if (blocked == null) MaterialTheme.colorScheme.primary else NchitoColors.Copper,
                    modifier = Modifier.height(16.dp),
                )
                Text(
                    " " + (blocked ?: "Payment can now be released by the poster."),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (blocked == null) MaterialTheme.colorScheme.primary else NchitoColors.Copper,
                )
            }
        }
    }
}

@Composable
private fun ProofSlot(
    kind: ProofKind,
    photo: com.owenphiri.nchito.data.ProofPhoto?,
    onCapture: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (photo != null) {
        Card(
            modifier = modifier,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null,
                     tint = MaterialTheme.colorScheme.primary)
                Text(kind.label, fontWeight = FontWeight.SemiBold,
                     style = MaterialTheme.typography.labelMedium)
                Text(photo.capturedAtLabel, style = MaterialTheme.typography.labelSmall)
                if (photo.hasLocation) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Place, contentDescription = null,
                             modifier = Modifier.height(12.dp))
                        Text("Geotagged", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    } else {
        OutlinedCard(
            onClick = onCapture,
            modifier = modifier,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Icon(Icons.Filled.CameraAlt, contentDescription = null)
                Text(kind.label, fontWeight = FontWeight.SemiBold,
                     style = MaterialTheme.typography.labelMedium)
                Text(kind.prompt, style = MaterialTheme.typography.labelSmall,
                     color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
