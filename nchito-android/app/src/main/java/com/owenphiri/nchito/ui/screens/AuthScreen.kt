package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.owenphiri.nchito.data.AppViewModel

@Composable
fun AuthScreen(vm: AppViewModel) {
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    val sentTo = vm.otpSentTo

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Nchito", fontSize = 44.sp, fontWeight = FontWeight.Bold,
             color = MaterialTheme.colorScheme.primary)
        Text("Sign in with your phone — no passwords, no email.",
             style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))

        if (sentTo == null) {
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("🇿🇲 +260 phone number") },
                placeholder = { Text("97 123 4567") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { vm.requestOtp(phone) },
                enabled = phone.count { it.isDigit() } >= 9,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Send code") }
        } else {
            Text("Enter the 6-digit code sent to $sentTo",
                 style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { new ->
                    code = new.filter { it.isDigit() }.take(6)
                    if (code.length == 6) vm.verifyOtp(code)
                },
                label = { Text("One-time code") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { vm.verifyOtp(code) },
                enabled = code.length == 6,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Verify & sign in") }
            TextButton(onClick = { vm.changeNumber(); code = "" }) {
                Text("Use a different number")
            }
        }

        vm.authError?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error,
                 style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
        }

        if (vm.isDemoMode) {
            Spacer(Modifier.height(12.dp))
            Text("Demo mode — any number works, code is ${AppViewModel.DEMO_OTP}",
                 style = MaterialTheme.typography.labelSmall)
        }
    }
}
