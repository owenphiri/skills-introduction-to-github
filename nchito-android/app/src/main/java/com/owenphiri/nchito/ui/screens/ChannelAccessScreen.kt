package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel

/**
 * Sets the PIN that authorises money movement over USSD and WhatsApp —
 * see nchito-ios/INNOVATION.md §2.1.
 *
 * On USSD the network asserts the phone number, which is a reasonable identity
 * claim, but a stolen handset would otherwise be a drained wallet. Mobile money
 * in this market always asks for a PIN before money moves. The PIN is only ever
 * stored hashed, by `set_channel_pin()`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChannelAccessScreen(vm: AppViewModel, onBack: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }

    val validationError = when {
        pin.length < 4 -> null
        pin in AppViewModel.TOO_COMMON_PINS -> "That PIN is too easy to guess. Choose another."
        confirmation.length == 4 && confirmation != pin -> "The two PINs don't match."
        else -> null
    }
    val canSave = pin.length == 4 && confirmation == pin && validationError == null

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Phone & USSD access") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Use Nchito without the app", fontWeight = FontWeight.SemiBold)
                    Text("Dial ${AppViewModel.USSD_SHORTCODE} on any phone — even without " +
                         "data — to find gigs, apply, check your balance and cash out. You can " +
                         "also message Nchito on WhatsApp.",
                         style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            OutlinedTextField(
                value = pin,
                onValueChange = { pin = it.filter { c -> c.isDigit() }.take(4) },
                label = { Text("Enter a new 4-digit PIN") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = confirmation,
                onValueChange = { confirmation = it.filter { c -> c.isDigit() }.take(4) },
                label = { Text("Enter it again") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )

            (validationError ?: error)?.let {
                Text(it, color = MaterialTheme.colorScheme.error,
                     style = MaterialTheme.typography.bodySmall)
            }

            Text("You'll be asked for this PIN before any money leaves your wallet over USSD " +
                 "or WhatsApp. Never share it — Nchito will never ask you for it.",
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant)

            Button(
                onClick = {
                    if (vm.setChannelPin(pin)) saved = true
                    else error = "That PIN is too easy to guess. Choose another."
                },
                enabled = canSave,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (vm.hasChannelPin) "Update PIN" else "Set PIN")
            }
        }
    }

    if (saved) {
        AlertDialog(
            onDismissRequest = { saved = false; onBack() },
            title = { Text("PIN set") },
            text = {
                Text("You can now cash out by dialling ${AppViewModel.USSD_SHORTCODE} from " +
                     "your phone, with no data needed.")
            },
            confirmButton = {
                TextButton(onClick = { saved = false; onBack() }) { Text("Done") }
            },
        )
    }
}
