package app.carrel.study.live

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Deep links are tested without an emulator or Android framework mocks. */
class CarrelLinksTest {
    @Test fun captureEncodesArbitraryText() {
        val text = "Topology & algebra #1? 😀"
        val url = CarrelLinks.capture(text)
        assertTrue(url.startsWith("app.carrel.study://capture?text="))
        assertEquals(text, CarrelLinks.decodeQuery(url, "text"))
    }

    @Test fun startSubjectEncodesIdentifier() {
        val id = "complex analysis/a&b"
        val url = CarrelLinks.startSubject(id)
        assertEquals(id, CarrelLinks.decodeQuery(url, "act"))
    }

    @Test fun startLastIsNotMistakenForSpecificSubject() {
        assertEquals("app.carrel.study://start?last=1", CarrelLinks.startLast())
        assertNull(CarrelLinks.decodeQuery(CarrelLinks.startLast(), "act"))
    }

    @Test fun malformedUrlsDoNotCrash() {
        assertNull(CarrelLinks.decodeQuery("not a URI %", "text"))
        assertNull(CarrelLinks.decodeQuery(CarrelLinks.capture(), "text"))
    }
}
