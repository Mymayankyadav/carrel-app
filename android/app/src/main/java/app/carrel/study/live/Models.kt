package app.carrel.study.live

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

enum class Status { RUNNING, BREAK }
data class Act(val id: String, val name: String, val color: String)
data class ReturnTo(val name: String, val color: String)
data class Pomo(val focusEndsAt: Long? = null, val breakEndsAt: Long? = null)

/** The timer as the notification needs it. "No timer" is represented by null, never by a State. */
data class State(
    val status: Status,
    val id: String? = null,
    val activity: Act? = null,
    val startedAt: Long? = null,
    val intention: String? = null,
    val pomo: Pomo? = null,
    val breakStartedAt: Long? = null,
    val returnTo: ReturnTo? = null,
)

fun JSONObject.longOrNull(k: String): Long? = if (has(k) && !isNull(k)) optLong(k) else null
fun JSONObject.stringOrNull(k: String): String? = if (has(k) && !isNull(k)) optString(k) else null

/** Parses the JSON shape produced by liveStateOf() in logic.js (plus an "id" field). Returns null for idle or invalid. */
fun stateFromJson(o: JSONObject?): State? {
    if (o == null) return null
    val status = when (o.optString("status")) { "running" -> Status.RUNNING; "break" -> Status.BREAK; else -> return null }
    val a = o.optJSONObject("activity")?.let { Act(it.optString("id"), it.optString("name"), it.optString("color")) }
    val rt = o.optJSONObject("returnTo")?.let { ReturnTo(it.optString("name"), it.optString("color")) }
    val p = o.optJSONObject("pomo")?.let { Pomo(it.longOrNull("focusEndsAt"), it.longOrNull("breakEndsAt")) }
    val st = State(status, o.stringOrNull("id"), a, o.longOrNull("startedAt"), o.stringOrNull("intention"), p, o.longOrNull("breakStartedAt"), rt)
    return when (status) {
        Status.RUNNING -> if (a != null && st.startedAt != null && (p == null || p.focusEndsAt != null)) st else null
        Status.BREAK -> if (st.breakStartedAt != null) st else null
    }
}

fun stateToJson(s: State): JSONObject {
    val o = JSONObject()
    o.put("status", if (s.status == Status.RUNNING) "running" else "break")
    o.putOpt("id", s.id)
    s.activity?.let { o.put("activity", JSONObject().put("id", it.id).put("name", it.name).put("color", it.color)) }
    o.putOpt("startedAt", s.startedAt)
    o.putOpt("intention", s.intention)
    s.pomo?.let { o.put("pomo", JSONObject().putOpt("focusEndsAt", it.focusEndsAt).putOpt("breakEndsAt", it.breakEndsAt)) }
    o.putOpt("breakStartedAt", s.breakStartedAt)
    s.returnTo?.let { o.put("returnTo", JSONObject().put("name", it.name).put("color", it.color)) }
    return o
}

fun isoUtc(ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(java.util.Date(ms))
