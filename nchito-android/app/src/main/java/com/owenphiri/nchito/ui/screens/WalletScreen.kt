package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.MobileMoneyProvider
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(vm: AppViewModel, onOpenAgentMap: () -> Unit = {}) {
    var showCashOut by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Wallet", style = MaterialTheme.typography.headlineMedium,
                 fontWeight = FontWeight.Bold)
        }
        item {
            Card(colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primary)) {
                Column(
                    Modifier.fillMaxWidth().padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Available balance",
                         color = MaterialTheme.colorScheme.onPrimary,
                         style = MaterialTheme.typography.labelMedium)
                    Text(vm.walletBalance.kwacha(), fontSize = 40.sp,
                         fontWeight = FontWeight.Bold,
                         color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { showCashOut = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NchitoColors.Copper),
                    ) { Text("Cash out to ${vm.payoutProvider.label}") }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth().clickable(onClick = onOpenAgentMap)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Find cash near you", fontWeight = FontWeight.SemiBold)
                    Text("Which agents actually have float right now",
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.primary)
                    Text("Reported by other Nchito workers. A balance you can't withdraw " +
                         "isn't money.",
                         style = MaterialTheme.typography.labelSmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MobileMoneyProvider.entries.forEach { p ->
                    FilterChip(selected = vm.payoutProvider == p,
                               onClick = { vm.payoutProvider = p },
                               label = { Text(p.label) })
                }
            }
        }
        vm.outstandingAdvance?.let { advance ->
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp),
                           verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(advance.totalDueZMW.kwacha(),
                                 fontWeight = FontWeight.Bold, color = NchitoColors.Copper)
                            Spacer(Modifier.weight(1f))
                            Text(advance.status.label,
                                 style = MaterialTheme.typography.labelSmall,
                                 color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("${advance.amountZMW.kwacha()} advanced on ${advance.gigTitle}, " +
                             "plus a ${advance.feeZMW.kwacha()} fee.",
                             style = MaterialTheme.typography.bodySmall,
                             color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item {
            Text("Recent activity", style = MaterialTheme.typography.titleMedium)
        }
        items(vm.transactions, key = { it.id }) { tx ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tx.kind.label, fontWeight = FontWeight.Medium)
                        Text(tx.note, style = MaterialTheme.typography.bodySmall,
                             color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text((if (tx.amountZMW >= 0) "+" else "") + tx.amountZMW.kwacha(),
                         fontWeight = FontWeight.SemiBold,
                         color = if (tx.amountZMW >= 0) MaterialTheme.colorScheme.primary
                                 else NchitoColors.Red)
                }
            }
        }
    }

    if (showCashOut) {
        var amount by remember { mutableStateOf("") }
        var error by remember { mutableStateOf<String?>(null) }
        ModalBottomSheet(onDismissRequest = { showCashOut = false }) {
            Column(
                Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Cash out", style = MaterialTheme.typography.titleLarge,
                     fontWeight = FontWeight.Bold)
                Text("Balance: ${vm.walletBalance.kwacha()} • Sent instantly to your ${vm.payoutProvider.label} number.",
                     style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = amount, onValueChange = { amount = it },
                    label = { Text("Amount (Kwacha)") },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                                  style = MaterialTheme.typography.bodySmall) }
                Button(
                    onClick = {
                        val value = amount.toDoubleOrNull()
                        when {
                            value == null || value <= 0 -> error = "Enter a valid amount."
                            !vm.cashOut(value) -> error = "Amount exceeds your available balance."
                            else -> showCashOut = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Cash out now") }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}
