package app.carrel.study.live

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Minimal Supabase client: token refresh, RPC calls and one state read. No dependencies. */
class Api(private val s: Store) {
    class HttpError(val code: Int, msg: String) : Exception(msg)

    private fun request(method: String, path: String, body: String?, auth: Boolean): String {
        val c = URL(s.url + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 10000; c.readTimeout = 10000
            c.setRequestProperty("apikey", s.key)
            if (auth) c.setRequestProperty("Authorization", "Bearer " + s.access)
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = c.responseCode
            val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw HttpError(code, text.take(300))
            return text
        } finally { c.disconnect() }
    }

    @Synchronized fun refreshToken() {
        if (s.refresh.isBlank()) throw HttpError(401, "not signed in")
        val r = JSONObject(request("POST", "/auth/v1/token?grant_type=refresh_token",
            JSONObject().put("refresh_token", s.refresh).toString(), false))
        val exp = if (r.has("expires_at")) r.getLong("expires_at") * 1000 else System.currentTimeMillis() + r.optLong("expires_in", 3600) * 1000
        s.setSession(r.getString("access_token"), r.getString("refresh_token"), exp)
        CarrelLivePlugin.emitSession(s)
    }

    private fun ensureToken() {
        if (!s.hasSession()) throw HttpError(401, "not signed in")
        if (s.expiresAt - 60_000 < System.currentTimeMillis()) refreshToken()
    }

    private fun authed(method: String, path: String, body: String?): String {
        ensureToken()
        return try { request(method, path, body, true) }
        catch (e: HttpError) { if (e.code == 401) { refreshToken(); request(method, path, body, true) } else throw e }
    }

    fun rpc(fn: String, args: JSONObject): JSONObject = JSONObject(authed("POST", "/rest/v1/rpc/$fn", args.toString()))

    /** Current timer from the server, or null when nothing is running. */
    fun fetchState(): State? {
        val rows = JSONArray(authed("GET", "/rest/v1/docs?select=path,data&path=in.(state/current,config/activities)", null))
        var cur: JSONObject? = null; var acts: JSONObject? = null
        for (i in 0 until rows.length()) {
            val r = rows.getJSONObject(i)
            when (r.optString("path")) { "state/current" -> cur = r.optJSONObject("data"); "config/activities" -> acts = r.optJSONObject("data") }
        }
        return Mapper.state(cur, acts)
    }
}
