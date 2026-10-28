package app.carrel.study.live

import java.net.URLEncoder
import java.net.URLDecoder

/** Native Carrel deep links use encoded query components, never hand-built input. */
object CarrelLinks {
    private fun encode(v: String) = URLEncoder.encode(v, "UTF-8")
    fun startSubject(id: String): String = "app.carrel.study://start?act=" + encode(id)
    fun startLast(): String = "app.carrel.study://start?last=1"
    fun capture(text: String = ""): String = "app.carrel.study://capture" +
        (if (text.isEmpty()) "" else "?text=" + encode(text))

    /** Pure JVM parser for tests; Android routes using Uri.getQueryParameter. */
    fun decodeQuery(url: String, key: String): String? {
        val uri = runCatching { java.net.URI(url) }.getOrNull() ?: return null
        return uri.rawQuery?.split("&")?.firstNotNullOfOrNull { pair ->
            val parts = pair.split("=", limit = 2)
            if (parts.size == 2 && parts[0] == key)
                runCatching { URLDecoder.decode(parts[1], "UTF-8") }.getOrNull()
            else null
        }
    }
}
