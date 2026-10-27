package app.carrel.study.live

data class NotificationModel(
    val title: String, val text: String?, val whenMillis: Long,
    val countDown: Boolean, val color: String, val subtext: String,
    val phase: String = "FOCUS", val canStop: Boolean = false, val canTakeBreak: Boolean = false,
)

fun backTo(state: State): String = "Back to: " +
    (state.intention?.takeIf { it.isNotBlank() } ?: state.activity?.name ?: state.returnTo?.name ?: "Studying")

/** Minimal notification contract; never decorate the title with session metadata. */
@Suppress("UNUSED_PARAMETER")
fun notificationModel(state: State?, now: Long, tally: Int = 0, feedbackUntil: Long = 0): NotificationModel? {
    if (state == null) return null
    return when (state.status) {
        Status.BREAK -> {
            val started = state.breakStartedAt ?: return null
            val ends = state.pomo?.breakEndsAt
            NotificationModel(
                title = "Break",
                text = state.returnTo?.name?.let { "Back to $it" },
                whenMillis = ends ?: started,
                countDown = ends != null && now < ends,
                color = "#0F766E",
                subtext = "",
                phase = "break",
                canStop = true,
                canTakeBreak = false,
            )
        }
        Status.RUNNING -> {
            val name = state.activity?.name ?: return null
            val started = state.startedAt ?: return null
            val end = state.pomo?.focusEndsAt
            val due = end != null && now >= end
            NotificationModel(
                title = if (due) "Break time" else name,
                text = when {
                    due -> name
                    end != null -> "Focus"
                    else -> null
                },
                whenMillis = end ?: started,
                countDown = end != null && !due,
                color = "#0F766E",
                subtext = "",
                phase = if (due) "due" else "focus",
                canStop = true,
                canTakeBreak = due,
            )
        }
    }
}

enum class PulseKind { FOCUS, BREAK }
fun pulseDeadline(state: State?, kind: PulseKind): Long? = when (kind) {
    PulseKind.FOCUS -> state?.takeIf { it.status == Status.RUNNING }?.pomo?.focusEndsAt
    PulseKind.BREAK -> state?.takeIf { it.status == Status.BREAK }?.pomo?.breakEndsAt
}
fun shouldPulse(deadline: Long, expected: Long?, now: Long, enabled: Boolean, respectDnd: Boolean, allInterruptions: Boolean) =
    deadline == expected && now >= deadline && enabled && (!respectDnd || allInterruptions)

const val UNDO_MILLIS = 10_000L
