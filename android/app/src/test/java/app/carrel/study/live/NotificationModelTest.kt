package app.carrel.study.live

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Pure JVM coverage for the Android notification's lifecycle and chronometer. */
class NotificationModelTest {
    private val physics = Act("physics", "Physics", "#098765")

    @Test fun idleAndIncompleteStatesNeverRender() {
        assertNull(notificationModel(null, 1_000))
        assertNull(notificationModel(State(Status.RUNNING, activity = physics), 1_000))
        assertNull(notificationModel(State(Status.RUNNING, startedAt = 100), 1_000))
        assertNull(notificationModel(State(Status.BREAK), 1_000))
    }

    @Test fun runningUsesElapsedSystemChronometerAndStopAction() {
        val state = State(Status.RUNNING, activity = physics, startedAt = 1_000)
        val m = notificationModel(state, 3_000)!!
        assertEquals("Physics", m.title)
        assertNull(m.text)
        assertEquals(1_000, m.whenMillis)
        assertFalse(m.countDown)
        assertTrue(m.canStop)
        assertFalse(m.canTakeBreak)
        assertEquals("", m.subtext)
    }

    @Test fun focusDeadlineFlipsToBreakDueExactlyAtDeadline() {
        val state = State(Status.RUNNING, activity = physics, startedAt = 1_000, pomo = Pomo(focusEndsAt = 10_000))
        val focus = notificationModel(state, 9_999)!!
        assertEquals("Physics", focus.title)
        assertEquals("Focus", focus.text)
        assertEquals(10_000, focus.whenMillis)
        assertTrue(focus.countDown)
        assertFalse(focus.canTakeBreak)

        val due = notificationModel(state, 10_000)!!
        assertEquals("Break time", due.title)
        assertEquals("Physics", due.text)
        assertEquals(10_000, due.whenMillis)
        assertFalse(due.countDown)
        assertTrue(due.canStop)
        assertTrue(due.canTakeBreak)
        assertFalse(notificationModel(state, 15_000)!!.countDown)
    }

    @Test fun breakShowsReturnAndCountsDownOnlyBeforeEnd() {
        val state = State(Status.BREAK, breakStartedAt = 10_000,
            returnTo = ReturnTo("Physics", "#098765"), pomo = Pomo(breakEndsAt = 16_000))
        val current = notificationModel(state, 12_000)!!
        assertEquals("Break", current.title)
        assertEquals("Back to Physics", current.text)
        assertEquals(16_000, current.whenMillis)
        assertTrue(current.countDown)
        assertTrue(current.canStop)
        assertFalse(current.canTakeBreak)

        val over = notificationModel(state, 16_000)!!
        assertFalse(over.countDown)
        assertEquals(16_000, over.whenMillis)
    }

    @Test fun breakWithoutPomodoroShowsElapsed() {
        val state = State(Status.BREAK, breakStartedAt = 1_000)
        val m = notificationModel(state, 3_000)!!
        assertEquals("Break", m.title)
        assertNull(m.text)
        assertEquals(1_000, m.whenMillis)
        assertFalse(m.countDown)
        assertFalse(m.canTakeBreak)
    }

    @Test fun captureFeedbackAndTalliesCannotPolluteNotification() {
        val state = State(Status.RUNNING, activity = physics, startedAt = 1_000)
        val quiet = notificationModel(state, 5_000)!!
        val recentCapture = notificationModel(state, 5_000, tally = 95, feedbackUntil = 100_000)!!
        assertEquals(quiet, recentCapture)
    }

    @Test fun onlyTheCurrentPomodoroDeadlineMayTriggerPulse() {
        val running = State(Status.RUNNING, activity = physics, startedAt = 1_000,
            pomo = Pomo(focusEndsAt = 5_000))
        val breakState = State(Status.BREAK, breakStartedAt = 5_000,
            pomo = Pomo(breakEndsAt = 7_000))
        assertEquals(5_000L, pulseDeadline(running, PulseKind.FOCUS))
        assertNull(pulseDeadline(running, PulseKind.BREAK))
        assertNull(pulseDeadline(breakState, PulseKind.FOCUS))
        assertEquals(7_000L, pulseDeadline(breakState, PulseKind.BREAK))
        assertNull(pulseDeadline(null, PulseKind.FOCUS))
    }

    @Test fun vibrationRespectsEnabledDeadlineAndDoNotDisturb() {
        assertTrue(shouldPulse(5_000, 5_000, 5_000, true, true, true))
        assertFalse(shouldPulse(5_000, 5_000, 4_999, true, false, true))
        assertFalse(shouldPulse(5_000, 6_000, 5_000, true, false, true))
        assertFalse(shouldPulse(5_000, 5_000, 5_000, false, false, true))
        assertFalse(shouldPulse(5_000, 5_000, 5_000, true, true, false))
        assertTrue(shouldPulse(5_000, 5_000, 5_000, true, false, false))
    }
}
