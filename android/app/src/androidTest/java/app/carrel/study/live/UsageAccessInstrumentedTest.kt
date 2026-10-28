package app.carrel.study.live

import android.content.Context
import android.os.ParcelFileDescriptor
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Real Android AppOps smoke: consent is an OS gate, not just a JS preference.
 * This test runs on an emulator; it never signs in or sends usage data.
 */
@RunWith(AndroidJUnit4::class)
class UsageAccessInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context: Context get() = instrumentation.targetContext

    private fun appOp(mode: String) {
        val command = "appops set ${context.packageName} GET_USAGE_STATS $mode"
        // executeShellCommand is run as the emulator's shell user, not the app.
        val reply: ParcelFileDescriptor = instrumentation.uiAutomation.executeShellCommand(command)
        reply.use {
            android.os.ParcelFileDescriptor.AutoCloseInputStream(it).bufferedReader().use { stream ->
                stream.readText()
            }
        }
    }

    @Test fun systemAccessControlsReadsRegardlessOfSelectedApps() {
        val now = System.currentTimeMillis()
        try {
            appOp("ignore")
            assertFalse("An explicitly denied special permission must not pass", UsageReader.hasAccess(context))
            assertTrue(UsageReader.read(context, now - 5 * 60_000L, now,
                UsageReader.DEFAULT_PACKAGES).isEmpty())

            appOp("allow")
            assertTrue("An explicitly granted special permission must pass", UsageReader.hasAccess(context))
            assertTrue("An empty allowlist must never scan", UsageReader.read(context,
                now - 5 * 60_000L, now, emptyList()).isEmpty())
            assertTrue("Unapproved package names are ignored", UsageReader.read(context,
                now - 5 * 60_000L, now, listOf("com.example.not.allowed")).isEmpty())
        } finally {
            // Never leave the test APK with special access enabled.
            appOp("ignore")
        }
        assertFalse(UsageReader.hasAccess(context))
    }
}
