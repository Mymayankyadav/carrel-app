package app.carrel.study.live

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/** All state the notification needs, kept on the device so it works when the web view is not running. */
class Store(ctx: Context) {
    val p: SharedPreferences = ctx.getSharedPreferences("carrel_live", Context.MODE_PRIVATE)

    var url: String get() = p.getString("url", "") ?: ""; set(v) { p.edit().putString("url", v).apply() }
    var key: String get() = p.getString("key", "") ?: ""; set(v) { p.edit().putString("key", v).apply() }
    var access: String get() = p.getString("access", "") ?: ""; private set(v) { p.edit().putString("access", v).apply() }
    var refresh: String get() = p.getString("refresh", "") ?: ""; private set(v) { p.edit().putString("refresh", v).apply() }
    var expiresAt: Long get() = p.getLong("expiresAt", 0); private set(v) { p.edit().putLong("expiresAt", v).apply() }
    fun setSession(a: String, r: String, exp: Long) { p.edit().putString("access", a).putString("refresh", r).putLong("expiresAt", exp).apply() }
    fun clearSession() { p.edit().remove("access").remove("refresh").remove("expiresAt").remove("active").remove("queue").remove("undoOid").apply() }
    fun hasSession() = access.isNotBlank() && refresh.isNotBlank()

    var active: State?
        get() = p.getString("active", null)?.let { try { stateFromJson(JSONObject(it)) } catch (e: Exception) { null } }
        set(v) { p.edit().apply { if (v == null) remove("active") else putString("active", stateToJson(v).toString()) }.apply() }

    /** Native surfaces may read cached values without querying user data themselves. */
    var todayStudyMs: Long get() = p.getLong("todayStudyMs", 0L); set(v) { p.edit().putLong("todayStudyMs", v).apply() }
    var todayKey: String get() = p.getString("todayKey", "") ?: ""; set(v) { p.edit().putString("todayKey", v).apply() }
    var todayAsOf: Long get() = p.getLong("todayAsOf", 0L); set(v) { p.edit().putLong("todayAsOf", v).apply() }
    var studyRunning: Boolean get() = p.getBoolean("studyRunning", false); set(v) { p.edit().putBoolean("studyRunning", v).apply() }
    var lastStudyId: String get() = p.getString("lastStudyId", "") ?: ""; set(v) { p.edit().putString("lastStudyId", v).apply() }
    var topActivities: String get() = p.getString("topActivities", "[]") ?: "[]"; set(v) { p.edit().putString("topActivities", v).apply() }

    var feedbackUntil: Long get() = p.getLong("feedbackUntil", 0); set(v) { p.edit().putLong("feedbackUntil", v).apply() }
    var warning: String? get() = p.getString("warning", null); set(v) { p.edit().putString("warning", v).apply() }
    var warningUntil: Long get() = p.getLong("warningUntil", 0); set(v) { p.edit().putLong("warningUntil", v).apply() }

    fun tally(startedAt: Long): Int = if (p.getLong("tallyFor", -1) == startedAt) p.getInt("tally", 0) else 0
    fun bumpTally(startedAt: Long) {
        val n = tally(startedAt) + 1
        p.edit().putLong("tallyFor", startedAt).putInt("tally", n).apply()
    }

    // prefs
    var vibrateFocus: Boolean get() = p.getBoolean("vibrateFocus", true); set(v) { p.edit().putBoolean("vibrateFocus", v).apply() }
    var vibrateBreak: Boolean get() = p.getBoolean("vibrateBreak", false); set(v) { p.edit().putBoolean("vibrateBreak", v).apply() }
    var respectDnd: Boolean get() = p.getBoolean("respectDnd", true); set(v) { p.edit().putBoolean("respectDnd", v).apply() }
    var privacy: Boolean get() = p.getBoolean("privacy", false); set(v) { p.edit().putBoolean("privacy", v).apply() }
    var notifDistractions: Boolean get() = p.getBoolean("notifDistractions", false); set(v) { p.edit().putBoolean("notifDistractions", v).apply() }

    /** Vibrate once per deadline, across process restarts. */
    fun claimPulse(kind: PulseKind, deadline: Long): Boolean {
        val k = "pulse${kind.name}"
        if (p.getLong(k, 0) == deadline) return false
        p.edit().putLong(k, deadline).apply()
        return true
    }

    // 10 second undo for Stop
    var undoOid: String? get() = p.getString("undoOid", null); set(v) { p.edit().apply { if (v == null) remove("undoOid") else putString("undoOid", v) }.apply() }
    var undoAt: Long get() = p.getLong("undoAt", 0); set(v) { p.edit().putLong("undoAt", v).apply() }
    var undoPrev: String? get() = p.getString("undoPrev", null); set(v) { p.edit().apply { if (v == null) remove("undoPrev") else putString("undoPrev", v) }.apply() }

    // queued server calls, oldest first: { oid, fn, args, notBefore }
    @Synchronized fun queue(): List<JSONObject> {
        val arr = try { JSONArray(p.getString("queue", "[]")) } catch (e: Exception) { JSONArray() }
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }
    @Synchronized private fun saveQueue(l: List<JSONObject>) { p.edit().putString("queue", JSONArray(l).toString()).apply() }
    @Synchronized fun enqueue(op: JSONObject) { saveQueue(queue() + op) }
    @Synchronized fun removeOp(oid: String): Boolean { val q = queue(); val n = q.filter { it.optString("oid") != oid }; saveQueue(n); return n.size != q.size }
}
