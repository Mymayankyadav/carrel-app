package app.carrel.study.live

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationModelTest {
    private val physics = Act("physics", "Physics", "#098765")

    @Test fun noTimerIsSilent() {
        assertNull(notificationModel(null, 1000))
    }

    @Test fun runningHasTitleAndChronometerWithoutNoise() {
        val state = State(Status.RUNNING, activity = physics, startedAt = 1_000)
        val m = notificationModel(state, 3_000)!!
        assertEquals("Physics", m.title)
        assertNull(m.text)
        assertEquals(1_000, m.whenMillis)
        assertFalse(m.countDown)
        assertFalse(m.canTakeBreak)
    }

    @Test fun focusCountdownChangesToBreakDue() {
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
        assertTrue(due.canTakeBreak)
    }

    @Test fun breakShowsReturnAndCountsDownWhenEndKnown() {
        val state = State(Status.BREAK, breakStartedAt = 10_000,
            returnTo = ReturnTo("Physics", "#098765"), pomo = Pomo(breakEndsAt = 16_000))
        val m = notificationModel(state, 12_000)!!
        assertEquals("Break", m.title)
        assertEquals("Back to Physics", m.text)
        assertEquals(16_000, m.whenMillis)
        assertTrue(m.countDown)
        assertFalse(m.canTakeBreak)

        val over = notificationModel(state, 16_000)!!
        assertFalse(over.countDown)
    }

    @Test fun stopNotificationUsesPreviousSessionAndDuration() {
        val state = State(Status.RUNNING, activity = physics, startedAt = 1000)
        assertEquals("Stopped Physics · 1h 5m", stoppedTitle(state, 3_901_000))
        assertEquals("Stopped", stoppedTitle(null, 1000))
        assertEquals("Stopped Physics · <1m", stoppedTitle(state, 1000))
    }
}
