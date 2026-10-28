package app.carrel.study.live

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import app.carrel.study.MainActivity
import app.carrel.study.R

/** Stop is fully native/offline; starting opens Carrel for its queued write path. */
class TimerTile : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        val current = applicationContext.live.store.active
        val tile = qsTile ?: return
        tile.label = "Carrel"
        if (Build.VERSION.SDK_INT >= 29) {
            tile.subtitle = if (current == null) "Start last"
                else current.activity?.name ?: "Stop timer"
        }
        tile.icon = Icon.createWithResource(this, R.drawable.ic_carrel)
        tile.state = if (current == null) Tile.STATE_INACTIVE else Tile.STATE_ACTIVE
        tile.updateTile()
    }

    override fun onClick() {
        super.onClick()
        val store = applicationContext.live.store
        if (store.active != null) {
            sendBroadcast(Intent(this, ActionReceiver::class.java).setAction("carrel.STOP"))
        } else {
            val url = if (store.lastStudyId.isNotBlank()) CarrelLinks.startSubject(store.lastStudyId)
                else CarrelLinks.startLast()
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url), this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pending = PendingIntent.getActivity(this, 204, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(pending)
            else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(intent)
            }
        }
        onStartListening()
    }

    companion object {
        fun refresh(context: Context) {
            runCatching {
                requestListeningState(context, ComponentName(context, TimerTile::class.java))
            }
        }
    }
}
