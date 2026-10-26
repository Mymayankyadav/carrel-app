package app.carrel.study.live

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import app.carrel.study.R

class Notifications(private val context: Context, private val store: Store) {
    companion object {
        const val ID = 41; const val UNDO_ID = 42
        const val CHANNEL = "carrel_live_silent_v1"; const val REPLY = "park_text"
    }

    fun createChannel() {
        val channel = NotificationChannel(CHANNEL, "Live study timer (silent)", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Quiet study timer and distraction capture"
            setSound(null, null); enableVibration(false); vibrationPattern = longArrayOf(0)
            setShowBadge(false); enableLights(false)
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
    private fun activity(cls: Class<*>, code: Int): PendingIntent = PendingIntent.getActivity(context, code, Intent(context, cls),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    private fun openApp(): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        return PendingIntent.getActivity(context, 10, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun base() = NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_carrel)
        .setSilent(true).setSound(null).setVibrate(longArrayOf(0)).setDefaults(0).setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW).setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setOngoing(true).setAutoCancel(false).setShowWhen(true)
        .setContentIntent(openApp())

    fun build(model: NotificationModel): Notification {
        val color = parseColor(model.color)
        val b = base().setContentTitle(model.title).setContentText(model.text).setSubText(model.subtext)
            .setWhen(model.whenMillis).setUsesChronometer(true).setChronometerCountDown(model.countDown)
            .setColor(color).setLargeIcon(dot(color))
            .addAction(R.drawable.ic_carrel, "Urge", action("carrel.URGE", 11))
            .addAction(R.drawable.ic_carrel, "Drifted", activity(DriftActivity::class.java, 12))
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_carrel, "Park", action("carrel.PARK", 13, true))
                .addRemoteInput(RemoteInput.Builder(REPLY).setLabel("Park a thought").build())
                .setAllowGeneratedReplies(false).setShowsUserInterface(false).build())
        // Android commonly shows only three standard actions. Stop and Take break live in the expanded view.
        val expanded = RemoteViews(context.packageName, R.layout.notification_expanded).apply {
            setTextViewText(R.id.timer_phase, model.phase)
            setChronometer(R.id.timer_clock, SystemClock.elapsedRealtime() + model.whenMillis - System.currentTimeMillis(), null, true)
            setChronometerCountDown(R.id.timer_clock, model.countDown)
            setViewVisibility(R.id.stop_timer, if (model.canStop) View.VISIBLE else View.GONE)
            setViewVisibility(R.id.take_break, if (model.canTakeBreak) View.VISIBLE else View.GONE)
            setOnClickPendingIntent(R.id.stop_timer, action("carrel.STOP", 15))
            setOnClickPendingIntent(R.id.take_break, action("carrel.BREAK", 16))
            setTextViewText(R.id.timer_title, model.title.take(2000))
            setTextViewText(R.id.timer_text, model.text.orEmpty().take(4000))
        }
        b.setStyle(NotificationCompat.DecoratedCustomViewStyle()).setCustomBigContentView(expanded)
        if (store.privacy) {
            b.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            b.setPublicVersion(base().setContentTitle("Studying").setShowWhen(false)
                .setUsesChronometer(false).setVisibility(NotificationCompat.VISIBILITY_PUBLIC).build())
        } else b.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        return b.build()
    }

    fun post(model: NotificationModel) {
        if (!allowed()) return
        try { NotificationManagerCompat.from(context).notify(ID, build(model)) }
        catch (_: SecurityException) { /* permission revoked between the check and notify */ }
        catch (_: RuntimeException) { /* notification service temporarily unavailable */ }
    }

    private var shownUndo: String? = null
    fun showUndo(oid: String?, stoppedAt: Long) {
        val manager = NotificationManagerCompat.from(context)
        if (oid == null) { if (shownUndo != null) manager.cancel(UNDO_ID); shownUndo = null; return }
        if (shownUndo == oid || !allowed()) return
        val undo = action("carrel.UNDO", 17) { it.putExtra("oid", oid) }
        val end = stoppedAt + UNDO_MILLIS
        val n = base().setOngoing(false).setContentTitle("Timer stopped")
            .setContentText("A moment to change your mind.").setSubText("Saving…")
            .setWhen(end).setUsesChronometer(true).setChronometerCountDown(true)
            .setTimeoutAfter((end - System.currentTimeMillis()).coerceAtLeast(1))
            .addAction(R.drawable.ic_carrel, "Undo", undo)
            .setVisibility(if (store.privacy) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(base().setOngoing(false).setContentTitle("Studying").setShowWhen(false).build()).build()
        try { manager.notify(UNDO_ID, n); shownUndo = oid }
        catch (_: SecurityException) { }
        catch (_: RuntimeException) { }
    }

    fun cancel() = NotificationManagerCompat.from(context).cancel(ID)

    private fun dot(color: Int): Bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888).also {
        Canvas(it).drawCircle(32f, 32f, 12f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    }
}

fun parseColor(value: String): Int = try { Color.parseColor(value) } catch (_: IllegalArgumentException) { Color.rgb(181, 84, 58) }
