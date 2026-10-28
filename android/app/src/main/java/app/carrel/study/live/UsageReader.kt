package app.carrel.study.live

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import org.json.JSONObject

/** Device-only, explicitly opt-in foreground metadata. No URLs, titles or app content. */
data class L6UsageTick(val pkg: String, val at: Long, val resumed: Boolean)
data class L6UsageTotal(val pkg: String, val ms: Long, val opens: Int)

object UsageReader {
    const val MAX_WINDOW_MS = 24L * 60 * 60 * 1000
    val DEFAULT_PACKAGES = listOf(
        "com.instagram.android", "com.google.android.youtube", "com.whatsapp",
        "com.twitter.android", "com.zhiliaoapp.musically", "com.reddit.frontpage",
        "com.snapchat.android", "com.facebook.katana", "in.startv.hotstar",
        "com.netflix.mediaclient"
    )
    private val labels = mapOf(
        "com.instagram.android" to "Instagram", "com.google.android.youtube" to "YouTube",
        "com.whatsapp" to "WhatsApp", "com.twitter.android" to "X",
        "com.zhiliaoapp.musically" to "TikTok", "com.reddit.frontpage" to "Reddit",
        "com.snapchat.android" to "Snapchat", "com.facebook.katana" to "Facebook",
        "in.startv.hotstar" to "Hotstar", "com.netflix.mediaclient" to "Netflix"
    )

    fun hasAccess(context: Context): Boolean {
        val manager = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        return manager.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    }

    /** Window clipping matters: an app could already be open before focus starts. */
    fun summarise(events: List<L6UsageTick>, start: Long, end: Long,
                  selected: Set<String>): List<L6UsageTotal> {
        if (end <= start || end - start > MAX_WINDOW_MS || selected.isEmpty()) return emptyList()
        val active = mutableMapOf<String, Long>()
        val total = mutableMapOf<String, Long>()
        val opens = mutableMapOf<String, Int>()
        for (tick in events.sortedBy { it.at }) {
            if (tick.at > end) break
            if (tick.pkg !in selected) continue
            if (tick.resumed) {
                if (!active.containsKey(tick.pkg)) {
                    active[tick.pkg] = tick.at
                    if (tick.at in start until end) opens[tick.pkg] = (opens[tick.pkg] ?: 0) + 1
                }
            } else {
                val begin = active.remove(tick.pkg) ?: continue
                total[tick.pkg] = (total[tick.pkg] ?: 0L) +
                    (minOf(end, tick.at) - maxOf(start, begin)).coerceAtLeast(0L)
            }
        }
        for ((pkg, begin) in active)
            total[pkg] = (total[pkg] ?: 0L) + (end - maxOf(start, begin)).coerceAtLeast(0L)
        return total.keys.sorted().map { L6UsageTotal(it, total[it] ?: 0L, opens[it] ?: 0) }
            .filter { it.ms > 0L }
    }

    /** Uses the 24h pre-window to reconstruct foreground apps active at session start. */
    fun read(context: Context, start: Long, end: Long, packages: List<String>): List<JSONObject> {
        if (!hasAccess(context) || start < 0 || end <= start ||
            end - start > MAX_WINDOW_MS) return emptyList()
        val selected = packages.distinct().take(20).filter { it in DEFAULT_PACKAGES }.toSet()
        if (selected.isEmpty()) return emptyList()
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyList()
        val events = manager.queryEvents((start - MAX_WINDOW_MS).coerceAtLeast(0L), end)
            ?: return emptyList()
        val event = UsageEvents.Event()
        val ticks = mutableListOf<L6UsageTick>()
        while (events.hasNextEvent() && ticks.size < 50_000) {
            events.getNextEvent(event)
            if (event.packageName !in selected) continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> ticks.add(
                    L6UsageTick(event.packageName, event.timeStamp, true))
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> ticks.add(
                    L6UsageTick(event.packageName, event.timeStamp, false))
            }
        }
        return summarise(ticks, start, end, selected).map {
            JSONObject().put("pkg", it.pkg).put("label", labels[it.pkg] ?: it.pkg.take(80))
                .put("min", ((it.ms + 30_000L) / 60_000L).toInt())
                .put("opens", it.opens)
        }
    }
}
