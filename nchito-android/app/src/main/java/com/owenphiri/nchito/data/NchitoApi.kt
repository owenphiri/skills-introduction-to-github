package com.owenphiri.nchito.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Thin PostgREST + RPC + Storage client over HttpURLConnection.
 *
 * A transport, not a data layer: it knows how to talk to Supabase and nothing
 * about gigs or wallets — that lives in LiveRepository. Mirrors the iOS
 * NchitoAPI so the two stay comparable.
 *
 * The caller's access token goes on every request, so Row Level Security applies
 * exactly as it does in the SQL. Without it PostgREST falls back to the anon
 * role and quietly returns nothing.
 */
class NchitoApi {

    class ApiException(message: String, val status: Int = -1) : Exception(message)

    private var accessToken: String = ""

    fun setAccessToken(token: String) { accessToken = token }

    companion object {
        val json = Json {
            ignoreUnknownKeys = true      // tolerate columns added by later migrations
            coerceInputValues = true
        }
        /** Zambian mobile data can be slow; fail in a human timeframe. */
        private const val TIMEOUT_MS = 20_000
    }

    suspend fun get(table: String, query: String): String =
        request("/rest/v1/$table?$query", "GET", null)

    suspend fun insert(table: String, body: String): String =
        request("/rest/v1/$table", "POST", body, prefer = "return=representation")

    /**
     * Calls a Postgres function. Most writes go through these rather than
     * direct table writes, because the rules — commission tiering, proof gates,
     * PIN checks — live in the functions and must not be skippable by a client.
     */
    suspend fun rpc(function: String, args: String = "{}"): String =
        request("/rest/v1/rpc/$function", "POST", args)

    suspend fun upload(bucket: String, path: String, bytes: ByteArray, contentType: String): String {
        requestRaw("/storage/v1/object/$bucket/$path", "POST", bytes, contentType)
        return path
    }

    private suspend fun request(
        path: String, method: String, body: String?, prefer: String? = null,
    ): String = requestRaw(path, method, body?.toByteArray(), "application/json", prefer)

    private suspend fun requestRaw(
        path: String, method: String, body: ByteArray?,
        contentType: String, prefer: String? = null,
    ): String = withContext(Dispatchers.IO) {
        if (!SupabaseConfig.isConfigured) throw ApiException("Supabase isn't configured yet.")
        if (accessToken.isEmpty()) throw ApiException("Please sign in again.")

        val connection = (URL(SupabaseConfig.PROJECT_URL + path).openConnection() as HttpURLConnection)
        try {
            connection.requestMethod = method
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.setRequestProperty("apikey", SupabaseConfig.ANON_KEY)
            connection.setRequestProperty("Authorization", "Bearer $accessToken")
            connection.setRequestProperty("Content-Type", contentType)
            prefer?.let { connection.setRequestProperty("Prefer", it) }

            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body) }
            }

            val status = connection.responseCode
            if (status !in 200..299) {
                val error = connection.errorStream
                    ?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
                throw ApiException(friendlyMessage(status, error), status)
            }
            connection.inputStream.bufferedReader().use(BufferedReader::readText)
        } finally {
            connection.disconnect()
        }
    }

    /** 401/403 nearly always means an expired token or an RLS refusal, which the user can act on. */
    private fun friendlyMessage(status: Int, body: String): String {
        if (status == 401 || status == 403) return "Your session has expired. Please sign in again."
        val parsed = runCatching {
            json.parseToJsonElement(body).jsonObject["message"]?.jsonPrimitive?.content
        }.getOrNull()
        return parsed ?: "Server error ($status)."
    }
}

/** RPCs that return a bare scalar come back as a JSON string or number. */
fun String.asScalarString(): String = runCatching {
    NchitoApi.json.parseToJsonElement(this).jsonPrimitive.content
}.getOrDefault(this.trim('"'))

fun JsonElement.stringOrNull(key: String): String? =
    runCatching { jsonObject[key]?.jsonPrimitive?.content }.getOrNull()
