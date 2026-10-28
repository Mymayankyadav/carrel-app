package app.carrel.study.live

import android.content.Context
import org.json.JSONObject
import app.carrel.study.live.widget.CarrelWidget
import java.util.UUID

/** The notification's brain. All public functions must be called on live.io. */
class Engine(private val live: Live) {
    private val s get() = live.store
    private val ctx: Context get() = live.ctx

    fun render() {
        val now = System.currentTimeMillis()
        val state = s.active
        val tally = state?.let { s.tally(it.startedAt ?: it.breakStartedAt ?: 0) } ?: 0
        var model = notificationModel(state, now, tally, s.feedbackUntil)
        if (model != null && s.warning != null && now < s.warningUntil) model = model.copy(text = s.warning)
        val undoEnd = if (s.undoOid != null) s.undoAt + UNDO_MILLIS else 0
        if (s.undoOid != null && now >= undoEnd) clearUndo()
        val restore = listOf(s.feedbackUntil, s.warningUntil, undoEnd).filter { it > now }.minOrNull() ?: 0
        Alarms.schedule(ctx, state, restore)
        if (model == null) live.notifications.cancel() else live.notifications.post(model)
        live.notifications.showUndo(if (s.undoOid != null && now < undoEnd) s.undoOid else null, s.undoAt)
        // Surface updates also run while notifications are disallowed.
        CarrelWidget.refresh(ctx)
        TimerTile.refresh(ctx)
    }

    private fun clearUndo() { s.undoOid = null; s.undoPrev = null }
    private fun warn(msg: String) { s.warning = msg; s.warningUntil = System.currentTimeMillis() + 8000 }
    private fun newOid() = UUID.randomUUID().toString()

    private fun op(oid: String, fn: String, args: JSONObject, notBefore: Long) =
        JSONObject().put("oid", oid).put("fn", fn).put("args", args).put("notBefore", notBefore)

    /** A button was pressed. type: urge | drift | park | stop | break */
    fun act(type: String, at: Long, driftMin: Int? = null, text: String? = null) {
        val state = s.active
        when (type) {
            "urge", "drift", "park" -> {
                if (state == null) { warn("No timer is running."); render(); return }
                val args = JSONObject().put("p_type", type).put("p_at", isoUtc(at)).put("p_by", "native")
                driftMin?.let { args.put("p_drift_min", it) }
                text?.let { args.put("p_text", it) }
                s.enqueue(op(newOid(), "carrel_mark", args, 0))
                s.bumpTally(state.startedAt ?: state.breakStartedAt ?: 0)
                s.feedbackUntil = System.currentTimeMillis() + 8000
            }
            "stop" -> {
                if (state == null) { render(); return }
                val oid = newOid()
                val args = JSONObject().put("p_at", isoUtc(at)).put("p_by", "native")
                state.id?.let { args.put("p_expect_id", it) }
                s.undoOid = oid; s.undoAt = at; s.undoPrev = stateToJson(state).toString()
                s.enqueue(op(oid, "carrel_stop", args, at + UNDO_MILLIS))
                s.active = null
            }
            "break" -> {
                val m = notificationModel(state, at)
                if (state == null || m?.canTakeBreak != true) { warn("A break is not due yet."); render(); return }
                val args = JSONObject().put("p_at", isoUtc(at)).put("p_by", "native")
                state.id?.let { args.put("p_expect_id", it) }
                s.enqueue(op(newOid(), "carrel_break", args, 0))
                s.active = State(Status.BREAK, null, state.activity, null, null, null, at,
                    state.activity?.let { ReturnTo(it.name, it.color) })
            }
        }
        render()
        Flush.kick(live)
    }

    fun undoStop(oid: String) {
        if (s.undoOid != oid) { render(); return }
        if (!s.removeOp(oid)) { warn("Too late to undo."); render(); return }
        s.active = s.undoPrev?.let { try { stateFromJson(JSONObject(it)) } catch (e: Exception) { null } }
        clearUndo()
        render()
    }

    /** The web view reports the timer it sees. Ignored while our own changes are still waiting to be sent. */
    fun setState(state: State?) {
        if (s.queue().isNotEmpty()) return
        if (state != s.active) { s.active = state; render() }
    }

    fun onReply(fn: String, r: JSONObject) {
        if (fn == "carrel_stop") clearUndo()
        if (!r.optBoolean("ok", true)) {
            warn(when (r.optString("reason")) {
                "stale", "not_running" -> "Timer changed elsewhere."
                "already" -> "Already on a break."
                "no_break_activity" -> "Add a Break activity in Carrel first."
                else -> "Couldn't apply that."
            })
        }
        CarrelLivePlugin.emitAction(fn, r.optBoolean("ok", true), r.optString("reason"))
        refreshFromServer()
    }

    fun refreshFromServer() {
        if (s.queue().isNotEmpty() || !s.hasSession()) { render(); return }
        try { s.active = live.api.fetchState() } catch (e: Exception) { /* keep what we have */ }
        render()
    }

    fun onFailure(msg: String) { warn(msg); render() }
}
