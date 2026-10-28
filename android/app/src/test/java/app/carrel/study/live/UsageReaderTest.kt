package app.carrel.study.live

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageReaderTest {
    private val instagram = "com.instagram.android"
    private val youtube = "com.google.android.youtube"

    @Test fun clipsAlreadyForegroundAppAtStart() {
        val result = UsageReader.summarise(listOf(
            L6UsageTick(instagram, 100, true),
            L6UsageTick(instagram, 350, false)
        ), 200, 400, setOf(instagram))
        assertEquals(1, result.size)
        assertEquals(150L, result[0].ms)
        assertEquals(0, result[0].opens)
    }

    @Test fun clipsAppRemainingOpenAfterEndAndCountsOpens() {
        val result = UsageReader.summarise(listOf(
            L6UsageTick(youtube, 220, true),
            L6UsageTick(youtube, 450, false)
        ), 200, 400, setOf(youtube))
        assertEquals(180L, result[0].ms)
        assertEquals(1, result[0].opens)
    }

    @Test fun totalsMultipleFocusSpansAndIgnoresUnselected() {
        val result = UsageReader.summarise(listOf(
            L6UsageTick(instagram, 210, true),
            L6UsageTick(instagram, 260, false),
            L6UsageTick(instagram, 280, true),
            L6UsageTick(instagram, 320, false),
            L6UsageTick(youtube, 220, true),
            L6UsageTick(youtube, 300, false)
        ), 200, 400, setOf(instagram))
        assertEquals(1, result.size)
        assertEquals(90L, result[0].ms)
        assertEquals(2, result[0].opens)
    }

    @Test fun rejectsUnboundedOrInvertedWindows() {
        assertTrue(UsageReader.summarise(emptyList(), 100, 99, setOf(instagram)).isEmpty())
        assertTrue(UsageReader.summarise(emptyList(), 0, UsageReader.MAX_WINDOW_MS + 1, setOf(instagram)).isEmpty())
    }
}
