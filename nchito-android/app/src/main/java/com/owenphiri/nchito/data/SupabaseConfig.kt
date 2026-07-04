package com.owenphiri.nchito.data

/**
 * Fill these in from your Supabase project (Settings → API) to go live.
 * Left empty, the app runs in demo mode: any phone number signs in with OTP 123456.
 * See nchito-ios/supabase/README.md for backend setup.
 */
object SupabaseConfig {
    const val PROJECT_URL = "" // e.g. "https://abcdefgh.supabase.co"
    const val ANON_KEY = ""

    val isConfigured: Boolean
        get() = PROJECT_URL.isNotEmpty() && ANON_KEY.isNotEmpty()
}
