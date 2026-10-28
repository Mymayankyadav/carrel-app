package app.carrel.study.live

import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import app.carrel.study.MainActivity
import app.carrel.study.R
import org.json.JSONArray

/** Top subjects are ranked by the web app's cached last-14-day study totals. */
object CarrelShortcuts {
    fun refresh(context: Context) {
        if (Build.VERSION.SDK_INT < 25) return
        val manager = context.getSystemService(ShortcutManager::class.java) ?: return
        val list = runCatching { JSONArray(context.live.store.topActivities) }.getOrNull() ?: JSONArray()
        val shortcuts = (0 until minOf(3, list.length())).mapNotNull { i ->
            val item = list.optJSONObject(i) ?: return@mapNotNull null
            val id = item.optString("id").take(100)
            val name = item.optString("name").trim().take(60)
            if (id.isBlank() || name.isBlank()) return@mapNotNull null
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(CarrelLinks.startSubject(id)),
                context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            ShortcutInfo.Builder(context, "study:" + id)
                .setShortLabel(name.take(25))
                .setLongLabel("Start " + name)
                .setIcon(Icon.createWithResource(context, R.drawable.ic_carrel))
                .setIntent(intent)
                .build()
        }
        runCatching { manager.dynamicShortcuts = shortcuts }
    }
}
