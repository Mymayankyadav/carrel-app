package app.carrel.study.live.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import app.carrel.study.MainActivity
import app.carrel.study.R
import app.carrel.study.live.CarrelLinks
import app.carrel.study.live.Status
import app.carrel.study.live.live
import app.carrel.study.live.ActionReceiver

/** Two compact layouts, refreshed whenever the notification engine changes. */
class CarrelWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        refresh(context)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: android.os.Bundle) {
        refresh(context)
    }

    companion object {
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CarrelWidget::class.java))
            if (ids.isEmpty()) return
            val store = context.live.store
            val state = store.active
            val now = System.currentTimeMillis()
            val elapsed = if (state?.status == Status.BREAK) state.breakStartedAt else state?.startedAt
            val title = if (state?.status == Status.BREAK) "Break"
                else state?.activity?.name?.takeIf { it.isNotBlank() } ?: "Not tracking"
            val total = store.todayStudyMs +
                if (state?.status == Status.RUNNING && store.studyRunning && store.todayAsOf > 0L)
                    (now - store.todayAsOf).coerceAtLeast(0L) else 0L
            val minutes = (total / 60_000L).coerceAtLeast(0L)
            val today = "Today " + if (minutes >= 60L) "${minutes / 60}h ${minutes % 60}m" else "${minutes}m"
            val color = runCatching {
                Color.parseColor(state?.activity?.color ?: "#0F766E")
            }.getOrDefault(Color.parseColor("#0F766E"))

            val stop = PendingIntent.getBroadcast(context, 201,
                Intent(context, ActionReceiver::class.java).setAction("carrel.STOP"),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val url = if (store.lastStudyId.isNotBlank()) CarrelLinks.startSubject(store.lastStudyId)
                else CarrelLinks.startLast()
            val launch = PendingIntent.getActivity(context, 202,
                Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val open = PendingIntent.getActivity(context, 203,
                Intent(context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

            for (id in ids) {
                val wide = manager.getAppWidgetOptions(id).getInt(
                    AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= 240
                val view = RemoteViews(context.packageName,
                    if (wide) R.layout.widget_wide else R.layout.widget_small)
                view.setTextViewText(R.id.widget_name, title)
                view.setTextViewText(R.id.widget_today, today)
                view.setTextViewText(R.id.widget_action, if (state == null) "Start" else "Stop")
                view.setContentDescription(R.id.widget_action,
                    if (state == null) "Start last study subject" else "Stop timer")
                view.setOnClickPendingIntent(R.id.widget_action, if (state == null) launch else stop)
                view.setOnClickPendingIntent(R.id.widget_root, open)
                view.setInt(R.id.widget_dot, "setColorFilter", color)
                if (elapsed != null && elapsed > 0) {
                    view.setViewVisibility(R.id.widget_elapsed, View.VISIBLE)
                    val base = SystemClock.elapsedRealtime() - (now - elapsed).coerceAtLeast(0L)
                    view.setChronometer(R.id.widget_elapsed, base, null, true)
                } else {
                    view.setViewVisibility(R.id.widget_elapsed, View.GONE)
                }
                manager.updateAppWidget(id, view)
            }
        }
    }
}
