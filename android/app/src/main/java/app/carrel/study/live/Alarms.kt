package app.carrel.study.live

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object Alarms {
    private fun pending(context: Context, action: String, code: Int, deadline: Long = 0) = PendingIntent.getBroadcast(context, code,
        Intent(context, AlarmReceiver::class.java).setAction(action).putExtra("deadline", deadline),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** Wakes the app at the end of a focus or break period, and when a temporary message should disappear. */
    fun schedule(context: Context, state: State?, restoreAt: Long) {
        val manager = context.getSystemService(AlarmManager::class.java)
        val prefs = context.live.store.p
        val now = System.currentTimeMillis()
        for ((kind, code) in listOf(PulseKind.FOCUS to 1, PulseKind.BREAK to 3)) {
            val end = pulseDeadline(state, kind)
            val key = "scheduled${kind.name}"
            val previous = prefs.getLong(key, 0)
            val due = pending(context, "carrel.${kind.name}_DUE", code, end ?: 0)
            if (end != null && end > now) {
                set(manager, end, due); prefs.edit().putLong(key, end).apply()
            } else if (end == null || previous != end) {
                manager.cancel(due); prefs.edit().remove(key).apply()
            }
        }
        val restore = pending(context, "carrel.RESTORE", 2)
        if (restoreAt > now) set(manager, restoreAt, restore) else manager.cancel(restore)
    }

    private fun set(manager: AlarmManager, at: Long, intent: PendingIntent) {
        try {
            if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
        } catch (_: SecurityException) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
        }
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf("carrel.FOCUS_DUE", "carrel.BREAK_DUE", "carrel.RESTORE")) return
        val pending = goAsync()
        val live = context.live
        live.io.execute {
            try {
                live.engine.render()
                val kind = when (intent.action) { "carrel.FOCUS_DUE" -> PulseKind.FOCUS; "carrel.BREAK_DUE" -> PulseKind.BREAK; else -> null }
                if (kind != null) Nudges.fire(context, kind, intent.getLongExtra("deadline", Long.MIN_VALUE))
            } finally { pending.finish() }
        }
    }
}

/** A gentle double pulse when focus or break time ends. Never sound. */
object Nudges {
    fun fire(context: Context, kind: PulseKind, deadline: Long) {
        val store = context.live.store
        val enabled = if (kind == PulseKind.FOCUS) store.vibrateFocus else store.vibrateBreak
        val all = context.getSystemService(NotificationManager::class.java).currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALL
        if (!shouldPulse(deadline, pulseDeadline(store.active, kind), System.currentTimeMillis(), enabled, store.respectDnd, all)) return
        @Suppress("DEPRECATION")
        val vibrator = if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java).defaultVibrator
            else context.getSystemService(Vibrator::class.java)
        if (!vibrator.hasVibrator() || !store.claimPulse(kind, deadline)) return
        val amplitude = if (vibrator.hasAmplitudeControl()) 45 else VibrationEffect.DEFAULT_AMPLITUDE
        try {
            vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 120, 150, 120), intArrayOf(0, amplitude, 0, amplitude), -1),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build())
        } catch (_: RuntimeException) { /* a failed attempt must not repeat */ }
    }
}
