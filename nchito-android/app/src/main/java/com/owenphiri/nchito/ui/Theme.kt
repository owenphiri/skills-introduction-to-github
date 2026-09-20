package com.owenphiri.nchito.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Zambian-flag palette, matching the iOS Theme.
object NchitoColors {
    val Green = Color(0xFF198A00)
    val Copper = Color(0xFFEF7D00)
    val Red = Color(0xFFDE2010)
}

private val LightColors = lightColorScheme(
    primary = NchitoColors.Green,
    secondary = NchitoColors.Copper,
    error = NchitoColors.Red,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5FBF4A),
    secondary = Color(0xFFFFA64D),
    error = Color(0xFFFF6B5E),
)

@Composable
fun NchitoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
