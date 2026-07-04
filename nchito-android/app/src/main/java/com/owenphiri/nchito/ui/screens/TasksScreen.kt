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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors
import kotlinx.coroutines.launch

@Composable
fun TasksScreen(vm: AppViewModel) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val availableTotal = vm.microTasks.filter { !it.isCompleted }.sumOf { it.rewardZMW }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text("Quick Tasks", style = MaterialTheme.typography.headlineMedium,
                     fontWeight = FontWeight.Bold)
            }
            item {
                Card(colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primary)) {
                    Column(Modifier.padding(14.dp)) {
                        Text("Earn in your spare time",
                             color = MaterialTheme.colorScheme.onPrimary,
                             fontWeight = FontWeight.SemiBold)
                        Text("${availableTotal.kwacha()} available right now — tasks refresh daily.",
                             color = MaterialTheme.colorScheme.onPrimary,
                             style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            items(vm.microTasks, key = { it.id }) { task ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(task.title, style = MaterialTheme.typography.titleSmall)
                            Spacer(Modifier.height(2.dp))
                            Text("${task.kind.label} • ${task.minutes} min • ${task.slotsLeft} slots",
                                 style = MaterialTheme.typography.bodySmall,
                                 color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (task.isCompleted) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = "Done",
                                 tint = MaterialTheme.colorScheme.primary)
                        } else {
                            Button(
                                onClick = {
                                    vm.complete(task)
                                    scope.launch {
                                        snackbar.showSnackbar(
                                            "+${task.rewardZMW.kwacha()} added to your wallet 🎉")
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = NchitoColors.Copper),
                            ) { Text(task.rewardZMW.kwacha()) }
                        }
                    }
                }
            }
        }
    }
}
