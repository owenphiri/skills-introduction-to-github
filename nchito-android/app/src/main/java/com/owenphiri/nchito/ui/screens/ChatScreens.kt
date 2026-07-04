package com.owenphiri.nchito.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.owenphiri.nchito.data.AppViewModel

@Composable
fun ChatListScreen(vm: AppViewModel, onOpenChat: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("Chats", style = MaterialTheme.typography.headlineMedium,
                 fontWeight = FontWeight.Bold)
        }
        items(vm.conversations, key = { it.id }) { convo ->
            val last = vm.messagesIn(convo).lastOrNull()
            Card(Modifier.fillMaxWidth().clickable { onOpenChat(convo.id.toString()) }) {
                Column(Modifier.padding(14.dp)) {
                    Text(convo.counterpartName, fontWeight = FontWeight.SemiBold)
                    Text(convo.gigTitle, style = MaterialTheme.typography.bodySmall,
                         color = MaterialTheme.colorScheme.secondary, maxLines = 1)
                    if (last != null) {
                        Spacer(Modifier.height(2.dp))
                        Text((if (last.isMine) "You: " else "") + last.body,
                             style = MaterialTheme.typography.bodySmall,
                             color = MaterialTheme.colorScheme.onSurfaceVariant,
                             maxLines = 1)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatThreadScreen(vm: AppViewModel, conversationId: String?, onBack: () -> Unit) {
    val convo = vm.conversations.firstOrNull { it.id.toString() == conversationId } ?: return
    val thread = vm.messagesIn(convo)
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(thread.size) {
        if (thread.isNotEmpty()) listState.animateScrollToItem(thread.size - 1)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(convo.counterpartName)
                        Text(convo.gigTitle, style = MaterialTheme.typography.labelSmall,
                             maxLines = 1)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft, onValueChange = { draft = it },
                    placeholder = { Text("Message…") },
                    modifier = Modifier.weight(1f),
                    maxLines = 4,
                )
                IconButton(
                    onClick = { vm.send(draft, convo); draft = "" },
                    enabled = draft.isNotBlank(),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send",
                         tint = MaterialTheme.colorScheme.primary)
                }
            }
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(thread, key = { it.id }) { message ->
                Row(Modifier.fillMaxWidth(),
                    horizontalArrangement = if (message.isMine) Arrangement.End else Arrangement.Start) {
                    Column(
                        Modifier
                            .widthIn(max = 280.dp)
                            .background(
                                if (message.isMine) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(16.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    ) {
                        Text(message.body,
                             color = if (message.isMine) MaterialTheme.colorScheme.onPrimary
                                     else MaterialTheme.colorScheme.onSurface)
                        Text(message.time, style = MaterialTheme.typography.labelSmall,
                             color = if (message.isMine)
                                 MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                             else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
