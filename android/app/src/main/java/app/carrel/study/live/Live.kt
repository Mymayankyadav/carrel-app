package app.carrel.study.live

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Process-wide holder. Everything that touches state runs on [io], one task at a time. */
class Live private constructor(val ctx: Context) {
    val store = Store(ctx)
    val api = Api(store)
    val io: ExecutorService = Executors.newSingleThreadExecutor()
    val main = Handler(Looper.getMainLooper())
    val notifications = Notifications(ctx, store)
    val engine = Engine(this)

    companion object {
        @Volatile private var inst: Live? = null
        fun of(c: Context): Live = inst ?: synchronized(this) {
            inst ?: Live(c.applicationContext).also { inst = it; it.notifications.createChannel() }
        }
    }
}
val Context.live: Live get() = Live.of(this)
