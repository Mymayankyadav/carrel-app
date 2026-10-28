package app.carrel.study;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import app.carrel.study.live.CarrelLivePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CarrelLivePlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemBars();
        dispatchCaptureIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchCaptureIntent(intent);
    }

    /** Persist external intents until the authenticated web shell is ready.
     * A WebView event alone is lost on a cold start. The bridge requires an ack. */
    private void dispatchCaptureIntent(Intent intent) {
        if (intent == null) return;
        String kind = null, value = "";
        if (Intent.ACTION_SEND.equals(intent.getAction()) &&
                "text/plain".equals(intent.getType())) {
            kind = "capture";
            value = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (value == null) value = "";
        } else if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            Uri uri = intent.getData();
            if (!"app.carrel.study".equals(uri.getScheme())) return;
            if ("capture".equals(uri.getHost())) {
                kind = "capture";
                value = uri.getQueryParameter("text");
                if (value == null) value = "";
            } else if ("start".equals(uri.getHost())) {
                kind = "start";
                value = uri.getQueryParameter("act");
                if (value == null) value = "last";
            }
        }
        if (kind == null) return;
        if (value.length() > 500) value = value.substring(0, 500);
        JSONObject payload = new JSONObject();
        try {
            payload.put("id", Long.toString(System.nanoTime()) + "-" + System.currentTimeMillis());
            payload.put("kind", kind);
            payload.put("value", value);
            // commit() is deliberate: the process can be killed before JavaScript boots.
            getSharedPreferences("carrel_live", MODE_PRIVATE).edit()
                .putString("pendingIncoming", payload.toString()).commit();
        } catch (Exception ignored) { return; }
        CarrelLivePlugin.emitIncoming(payload);
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        configureSystemBars();
    }

    private void configureSystemBars() {
        // Content can extend behind transparent bars. The web shell owns safe-area
        // padding; verify the reported insets on a physical Android device.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        boolean night = (getResources().getConfiguration().uiMode &
            Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!night);
        controller.setAppearanceLightNavigationBars(!night);
    }
}
