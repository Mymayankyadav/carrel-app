package app.carrel.study.live

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Sends queued button presses to Supabase. Retries on its own when offline. */
object Flush {
    /** Run now, in the background. */
    fun kick(live: Live) { live.io.execute { run(live) } }

    fun run(live: Live) {
        val s = live.store
        while (true) {
            val op = s.queue().firstOrNull() ?: break
            val oid = op.optString("oid")
            val wait = op.optLong("notBefore") - System.currentTimeMillis()
            if (wait > 0) { later(live, wait); break }
            try {
                val r = live.api.rpc(op.getString("fn"), op.getJSONObject("args"))
                s.removeOp(oid)
                live.engine.onReply(op.getString("fn"), r)
            } catch (e: Api.HttpError) {
                if (e.code == 401) { live.engine.onFailure("Open Carrel to sign in again."); later(live, 60_000); break }
                if (e.code in 400..499 && e.code != 408 && e.code != 429) {
                    s.removeOp(oid); live.engine.onFailure("Couldn't save that: ${e.message}".take(120)); continue
                }
                later(live, 30_000); break
            } catch (e: IOException) {
                later(live, 30_000); break
            }
        }
    }

    /** Fast path in this process, plus WorkManager as the fallback when the process is gone or the network is down. */
    private fun later(live: Live, delayMs: Long) {
        live.main.postDelayed({ live.io.execute { run(live) } }, delayMs.coerceAtLeast(500))
        val req = OneTimeWorkRequest.Builder(FlushWorker::class.java)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInitialDelay(delayMs.coerceAtLeast(500), TimeUnit.MILLISECONDS).build()
        WorkManager.getInstance(live.ctx).enqueueUniqueWork("carrel-flush", ExistingWorkPolicy.REPLACE, req)
    }
}

class FlushWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = try {
        val live = applicationContext.live
        live.io.submit { Flush.run(live) }.get()
        Result.success()
    } catch (e: Exception) { Result.retry() }
}

/** Every 15 minutes: pick up timers that were started or stopped elsewhere (chat, the web page) while the app was closed. */
class RefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = try {
        val live = applicationContext.live
        live.io.submit { live.engine.refreshFromServer() }.get()
        Result.success()
    } catch (e: Exception) { Result.retry() }
}
