package app.carrel.study.live

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale

/** Builds a State from the server documents state/current and config/activities (same rules as liveStateOf in logic.js). */
object Mapper {
    private val HEX = Regex("^#[0-9A-Fa-f]{6}$")
    fun parseT(s: String?): Long? = try {
        if (s.isNullOrBlank()) null else SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(s)?.time
    } catch (e: Exception) { null }
    fun color(c: String?): String = if (c != null && HEX.matches(c)) c else "#B5543A"

    fun state(cur: JSONObject?, acts: JSONObject?): State? {
        if (cur == null || !cur.optBoolean("running", false)) return null
        val start = parseT(cur.optString("start")) ?: return null
        val items = acts?.optJSONObject("items")
        fun act(id: String?): Act {
            val o = if (id != null) items?.optJSONObject(id) else null
            return Act(id ?: "", (o?.optString("name") ?: id ?: "Study").ifBlank { "Study" }.take(80), color(o?.optString("color")))
        }
        val aid = cur.optString("activity")
        val a = act(aid)
        var breakId: String? = null
        if (items != null) {
            val keys = items.keys().asSequence().toList().sorted()
            breakId = keys.firstOrNull { k -> val o = items.optJSONObject(k); o != null && o.optString("role") == "break" && !o.optBoolean("archived", false) }
            if (breakId == null && items.has("break")) breakId = "break"
        }
        val pm = cur.optJSONObject("pomo")
        val ps = parseT(pm?.optString("phaseStart"))
        val id = cur.stringOrNull("id")
        if (breakId != null && aid == breakId) {
            var pomo: Pomo? = null
            if (pm != null && pm.optString("phase") == "break" && pm.optLong("breakLen") > 0 && ps != null) {
                pomo = Pomo(breakEndsAt = ps + pm.optLong("breakLen") * 60000)
            }
            val ra = cur.optJSONObject("ret")?.stringOrNull("activity")?.let { act(it) }
            return State(Status.BREAK, id, a, null, null, pomo, start, ra?.let { ReturnTo(it.name, it.color) })
        }
        val note = cur.optString("note").trim()
        var pomo: Pomo? = null
        if (pm != null && pm.optString("phase") == "focus" && pm.optLong("focus") > 0 && ps != null) {
            pomo = Pomo(focusEndsAt = ps + pm.optLong("focus") * 60000)
        }
        return State(Status.RUNNING, id, a, start, if (note.isEmpty()) null else note.take(200), pomo)
    }
}
