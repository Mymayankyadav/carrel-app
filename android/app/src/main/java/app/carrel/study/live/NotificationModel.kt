package app.carrel.study.live

data class NotificationModel(
    val title: String, val text: String?, val whenMillis: Long,
    val countDown: Boolean, val color: String, val subtext: String,
    val phase: String = "FOCUS", val canStop: Boolean = false, val canTakeBreak: Boolean = false,
)

fun backTo(state: State): String = "Back to: " +
    (state.intention?.takeIf { it.isNotBlank() } ?: state.activity?.name ?: state.returnTo?.name ?: "Studying")

fun notificationModel(state: State?, now: Long, tally: Int = 0, feedbackUntil: Long = 0): NotificationModel? {
    if (state == null) return null
    val model = when (state.status) {
        Status.BREAK -> NotificationModel("☕ Break", state.returnTo?.let { "Back to ${it.name}" },
            state.breakStartedAt ?: return null, false, state.returnTo?.color ?: "#B5543A", "$tally caught")
        Status.RUNNING -> {
            val a = state.activity ?: return null
            val start = state.startedAt ?: return null
            val end = state.pomo?.focusEndsAt
            val due = end != null && now >= end
            NotificationModel(if (due) "Break due · ${a.name}" else a.name, state.intention,
                end ?: start, end != null && !due, a.color, "$tally caught")
        }
    }
    val breakDue = state.status == Status.RUNNING && state.pomo?.focusEndsAt?.let { now >= it } == true
    return model.copy(
        text = if (now < feedbackUntil) backTo(state) else model.text,
        phase = if (state.status == Status.BREAK) "REST" else if (breakDue) "BREAK DUE" else "FOCUS",
        canStop = true, canTakeBreak = breakDue,
    )
}

enum class PulseKind { FOCUS, BREAK }
fun pulseDeadline(state: State?, kind: PulseKind): Long? = when (kind) {
    PulseKind.FOCUS -> state?.takeIf { it.status == Status.RUNNING }?.pomo?.focusEndsAt
    PulseKind.BREAK -> state?.takeIf { it.status == Status.BREAK }?.pomo?.breakEndsAt
}
fun shouldPulse(deadline: Long, expected: Long?, now: Long, enabled: Boolean, respectDnd: Boolean, allInterruptions: Boolean) =
    deadline == expected && now >= deadline && enabled && (!respectDnd || allInterruptions)

const val UNDO_MILLIS = 10_000L
