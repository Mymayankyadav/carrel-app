package app.carrel.study;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.carrel.study.live.CarrelLivePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CarrelLivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
