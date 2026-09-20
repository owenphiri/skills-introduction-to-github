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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.WorkRecordEntry
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * The Work Record — see nchito-ios/INNOVATION.md §1.2.
 *
 * For most users this is the first CV they've ever had. The screen is built
 * around that: standing at the top, proof of how it was earned below, and the
 * two things they'd actually want to do with it — share it, or hand it over as
 * a document — always within reach.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkRecordScreen(vm: AppViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val summary = vm.workRecordSummary
    val sharing = vm.workRecordSharing
    var showRotateConfirm by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Work Record") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (!summary.isEmpty) {
                        IconButton(onClick = {
                            val file = vm.exportWorkRecordCv(context)
                            if (file == null) {
                                exportError = true
                            } else {
                                val uri = FileProvider.getUriForFile(
                                    context, "${context.packageName}.fileprovider", file)
                                val share = Intent(Intent.ACTION_SEND).apply {
                                    type = "application/pdf"
                                    putExtra(Intent.EXTRA_STREAM, uri)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(
                                    Intent.createChooser(share, "Share your work record"))
                            }
                        }) {
                            Icon(Icons.Filled.Download, contentDescription = "Export CV")
                        }
                    }
                },
            )
        }
    ) { padding ->
        if (summary.isEmpty) {
            EmptyRecord(Modifier.padding(padding))
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { StandingCard(vm) }
            item { SharingCard(vm, onRotate = { showRotateConfirm = true }) }

            if (summary.topCategories.isNotEmpty()) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp),
                               verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("What you work on most",
                                 style = MaterialTheme.typography.titleMedium)
                            summary.topCategories.forEach { (category, count) ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(category.label,
                                         style = MaterialTheme.typography.bodySmall)
                                    Spacer(Modifier.weight(1f))
                                    Text("$count job${if (count == 1) "" else "s"}",
                                         style = MaterialTheme.typography.labelMedium,
                                         color = MaterialTheme.colorScheme.primary)
                                }
                                LinearProgressIndicator(
                                    progress = { count.toFloat() / summary.totalGigs },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                }
            }

            item {
                Text("Completed work", style = MaterialTheme.typography.titleMedium)
            }
            items(vm.workRecord.sortedByDescending { it.completedAt }, key = { it.id }) { entry ->
                RecordRow(entry)
            }

            item {
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                        Icon(Icons.Filled.Verified, contentDescription = null,
                             tint = MaterialTheme.colorScheme.primary,
                             modifier = Modifier.height(18.dp))
                        Text(" Every entry was paid through Nchito escrow and is " +
                             "cryptographically signed. Neither Nchito nor you can change a " +
                             "record once it's issued — that's what makes it worth showing.",
                             style = MaterialTheme.typography.bodySmall,
                             color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    if (showRotateConfirm) {
        AlertDialog(
            onDismissRequest = { showRotateConfirm = false },
            title = { Text("Create a new link?") },
            text = {
                Text("Anyone you've already given the old link to will no longer be " +
                     "able to open your record.")
            },
            confirmButton = {
                TextButton(onClick = { vm.rotateWorkRecordLink(); showRotateConfirm = false }) {
                    Text("Create new link")
                }
            },
            dismissButton = {
                TextButton(onClick = { showRotateConfirm = false }) { Text("Keep current link") }
            },
        )
    }

    if (exportError) {
        AlertDialog(
            onDismissRequest = { exportError = false },
            title = { Text("Couldn't create the PDF") },
            text = { Text("Your device may be low on storage. Free some space and try again.") },
            confirmButton = { TextButton(onClick = { exportError = false }) { Text("OK") } },
        )
    }
}

@Composable
private fun StandingCard(vm: AppViewModel) {
    val summary = vm.workRecordSummary
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            summary.reliabilityScore?.let { score ->
                Text("$score", fontSize = 46.sp, fontWeight = FontWeight.Bold,
                     color = MaterialTheme.colorScheme.onPrimary)
                Text("${summary.scoreBand} · reliability out of 100",
                     style = MaterialTheme.typography.bodySmall,
                     color = MaterialTheme.colorScheme.onPrimary)
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                LightStat("${summary.totalGigs}", "Jobs done")
                LightStat(summary.onTimePercent, "On time")
                LightStat(summary.ratingText, "Rating")
            }

            Text("${summary.totalEarnedZMW.kwacha()} earned through escrow · ${summary.tenureText}",
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onPrimary,
                 textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun LightStat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold,
             color = MaterialTheme.colorScheme.onPrimary)
        Text(label, style = MaterialTheme.typography.labelSmall,
             color = MaterialTheme.colorScheme.onPrimary)
    }
}

@Composable
private fun SharingCard(vm: AppViewModel, onRotate: () -> Unit) {
    val context = LocalContext.current
    val sharing = vm.workRecordSharing

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Share my record", fontWeight = FontWeight.SemiBold)
                    Text("Off by default. Turn on to let an employer open it from a link.",
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = sharing.isPublic,
                       onCheckedChange = { vm.setWorkRecordPublic(it) })
            }

            if (sharing.isPublic) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(sharing.shareUrl, style = MaterialTheme.typography.bodySmall,
                         modifier = Modifier.weight(1f), maxLines = 1)
                    IconButton(onClick = {
                        val share = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, sharing.shareMessage)
                        }
                        context.startActivity(Intent.createChooser(share, "Share your record"))
                    }) {
                        Icon(Icons.Filled.Share, contentDescription = "Share link")
                    }
                }
                TextButton(onClick = onRotate) {
                    Text("Create a new link", color = NchitoColors.Copper)
                }
            }
        }
    }
}

@Composable
private fun RecordRow(entry: WorkRecordEntry) {
    val monthYear = remember { SimpleDateFormat("MMM yyyy", Locale.getDefault()) }

    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(entry.title, style = MaterialTheme.typography.bodyMedium,
                     fontWeight = FontWeight.Medium, maxLines = 2)
                val rating = entry.posterRating?.let { String.format(" · %.1f★", it) } ?: ""
                val late = if (entry.onTime) "" else " · late"
                Text("${monthYear.format(entry.completedAt)}$rating$late",
                     style = MaterialTheme.typography.labelSmall,
                     color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(entry.payZMW.kwacha(), fontWeight = FontWeight.SemiBold,
                     style = MaterialTheme.typography.bodyMedium)
                Icon(
                    Icons.Filled.Verified,
                    contentDescription = if (entry.isVerified) "Verified" else "Signature invalid",
                    // A failed signature check means the row was altered after
                    // issue; it must never read as verified.
                    tint = if (entry.isVerified) MaterialTheme.colorScheme.primary
                           else NchitoColors.Red,
                    modifier = Modifier.height(14.dp),
                )
            }
        }
    }
}

@Composable
private fun EmptyRecord(modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Your work record starts with your first gig",
             style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text("Every job you complete and get paid for through Nchito is added here " +
             "automatically — a work history you can show an employer or a bank. Jobs " +
             "settled in cash off the app can't be added.",
             style = MaterialTheme.typography.bodySmall,
             color = MaterialTheme.colorScheme.onSurfaceVariant,
             textAlign = TextAlign.Center)
    }
}
