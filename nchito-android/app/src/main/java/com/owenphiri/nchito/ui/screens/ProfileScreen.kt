package com.owenphiri.nchito.ui.screens

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.ui.NchitoColors

private const val REFERRAL_CODE = "OWEN260"

@Composable
fun ProfileScreen(vm: AppViewModel) {
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally,
                   modifier = Modifier.fillMaxWidth()) {
                Text("Profile", style = MaterialTheme.typography.headlineMedium,
                     fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(vm.signedInPhone, style = MaterialTheme.typography.bodyMedium,
                     color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("4.8 ★", fontWeight = FontWeight.Bold)
                        Text("Rating", style = MaterialTheme.typography.labelSmall)
                    }
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("27", fontWeight = FontWeight.Bold)
                        Text("Gigs done", style = MaterialTheme.typography.labelSmall)
                    }
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("NRC ✓", fontWeight = FontWeight.Bold,
                             color = MaterialTheme.colorScheme.primary)
                        Text("Verified", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Invite friends, earn passively",
                         style = MaterialTheme.typography.titleMedium)
                    Text("You earn K20 for every friend who joins with your code and finishes their first gig — plus 2% of their task rewards for 3 months.",
                         style = MaterialTheme.typography.bodySmall)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AssistChip(onClick = {}, label = {
                            Text(REFERRAL_CODE, fontWeight = FontWeight.Bold,
                                 color = NchitoColors.Green)
                        })
                        Spacer(Modifier.weight(1f))
                        Button(onClick = {
                            val share = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT,
                                    "Join me on Nchito 🇿🇲 — find gigs and quick tasks, get paid straight to mobile money. Use my code $REFERRAL_CODE and we both earn K20!")
                            }
                            context.startActivity(Intent.createChooser(share, "Share your code"))
                        }) { Text("Share") }
                    }
                }
            }
        }
        item {
            OutlinedButton(onClick = { vm.signOut() }, modifier = Modifier.fillMaxWidth()) {
                Text("Sign out", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
