"""L8 static acceptance: manifest reachability and native bridge wiring (no SDK)."""
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
res = root / "android/app/src/main"
ns = {"a": "http://schemas.android.com/apk/res/android"}
a = "{" + ns["a"] + "}"
manifest = ET.parse(res / "AndroidManifest.xml").getroot()

def component(tag, name):
    for el in manifest.findall(".//" + tag):
        if el.get(a + "name", "").endswith(name):
            return el
    raise AssertionError(f"Missing {tag} {name}")

activity = component("activity", "MainActivity")
assert activity.get(a + "exported") == "true"
assert activity.get(a + "launchMode") == "singleTask"
intents = activity.findall("intent-filter")
def has_intent(action, value):
    return any(
        i.find(f"action[@{a}name='{action}']") is not None
        and any(d.get(a + "host") == value or d.get(a + "mimeType") == value
                for d in i.findall("data"))
        for i in intents)
for host in ("auth", "capture", "start"):
    assert has_intent("android.intent.action.VIEW", host), host
assert has_intent("android.intent.action.SEND", "text/plain")
assert any(m.get(a + "name") == "android.app.shortcuts"
           for m in activity.findall("meta-data"))
widget = component("receiver", "CarrelWidget")
assert widget.get(a + "exported") == "true"
assert any(m.get(a + "resource") == "@xml/widget_info"
           for m in widget.findall("meta-data"))
tile = component("service", "TimerTile")
assert tile.get(a + "permission") == "android.permission.BIND_QUICK_SETTINGS_TILE"
assert tile.get(a + "exported") == "true"
for name in ("widget_small", "widget_wide"):
    xml = ET.parse(res / "res/layout" / (name + ".xml")).getroot()
    ids = {node.get(a + "id") for node in xml.iter()}
    for target in ("widget_root", "widget_name", "widget_elapsed", "widget_today", "widget_action"):
        assert "@+id/" + target in ids, (name, target)
assert (res / "res/xml/shortcuts.xml").exists()
main = (res / "java/app/carrel/study/MainActivity.java").read_text()
bridge = (res / "java/app/carrel/study/live/CarrelLivePlugin.kt").read_text()
web = (root / "web/native.js").read_text()
assert main.index("dispatchCaptureIntent(getIntent())") < main.index("super.onCreate(savedInstanceState)")
for phrase in ("pendingIncoming", "emitIncoming", "getSharedPreferences"):
    assert phrase in main
for phrase in ("consumeIncoming", "ackIncoming", "@JvmStatic"):
    assert phrase in bridge
for phrase in ("l8ReceiveIncoming", "l8LastStudyId", "l9OpenCapture", "topActivities"):
    assert phrase in web
print("L8 Android bridge and manifest static smoke passed")
