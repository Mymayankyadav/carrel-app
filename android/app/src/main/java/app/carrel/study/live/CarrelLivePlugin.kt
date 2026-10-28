package app.carrel.study.live

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import org.json.JSONArray

/** Bridge between the Carrel web code and the native notification. */
@CapacitorPlugin(
    name = "CarrelLive",
    permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")]
)
class CarrelLivePlugin : Plugin() {
    companion object {
        @Volatile private var instance: CarrelLivePlugin? = null
        @JvmStatic
        fun emitIncoming(raw: JSONObject) {
            instance?.notifyListeners("incoming", JSObject()
                .put("id", raw.optString("id"))
                .put("kind", raw.optString("kind"))
                .put("value", raw.optString("value")))
        }
        fun emitSession(s: Store) {
            instance?.notifyListeners("session", JSObject().put("access", s.access).put("refresh", s.refresh).put("expiresAt", s.expiresAt))
        }
        fun emitAction(fn: String, ok: Boolean, reason: String?) {
            instance?.notifyListeners("action", JSObject().put("fn", fn).put("ok", ok).put("reason", reason ?: ""))
        }
    }
    private val live get() = context.live

    override fun load() {
        instance = this
        schedulePeriodic(context)
        live.io.execute { live.engine.render() }
    }

    /** Cold-start-safe handoff: do not remove until JS acknowledges handling. */
    @com.getcapacitor.PluginMethod
    fun consumeIncoming(call: PluginCall) {
        val raw = live.store.p.getString("pendingIncoming", null)
        val item = runCatching { JSONObject(raw ?: "{}") }.getOrNull()
        call.resolve(JSObject()
            .put("id", item?.optString("id") ?: "")
            .put("kind", item?.optString("kind") ?: "")
            .put("value", item?.optString("value") ?: ""))
    }

    @com.getcapacitor.PluginMethod
    fun ackIncoming(call: PluginCall) {
        val id = call.getString("id") ?: ""
        val p = live.store.p
        val raw = p.getString("pendingIncoming", null)
        val pending = runCatching { JSONObject(raw ?: "{}") }.getOrNull()
        if (id.isNotBlank() && id == pending?.optString("id")) {
            p.edit().remove("pendingIncoming").apply()
        }
        call.resolve()
    }

    @com.getcapacitor.PluginMethod
    fun configure(call: PluginCall) {
        live.store.url = call.getString("url", "") ?: ""
        live.store.key = call.getString("key", "") ?: ""
        call.resolve()
    }

    @com.getcapacitor.PluginMethod
    fun setSession(call: PluginCall) {
        val a = call.getString("access") ?: ""; val r = call.getString("refresh") ?: ""
        val exp = call.getLong("expiresAt", 0L) ?: 0L
        if (a.isNotBlank() && r.isNotBlank()) live.store.setSession(a, r, exp)
        live.io.execute { Flush.run(live) }
        call.resolve()
    }

    @com.getcapacitor.PluginMethod
    fun getSession(call: PluginCall) {
        val s = live.store
        val o = JSObject()
        if (s.hasSession()) o.put("access", s.access).put("refresh", s.refresh).put("expiresAt", s.expiresAt)
        call.resolve(o)
    }

    @com.getcapacitor.PluginMethod
    fun clearSession(call: PluginCall) {
        live.io.execute { live.store.clearSession(); CarrelShortcuts.refresh(context); live.engine.render() }
        call.resolve()
    }

    /** The web view owns the authoritative read projection; surfaces cache it. */
    @com.getcapacitor.PluginMethod
    fun setState(call: PluginCall) {
        val st = call.getObject("state")
        val id = call.getString("id")
        val total = (call.getLong("todayStudyMs", 0L) ?: 0L).coerceAtLeast(0)
        val day = call.getString("todayKey", "") ?: ""
        val study = call.getBoolean("studyRunning", false) ?: false
        val last = call.getString("lastStudyId", "") ?: ""
        val tops = call.getArray("topActivities")?.toString() ?: "[]"
        call.resolve()
        live.io.execute {
            val store = live.store
            store.todayStudyMs = total
            store.todayKey = day
            store.todayAsOf = System.currentTimeMillis()
            store.studyRunning = study
            store.lastStudyId = last.take(100)
            if (tops != store.topActivities) {
                store.topActivities = tops.take(4000)
                CarrelShortcuts.refresh(context)
            }
            val json = try { JSONObject(st.toString()) } catch (_: Exception) { null }
            if (json != null && id != null) json.put("id", id)
            live.engine.setState(stateFromJson(json))
            // Totals can change while the timer state remains identical.
            live.engine.render()
        }
    }

    @com.getcapacitor.PluginMethod
    fun setPrefs(call: PluginCall) {
        val s = live.store
        call.getBoolean("vibrateFocus")?.let { s.vibrateFocus = it }
        call.getBoolean("vibrateBreak")?.let { s.vibrateBreak = it }
        call.getBoolean("respectDnd")?.let { s.respectDnd = it }
        call.getBoolean("privacy")?.let { s.privacy = it }
        call.getBoolean("notifDistractions")?.let { s.notifDistractions = it }
        call.getBoolean("detectDrift")?.let { s.detectDrift = it }
        call.getArray("usagePackages")?.let { arr ->
            s.usagePackages = (0 until arr.length()).map { arr.optString(it) }
        }
        live.io.execute { live.engine.render() }
        call.resolve(prefs())
    }

    @com.getcapacitor.PluginMethod
    fun testNudge(call: PluginCall) { live.io.execute { Nudges.test(context); call.resolve(prefs()) } }

    @com.getcapacitor.PluginMethod
    fun getPrefs(call: PluginCall) { call.resolve(prefs()) }

    private fun prefs(): JSObject {
        val s = live.store
        return JSObject().put("vibrateFocus", s.vibrateFocus).put("vibrateBreak", s.vibrateBreak)
            .put("respectDnd", s.respectDnd).put("privacy", s.privacy)
            .put("notifDistractions", s.notifDistractions)
            .put("detectDrift", s.detectDrift)
            .put("usageDetectionSupported", true)
            .put("usagePackages", JSONArray(s.usagePackages))
            .put("usageAccess", UsageReader.hasAccess(context))
            .put("lastNudge", s.p.getString("lastNudge", ""))
            .put("notifications", live.notifications.allowed())
            .put("exactAlarms", Build.VERSION.SDK_INT < 31 || context.getSystemService(android.app.AlarmManager::class.java).canScheduleExactAlarms())
    }

    @com.getcapacitor.PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsResult")
        } else call.resolve(prefs())
    }

    @PermissionCallback
    fun notificationsResult(call: PluginCall) {
        live.io.execute { live.engine.render() }
        call.resolve(prefs())
    }

    @com.getcapacitor.PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        val i = if (Build.VERSION.SDK_INT >= 31) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName))
            else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
        open(i); call.resolve()
    }

    @com.getcapacitor.PluginMethod
    fun hasUsageAccess(call: PluginCall) {
        call.resolve(JSObject().put("allowed", UsageReader.hasAccess(context)))
    }

    @com.getcapacitor.PluginMethod
    fun openUsageAccess(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 21) {
            open(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }
        call.resolve(JSObject().put("allowed", UsageReader.hasAccess(context)))
    }

    @com.getcapacitor.PluginMethod
    fun sessionUsage(call: PluginCall) {
        val start = call.getLong("startMs", 0L) ?: 0L
        val end = call.getLong("endMs", 0L) ?: 0L
        if (!live.store.detectDrift || !UsageReader.hasAccess(context)) {
            call.resolve(JSObject().put("apps", JSONArray()))
            return
        }
        live.io.execute {
            // Settings can be changed while this queued task is waiting or
            // while UsageStatsManager is scanning its bounded event window.
            // Check consent at both boundaries; never expose a revoked read.
            val selected = if (live.store.detectDrift && UsageReader.hasAccess(context))
                live.store.usagePackages else emptyList()
            val result = if (selected.isEmpty()) emptyList() else
                runCatching { UsageReader.read(context, start, end, selected) }
                    .getOrDefault(emptyList())
            val stillAllowed = live.store.detectDrift && UsageReader.hasAccess(context) &&
                live.store.usagePackages == selected
            val arr = JSONArray()
            if (stillAllowed) for (item in result) arr.put(item)
            call.resolve(JSObject().put("apps", arr))
        }
    }

    @com.getcapacitor.PluginMethod
    fun openBatterySettings(call: PluginCall) {
        open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))
        call.resolve(JSObject().put("help", batteryHelp()))
    }

    private fun open(i: Intent) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(i) } catch (_: Exception) { runCatching { context.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
    }

    private fun batteryHelp(): String {
        val brand = (Build.MANUFACTURER + " " + Build.BRAND).lowercase()
        return when {
            listOf("xiaomi", "redmi", "poco").any { it in brand } -> "Xiaomi/Redmi/POCO: App info → Autostart: on. Battery saver → No restrictions. Lock Carrel in Recents."
            "oppo" in brand || "realme" in brand -> "Oppo/Realme: App info → Battery usage: allow background activity and auto launch."
            "vivo" in brand || "iqoo" in brand -> "Vivo: iManager → App manager → Autostart: on. Battery → Background power consumption: allow."
            "oneplus" in brand -> "OnePlus: App info → Battery usage: allow background activity. Battery optimization → Don't optimize."
            "samsung" in brand -> "Samsung: Battery → Background usage limits → Never sleeping apps: add Carrel. App info → Battery → Unrestricted."
            else -> "App info → Battery → Unrestricted (or Don't optimize)."
        }
    }
}
