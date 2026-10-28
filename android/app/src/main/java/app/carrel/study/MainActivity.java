package app.carrel.study;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
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

    private void dispatchCaptureIntent(Intent intent) {
        if (intent == null) return;
        String value = null;
        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            value = intent.getStringExtra(Intent.EXTRA_TEXT);
        } else if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null &&
                   "capture".equals(intent.getData().getHost())) {
            value = intent.getData().getQueryParameter("text");
            if (value == null) value = "";
        }
        if (value == null) return;
        final String text = value.length() > 2000 ? value.substring(0, 2000) : value;
        final WebView web = getBridge() == null ? null : getBridge().getWebView();
        if (web == null) return;
        final String js = "window.dispatchEvent(new CustomEvent('carrel-capture',{detail:{text:" +
            JSONObject.quote(text) + "}}))";
        web.post(() -> web.evaluateJavascript(js, null));
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
