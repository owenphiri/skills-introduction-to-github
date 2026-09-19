package com.owenphiri.nchito

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.owenphiri.nchito.data.AppViewModel
import com.owenphiri.nchito.ui.NchitoTheme
import com.owenphiri.nchito.ui.screens.AuthScreen
import com.owenphiri.nchito.ui.screens.ChatListScreen
import com.owenphiri.nchito.ui.screens.ChatThreadScreen
import com.owenphiri.nchito.ui.screens.GigDetailScreen
import com.owenphiri.nchito.ui.screens.HomeScreen
import com.owenphiri.nchito.ui.screens.ProfileScreen
import com.owenphiri.nchito.ui.screens.TasksScreen
import com.owenphiri.nchito.ui.screens.WalletScreen
import com.owenphiri.nchito.ui.screens.WorkRecordScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NchitoTheme { NchitoApp() }
        }
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("gigs", "Gigs", Icons.Filled.Work),
    Tab("tasks", "Quick Tasks", Icons.Filled.Bolt),
    Tab("chats", "Chats", Icons.Filled.Chat),
    Tab("wallet", "Wallet", Icons.Filled.AccountBalanceWallet),
    Tab("profile", "Profile", Icons.Filled.Person),
)

@Composable
fun NchitoApp(vm: AppViewModel = viewModel()) {
    if (!vm.isSignedIn) {
        AuthScreen(vm)
        return
    }

    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = "gigs",
            modifier = Modifier.padding(padding),
        ) {
            composable("gigs") { HomeScreen(vm, onOpenGig = { navController.navigate("gig/$it") }) }
            composable("gig/{id}") { entry ->
                GigDetailScreen(
                    vm = vm,
                    gigId = entry.arguments?.getString("id"),
                    onMessagePoster = { navController.navigate("chat/$it") },
                    onBack = { navController.popBackStack() },
                )
            }
            composable("tasks") { TasksScreen(vm) }
            composable("chats") { ChatListScreen(vm, onOpenChat = { navController.navigate("chat/$it") }) }
            composable("chat/{id}") { entry ->
                ChatThreadScreen(
                    vm = vm,
                    conversationId = entry.arguments?.getString("id"),
                    onBack = { navController.popBackStack() },
                )
            }
            composable("wallet") { WalletScreen(vm) }
            composable("profile") {
                ProfileScreen(vm, onOpenWorkRecord = { navController.navigate("workrecord") })
            }
            composable("workrecord") {
                WorkRecordScreen(vm, onBack = { navController.popBackStack() })
            }
        }
    }
}
