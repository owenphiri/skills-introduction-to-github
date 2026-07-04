package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.data.Gig
import com.owenphiri.nchito.data.GigCategory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostGigSheet(vm: AppViewModel, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(GigCategory.DELIVERY) }
    var pay by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("Lusaka") }
    var area by remember { mutableStateOf("") }
    var urgent by remember { mutableStateOf(false) }
    var boost by remember { mutableStateOf(false) }

    val payValue = pay.toDoubleOrNull()
    val valid = title.isNotBlank() && details.isNotBlank() && area.isNotBlank() && (payValue ?: 0.0) > 0

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Post a gig", style = MaterialTheme.typography.titleLarge,
                 fontWeight = FontWeight.Bold)

            OutlinedTextField(value = title, onValueChange = { title = it },
                label = { Text("Gig title") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = details, onValueChange = { details = it },
                label = { Text("Describe the job, timing and requirements") },
                minLines = 3, modifier = Modifier.fillMaxWidth())

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(GigCategory.entries) { cat ->
                    FilterChip(selected = category == cat, onClick = { category = cat },
                               label = { Text(cat.label) })
                }
            }

            OutlinedTextField(value = pay, onValueChange = { pay = it },
                label = { Text("Pay (Kwacha)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = city, onValueChange = { city = it },
                label = { Text("City") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = area, onValueChange = { area = it },
                label = { Text("Area (e.g. Kabulonga)") }, modifier = Modifier.fillMaxWidth())

            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(checked = urgent, onCheckedChange = { urgent = it })
                Text("  Mark as urgent")
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(checked = boost, onCheckedChange = { boost = it })
                Column(Modifier.padding(start = 8.dp)) {
                    Text("Boost to top of feed")
                    Text("K25 — featured for 48 hours, ~5× more applicants",
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Button(
                onClick = {
                    vm.postGig(Gig(
                        title = title, details = details, category = category,
                        payZMW = payValue ?: 0.0, city = city, area = area,
                        posterName = "You", posterRating = 5.0, minutesAgo = 0,
                        isUrgent = urgent, isBoosted = boost))
                    onDismiss()
                },
                enabled = valid,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Post gig") }

            Spacer(Modifier.height(32.dp))
        }
    }
}
