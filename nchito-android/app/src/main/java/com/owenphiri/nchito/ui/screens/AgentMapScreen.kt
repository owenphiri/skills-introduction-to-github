package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AgentReportOutcome
import com.owenphiri.nchito.data.AgentStatus
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.MobileMoneyAgent
import com.owenphiri.nchito.data.MobileMoneyProvider
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors

/**
 * Where to actually get your cash — see nchito-ios/INNOVATION.md §3.1.
 *
 * The screen's job is to be honest. Every row says what was reported, by how
 * many people and how long ago, because sending someone across town to a dry
 * agent costs bus fare they can ill afford and costs Nchito their trust.
 * "Not reported recently" is shown as a real answer, not hidden.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentMapScreen(vm: AppViewModel, wantingAmount: Double? = null, onBack: () -> Unit) {
    var provider by remember { mutableStateOf(MobileMoneyProvider.MTN_MOMO) }
    var reporting by remember { mutableStateOf<MobileMoneyAgent?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Find cash near you") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MobileMoneyProvider.entries.forEach { p ->
                        FilterChip(selected = provider == p, onClick = { provider = p },
                                   label = { Text(p.label) })
                    }
                }
            }

            wantingAmount?.let {
                item {
                    Text("Looking for ${it.kwacha()}. Agents are ranked by what people " +
                         "actually got out today.",
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            items(vm.nearbyAgents(), key = { it.id }) { agent ->
                AgentCard(agent, wantingAmount) { reporting = agent }
            }

            item {
                // People trust a crowdsourced answer more when you admit it is one.
                Card(Modifier.fillMaxWidth()) {
                    Text("These reports come from other Nchito workers, not from the " +
                         "networks. Float changes through the day, so always check how " +
                         "recent a report is — and tell us what you find so the next " +
                         "person doesn't waste a trip.",
                         modifier = Modifier.padding(14.dp),
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }

    reporting?.let { agent ->
        AgentReportSheet(vm, agent, provider, onDismiss = { reporting = null })
    }
}

@Composable
private fun AgentCard(agent: MobileMoneyAgent, wantingAmount: Double?, onReport: () -> Unit) {
    val tint = when (agent.liquidity.status) {
        AgentStatus.HAS_CASH -> NchitoColors.Green
        AgentStatus.NO_CASH -> NchitoColors.Red
        AgentStatus.MIXED -> NchitoColors.Copper
        AgentStatus.UNKNOWN -> Color.Gray
    }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(agent.name, fontWeight = FontWeight.SemiBold)
                        if (agent.isOperatorVerified) {
                            Icon(Icons.Filled.Verified, contentDescription = "Verified agent",
                                 tint = NchitoColors.Green, modifier = Modifier.height(14.dp))
                        }
                    }
                    Text(agent.directionsText, style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(String.format("%.1f km", agent.distanceKm),
                         style = MaterialTheme.typography.labelMedium,
                         fontWeight = FontWeight.SemiBold)
                    Text("~${agent.walkingMinutes} min walk",
                         style = MaterialTheme.typography.labelSmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            AssistChip(
                onClick = {},
                label = { Text(agent.liquidity.status.label, color = tint) },
                colors = AssistChipDefaults.assistChipColors(containerColor = tint.copy(alpha = 0.14f)),
            )

            // How thin the evidence is, always — one report reads very
            // differently from four, and the user should get to weigh that.
            Text(agent.liquidity.evidenceText, style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            wantingAmount?.let { amount ->
                agent.liquidity.amountCaveat(amount)?.let { caveat ->
                    Text(caveat, style = MaterialTheme.typography.bodySmall,
                         color = NchitoColors.Copper)
                }
            }

            TextButton(onClick = onReport) {
                Text("I went here — report what I found", color = NchitoColors.Green)
            }
        }
    }
}

/**
 * Reporting is one tap plus an optional amount. Anything longer and people won't
 * do it standing outside a kiosk, and the map dies without reports.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AgentReportSheet(
    vm: AppViewModel,
    agent: MobileMoneyAgent,
    provider: MobileMoneyProvider,
    onDismiss: () -> Unit,
) {
    var amount by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("What did you find?", style = MaterialTheme.typography.titleLarge,
                 fontWeight = FontWeight.Bold)
            Text("${agent.name} · ${agent.directionsText} · ${provider.label}",
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            AgentReportOutcome.entries.forEach { outcome ->
                OutlinedCard(
                    onClick = {
                        vm.reportAgent(agent, outcome,
                            if (outcome == AgentReportOutcome.CASH_AVAILABLE) amount.toDoubleOrNull()
                            else null)
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(outcome.label, Modifier.padding(14.dp),
                         style = MaterialTheme.typography.bodyMedium)
                }
            }

            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it },
                label = { Text("How much did you take out? (optional)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            // The reason this field matters, said plainly.
            Text("Telling us the amount helps — an agent who paid out K200 may still " +
                 "not have K2000.",
                 style = MaterialTheme.typography.labelSmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            Spacer(Modifier.height(32.dp))
        }
    }
}
