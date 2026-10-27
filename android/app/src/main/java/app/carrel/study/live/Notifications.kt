package app.carrel.study.live

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import app.carrel.study.R
import org.json.JSONObject

/** Standard system notifications only; no RemoteViews or custom expanded layout. */
class Notifications(private val context: Context, private val store: Store) {
    companion object {
        const val ID = 41
        const val UNDO_ID = 42
        const val CHANNEL = "carrel_live_silent_v1"
        const val REPLY = "park_text"
        private const val ACCENT = "#0F766E"
    }

    fun createChannel() {
        val channel = NotificationChannel(CHANNEL, "Live study timer (silent)", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Quiet study timer"
            setSound(null, null)
            enableVibration(false)
            vibrationPattern = longArrayOf(0)
            setShowBadge(false)
            enableLights(false)
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun allowed(): Boolean = (Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    private fun action(name: String, code: Int, mutable: Boolean = false, extra: ((Intent) -> Unit)? = null): PendingIntent {
        val i = Intent(context, ActionReceiver::class.java).setAction(name)
        extra?.invoke(i)
        return PendingIntent.getBroadcast(context, code, i,
            PendingIntent.FLAG_UPDATE_CURRENT or if (mutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE)
    }

    private fun activity(cls: Class<*>, code: Int): PendingIntent =
        PendingIntent.getActivity(context, code, Intent(context, cls),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun openApp(): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        return PendingIntent.getActivity(context, 10, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun base() = NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.ic_carrel)
        .setSilent(true).setSound(null).setVibrate(longArrayOf(0)).setDefaults(0)
        .setOnlyAlertOnce(true).setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setOngoing(true).setAutoCancel(false).setShowWhen(true)
        .setColor(Color.parseColor(ACCENT)).setColorized(false)
        .setContentIntent(openApp())

    fun build(model: NotificationModel): Notification {
        val b = base().setContentTitle(model.title)
            .setWhen(model.whenMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(model.countDown)
        if (!model.text.isNullOrBlank()) b.setContentText(model.text)

        // The useful action must never be pushed out of the notification shade
        // by optional distraction buttons.
        if (model.canTakeBreak) b.addAction(R.drawable.ic_carrel, "Break", action("carrel.BREAK", 16))
        if (model.canStop) b.addAction(R.drawable.ic_carrel, "Stop", action("carrel.STOP", 15))
        // Native Engine has no resume-from-break command yet. Do not offer an inert Resume.
        if (store.notifDistractions) {
            b.addAction(R.drawable.ic_carrel, "Urge", action("carrel.URGE", 11))
            b.addAction(R.drawable.ic_carrel, "Drifted", activity(DriftActivity::class.java, 12))
            b.addAction(NotificationCompat.Action.Builder(
                R.drawable.ic_carrel, "Park", action("carrel.PARK", 13, true))
                .addRemoteInput(RemoteInput.Builder(REPLY).setLabel("Park a thought").build())
                .setAllowGeneratedReplies(false).setShowsUserInterface(false).build())
        }

        if (store.privacy) {
            b.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            b.setPublicVersion(base().setContentTitle("Carrel").setContentText("Studying")
                .setShowWhen(false).setUsesChronometer(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).build())
        } else b.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        return b.build()
    }

    fun post(model: NotificationModel) {
        if (!allowed()) return
        try { NotificationManagerCompat.from(context).notify(ID, build(model)) }
        catch (_: SecurityException) { /* permission changed */ }
        catch (_: RuntimeException) { /* service unavailable */ }
    }

    private var shownUndo: String? = null

    private fun undoTitle(stoppedAt: Long): String {
        val previous = try {
            store.undoPrev?.let { stateFromJson(JSONObject(it)) }
        } catch (_: Exception) { null }
        val name = previous?.activity?.name?.takeIf { it.isNotBlank() }
            ?: previous?.returnTo?.name?.takeIf { it.isNotBlank() } ?: "timer"
        val started = previous?.startedAt ?: previous?.breakStartedAt ?: stoppedAt
        val minutes = ((stoppedAt - started).coerceAtLeast(0)) / 60_000L
        val duration = when {
            minutes < 1 -> "<1m"
            minutes < 60 -> "${minutes}m"
            minutes % 60 == 0L -> "${minutes / 60}h"
            else -> "${minutes / 60}h ${minutes % 60}m"
        }
        return "Stopped $name · $duration"
    }

    fun showUndo(oid: String?, stoppedAt: Long) {
        val manager = NotificationManagerCompat.from(context)
        if (oid == null) {
            if (shownUndo != null) manager.cancel(UNDO_ID)
            shownUndo = null
            return
        }
        if (shownUndo == oid || !allowed()) return
        val end = stoppedAt + UNDO_MILLIS
        val n = base().setOngoing(false).setShowWhen(false).setUsesChronometer(false)
            .setContentTitle(undoTitle(stoppedAt))
            .setTimeoutAfter((end - System.currentTimeMillis()).coerceAtLeast(1))
            .addAction(R.drawable.ic_carrel, "Undo", action("carrel.UNDO", 17) { it.putExtra("oid", oid) })
            .setVisibility(if (store.privacy) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(base().setOngoing(false).setContentTitle("Carrel")
                .setContentText("Studying").setShowWhen(false).setUsesChronometer(false).build())
            .build()
        try { manager.notify(UNDO_ID, n); shownUndo = oid }
        catch (_: SecurityException) { }
        catch (_: RuntimeException) { }
    }

    fun cancel() = NotificationManagerCompat.from(context).cancel(ID)
}
