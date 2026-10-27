package app.carrel.study.live

import android.app.AlertDialog
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.app.RemoteInput
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.Constraints
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val at = System.currentTimeMillis()
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(Notifications.REPLY)?.toString()
        val pending = goAsync()
        val live = context.live
        live.io.execute {
            try {
                when (intent.action) {
                    "carrel.STOP" -> live.engine.act("stop", at)
                    "carrel.BREAK" -> live.engine.act("break", at)
                    "carrel.URGE" -> live.engine.act("urge", at)
                    "carrel.PARK" -> if (!text.isNullOrBlank()) live.engine.act("park", at, text = text.trim().take(500)) else live.engine.render()
                    "carrel.UNDO" -> intent.getStringExtra("oid")?.let { live.engine.undoStop(it) }
                }
            } finally { pending.finish() }
        }
    }
}

/** "Drifted for 1 / 5 / 15 min", a small dialog over whatever is on screen. */
class DriftActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val at = savedInstanceState?.getLong("at") ?: System.currentTimeMillis()
        tapAt = at
        val minutes = intArrayOf(1, 5, 15)
        AlertDialog.Builder(this).setTitle("Drifted for")
            .setItems(arrayOf("1 min", "5 min", "15 min")) { _, i ->
                val live = applicationContext.live
                live.io.execute { live.engine.act("drift", at, minutes[i]) }
                finish()
            }
            .setNegativeButton("Cancel") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }
    private var tapAt = 0L
    override fun onSaveInstanceState(outState: Bundle) { outState.putLong("at", tapAt); super.onSaveInstanceState(outState) }
}

class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
                Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_TIME_CHANGED,
                "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED")) return
        val pending = goAsync()
        val live = context.live
        schedulePeriodic(context)
        live.io.execute {
            try { live.engine.render(); Flush.run(live); live.engine.refreshFromServer() } finally { pending.finish() }
        }
    }
}

fun schedulePeriodic(context: Context) {
    val req = PeriodicWorkRequest.Builder(RefreshWorker::class.java, 15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork("carrel-refresh", ExistingPeriodicWorkPolicy.KEEP, req)
}
