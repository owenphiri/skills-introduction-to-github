package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.owenphiri.nchito.data.Gig
import com.owenphiri.nchito.data.GigCategory
import com.owenphiri.nchito.data.kwacha
import com.owenphiri.nchito.ui.NchitoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(vm: AppViewModel, onOpenGig: (String) -> Unit) {
    var search by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<GigCategory?>(null) }
    var showPostSheet by remember { mutableStateOf(false) }

    val filtered = vm.gigs
        .filter { gig ->
            (selectedCategory == null || gig.category == selectedCategory) &&
            (search.isBlank() || gig.title.contains(search, true) || gig.details.contains(search, true))
        }
        .sortedWith(compareByDescending<Gig> { it.isBoosted }.thenBy { it.minutesAgo })

    // A failed load must say why, not leave a blank feed with no explanation.
    vm.loadError?.let { error ->
        AlertDialog(
            onDismissRequest = { vm.loadError = null },
            title = { Text("Couldn't load") },
            text = { Text(error) },
            confirmButton = {
                TextButton(onClick = { vm.loadError = null; vm.refresh() }) { Text("Try again") }
            },
            dismissButton = {
                TextButton(onClick = { vm.loadError = null }) { Text("OK") }
            },
        )
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showPostSheet = true },
                containerColor = NchitoColors.Copper,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Post a gig") },
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Gigs near you", style = MaterialTheme.typography.headlineMedium,
                         fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    if (vm.isLoading) {
                        CircularProgressIndicator(Modifier.height(20.dp))
                    } else {
                        TextButton(onClick = { vm.refresh() }) { Text("Refresh") }
                    }
                }
            }
            item {
                OutlinedTextField(
                    value = search, onValueChange = { search = it },
                    placeholder = { Text("Search gigs…") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(GigCategory.entries) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = {
                                selectedCategory = if (selectedCategory == cat) null else cat
                            },
                            label = { Text(cat.label) },
                        )
                    }
                }
            }
            items(filtered, key = { it.id }) { gig ->
                GigCard(gig, onClick = { onOpenGig(gig.id.toString()) })
            }
        }
    }

    if (showPostSheet) {
        PostGigSheet(vm, onDismiss = { showPostSheet = false })
    }
}

@Composable
fun GigCard(gig: Gig, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AssistChip(onClick = {}, label = { Text(gig.category.label) })
                if (gig.isUrgent) {
                    Spacer(Modifier.width(6.dp))
                    Text("URGENT", color = NchitoColors.Red,
                         style = MaterialTheme.typography.labelSmall,
                         fontWeight = FontWeight.Bold)
                }
                if (gig.isBoosted) {
                    Spacer(Modifier.width(6.dp))
                    Text("★ Featured", color = NchitoColors.Copper,
                         style = MaterialTheme.typography.labelSmall,
                         fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.weight(1f))
                Text(gig.payZMW.kwacha(), fontWeight = FontWeight.Bold,
                     color = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.height(6.dp))
            Text(gig.title, style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(4.dp))
            Text("${gig.city} · ${gig.area}  •  ${gig.applicants} applied",
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
