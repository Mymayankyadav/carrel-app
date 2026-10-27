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

/** Use Android's own compact and expanded presentation, never a custom RemoteViews layout. */
class Notifications(private val context: Context, private val store: Store) {
    companion object {
        const val ID = 41
        const val UNDO_ID = 42
        const val CHANNEL = "carrel_live_silent_v1"
        const val REPLY = "park_text"
        private val ACCENT = Color.rgb(15, 118, 110)
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
        .setColor(ACCENT)
        .setColorized(false)
        .setSilent(true)
        .setSound(null)
        .setVibrate(longArrayOf(0))
        .setDefaults(0)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setOngoing(true)
        .setAutoCancel(false)
        .setShowWhen(true)
        .setContentIntent(openApp())

    fun build(model: NotificationModel): Notification {
        val builder = base()
            .setContentTitle(model.title)
            .setContentText(model.text)
            .setWhen(model.whenMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(model.countDown)

        if (model.canTakeBreak) {
            builder.addAction(R.drawable.ic_carrel, "Break", action("carrel.BREAK", 16))
        }
        builder.addAction(R.drawable.ic_carrel, "Stop", action("carrel.STOP", 15))

        // Less-used capture actions are deliberately opt-in, and never displace Stop.
        if (store.notifDistractions) {
            builder.addAction(R.drawable.ic_carrel, "Urge", action("carrel.URGE", 11))
            builder.addAction(R.drawable.ic_carrel, "Drifted", activity(DriftActivity::class.java, 12))
            builder.addAction(NotificationCompat.Action.Builder(
                R.drawable.ic_carrel, "Park", action("carrel.PARK", 13, true))
                .addRemoteInput(RemoteInput.Builder(REPLY).setLabel("Park a thought").build())
                .setAllowGeneratedReplies(false)
                .setShowsUserInterface(false).build())
        }

        if (store.privacy) {
            builder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            builder.setPublicVersion(base().setContentTitle("Carrel").setContentText("Studying")
                .setShowWhen(false).setUsesChronometer(false).setOngoing(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).build())
        } else {
            builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        }
        return builder.build()
    }

    fun post(model: NotificationModel) {
        if (!allowed()) return
        try { NotificationManagerCompat.from(context).notify(ID, build(model)) }
        catch (_: SecurityException) { /* permission revoked between check and notify */ }
        catch (_: RuntimeException) { /* notification service temporarily unavailable */ }
    }

    private var shownUndo: String? = null
    fun showUndo(oid: String?, stoppedAt: Long) {
        val manager = NotificationManagerCompat.from(context)
        if (oid == null) {
            if (shownUndo != null) manager.cancel(UNDO_ID)
            shownUndo = null
            return
        }
        if (shownUndo == oid || !allowed()) return
        val undo = action("carrel.UNDO", 17) { it.putExtra("oid", oid) }
        val remaining = (stoppedAt + UNDO_MILLIS - System.currentTimeMillis()).coerceAtLeast(1)
        val previous = store.undoPrev?.let { runCatching { stateFromJson(JSONObject(it)) }.getOrNull() }
        val builder = base().setOngoing(false).setAutoCancel(true)
            .setContentTitle(stoppedTitle(previous, stoppedAt))
            .setContentText(null)
            .setShowWhen(false).setUsesChronometer(false)
            .setTimeoutAfter(remaining)
            .addAction(R.drawable.ic_carrel, "Undo", undo)
            .setVisibility(if (store.privacy) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
        if (store.privacy) {
            builder.setPublicVersion(base().setOngoing(false).setShowWhen(false)
                .setUsesChronometer(false).setContentTitle("Carrel").setContentText("Studying")
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).build())
        }
        try { manager.notify(UNDO_ID, builder.build()); shownUndo = oid }
        catch (_: SecurityException) { }
        catch (_: RuntimeException) { }
    }

    fun cancel() = NotificationManagerCompat.from(context).cancel(ID)
}

// Keep this helper for older native callers while the UI no longer uses activity colours.
fun parseColor(value: String): Int = try { Color.parseColor(value) }
    catch (_: IllegalArgumentException) { Color.rgb(15, 118, 110) }
