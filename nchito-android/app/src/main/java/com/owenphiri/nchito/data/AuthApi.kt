package com.owenphiri.nchito.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Phone-OTP against Supabase GoTrue. Separate from NchitoApi because these calls
 * are the one place that runs BEFORE a token exists — they authenticate with the
 * anon key alone.
 */
object AuthApi {

    data class Session(val accessToken: String, val userId: UUID)

    suspend fun requestOtp(phone: String) {
        post("/auth/v1/otp", buildJsonObject { put("phone", phone) }.toString())
    }

    suspend fun verifyOtp(phone: String, code: String): Session {
        val body = buildJsonObject {
            put("phone", phone); put("token", code); put("type", "sms")
        }.toString()
        val raw = post("/auth/v1/verify", body)
        val root = NchitoApi.json.parseToJsonElement(raw).jsonObject
        return Session(
            accessToken = root["access_token"]?.jsonPrimitive?.content.orEmpty(),
            userId = UUID.fromString(
                root["user"]?.jsonObject?.get("id")?.jsonPrimitive?.content),
        )
    }

    private suspend fun post(path: String, body: String): String = withContext(Dispatchers.IO) {
        val connection = (URL(SupabaseConfig.PROJECT_URL + path).openConnection() as HttpURLConnection)
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 20_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("apikey", SupabaseConfig.ANON_KEY)
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toByteArray()) }

            if (connection.responseCode !in 200..299) {
                throw NchitoApi.ApiException("Authentication failed", connection.responseCode)
            }
            connection.inputStream.bufferedReader().use(BufferedReader::readText)
        } finally {
            connection.disconnect()
        }
    }
}
