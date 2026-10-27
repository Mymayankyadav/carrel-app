package app.carrel.study.live

/** Only fields shown by the system notification; no custom view or distraction tally. */
data class NotificationModel(
    val title: String,
    val text: String?,
    val whenMillis: Long,
    val countDown: Boolean,
    val canTakeBreak: Boolean = false,
)

fun notificationModel(state: State?, now: Long): NotificationModel? {
    if (state == null) return null
    return when (state.status) {
        Status.BREAK -> {
            val start = state.breakStartedAt ?: return null
            val end = state.pomo?.breakEndsAt
            val name = state.returnTo?.name ?: state.activity?.name ?: "study"
            NotificationModel(
                "Break", "Back to " + name,
                end ?: start, end != null && now < end
            )
        }
        Status.RUNNING -> {
            val act = state.activity ?: return null
            val start = state.startedAt ?: return null
            val end = state.pomo?.focusEndsAt
            val due = end != null && now >= end
            when {
                due -> NotificationModel("Break time", act.name, end!!, false, canTakeBreak = true)
                end != null -> NotificationModel(act.name, "Focus", end, true)
                else -> NotificationModel(act.name, null, start, false)
            }
        }
    }
}

/** Readable 10-second Undo heading; works even after the active timer was cleared. */
fun stoppedTitle(previous: State?, stoppedAt: Long): String {
    if (previous == null) return "Stopped"
    val name = if (previous.status == Status.BREAK)
        (previous.returnTo?.name ?: previous.activity?.name ?: "timer")
        else (previous.activity?.name ?: "timer")
    val start = previous.startedAt ?: previous.breakStartedAt
    if (start == null || stoppedAt < start) return "Stopped " + name
    val minutes = (stoppedAt - start) / 60_000L
    val duration = when {
        minutes < 1 -> "<1m"
        minutes < 60 -> minutes.toString() + "m"
        minutes % 60L == 0L -> (minutes / 60L).toString() + "h"
        else -> (minutes / 60L).toString() + "h " + (minutes % 60L).toString() + "m"
    }
    return "Stopped " + name + " · " + duration
}

enum class PulseKind { FOCUS, BREAK }
fun pulseDeadline(state: State?, kind: PulseKind): Long? = when (kind) {
    PulseKind.FOCUS -> state?.takeIf { it.status == Status.RUNNING }?.pomo?.focusEndsAt
    PulseKind.BREAK -> state?.takeIf { it.status == Status.BREAK }?.pomo?.breakEndsAt
}
fun shouldPulse(deadline: Long, expected: Long?, now: Long, enabled: Boolean, respectDnd: Boolean, allInterruptions: Boolean) =
    deadline == expected && now >= deadline && enabled && (!respectDnd || allInterruptions)

const val UNDO_MILLIS = 10_000L
