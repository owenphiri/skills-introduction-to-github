package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GigDetailScreen(
    vm: AppViewModel,
    gigId: String?,
    onMessagePoster: (String) -> Unit,
    onBack: () -> Unit,
) {
    val gig = vm.gigs.firstOrNull { it.id.toString() == gigId } ?: return
    var applied by remember { mutableStateOf(gig.id in vm.appliedGigIds) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gig details") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(gig.title, style = MaterialTheme.typography.headlineSmall,
                 fontWeight = FontWeight.Bold)

            Card {
                Row(Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly) {
                    Stat(gig.payZMW.kwacha(), "Gig pay")
                    Stat(gig.workerPayout.kwacha(), "You receive")
                    Stat("${gig.applicants}", "Applicants")
                }
            }

            LoyaltyCard(gig)

            if (applied) {
                ProofOfWorkCard(vm, gig)
            }

            Text("Details", style = MaterialTheme.typography.titleMedium)
            Text(gig.details, style = MaterialTheme.typography.bodyMedium)

            Text("Location", style = MaterialTheme.typography.titleMedium)
            Text("${gig.city} — ${gig.area}", style = MaterialTheme.typography.bodyMedium)

            Text("Posted by", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(gig.posterName, fontWeight = FontWeight.SemiBold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Star, contentDescription = null,
                             tint = NchitoColors.Copper,
                             modifier = Modifier.height(14.dp))
                        Text(" ${gig.posterRating} rating",
                             style = MaterialTheme.typography.bodySmall)
                    }
                }
                OutlinedButton(onClick = {
                    val convo = vm.conversationAbout(gig)
                    onMessagePoster(convo.id.toString())
                }) {
                    Icon(Icons.Filled.Chat, contentDescription = null,
                         modifier = Modifier.height(16.dp))
                    Text(" Message")
                }
            }

            Card {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                    Icon(Icons.Filled.Lock, contentDescription = null,
                         tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.padding(start = 10.dp)) {
                        Text("Escrow protected", fontWeight = FontWeight.SemiBold)
                        Text("The poster's payment of ${gig.payZMW.kwacha()} is held by Nchito " +
                             "and released once they confirm the job is done and both proof photos " +
                             "are attached. Your ${gig.commissionTier.ratePercent} service fee is " +
                             gig.commissionAmount.kwacha() + ".",
                             style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Button(
                onClick = { vm.apply(gig); applied = true },
                enabled = !applied,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (applied) "Application sent ✓" else "Apply for this gig")
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Stat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall,
             color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
