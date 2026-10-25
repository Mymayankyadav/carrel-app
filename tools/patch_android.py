"""Idempotent edits to the generated Capacitor Android project. Run after `cap add` and after every `cap sync`."""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent / 'android'
if not root.exists():
    sys.exit('android/ missing: run the scaffold workflow first')
app = root / 'app'
changed = []

# 1. deep link for Google sign-in: app.carrel.study://auth
man = app / 'src/main/AndroidManifest.xml'
t = man.read_text()
if 'android:scheme="app.carrel.study"' not in t:
    link = ('        <intent-filter>\n'
            '            <action android:name="android.intent.action.VIEW" />\n'
            '            <category android:name="android.intent.category.DEFAULT" />\n'
            '            <category android:name="android.intent.category.BROWSABLE" />\n'
            '            <data android:scheme="app.carrel.study" android:host="auth" />\n'
            '        </intent-filter>\n')
    i = t.index('</activity>')
    t = t[:i] + link + '        ' + t[i:]
    changed.append('manifest deep link')
if 'android:launchMode' not in t:
    t = t.replace('<activity', '<activity android:launchMode="singleTask"', 1)
    changed.append('launchMode')
man.write_text(t)

# 2. release signing and version from environment (see android.yml)
(app / 'carrel-signing.gradle').write_text("""android {
    def keystore = System.getenv('KEYSTORE_PATH')
    if (keystore) {
        signingConfigs {
            carrelRelease {
                storeFile file(keystore)
                storePassword System.getenv('KEYSTORE_PASSWORD')
                keyAlias System.getenv('KEY_ALIAS')
                keyPassword System.getenv('KEY_PASSWORD')
            }
        }
        buildTypes { release { signingConfig signingConfigs.carrelRelease } }
    }
    defaultConfig {
        versionCode((System.getenv('VERSION_CODE') ?: '1') as int)
        versionName(System.getenv('VERSION_NAME') ?: '1.0')
    }
}
""")
g = app / 'build.gradle'
if g.exists():
    s = g.read_text()
    if 'carrel-signing.gradle' not in s:
        g.write_text(s.rstrip('\n') + "\n\napply from: 'carrel-signing.gradle'\n")
        changed.append('build.gradle signing')
else:
    sys.exit('app/build.gradle not found (Kotlin DSL?). Adapt tools/patch_android.py')

# 3. launcher icon: white clock on Carrel green
res = app / 'src/main/res'
(res / 'drawable').mkdir(parents=True, exist_ok=True)
(res / 'values').mkdir(parents=True, exist_ok=True)
(res / 'mipmap-anydpi-v26').mkdir(parents=True, exist_ok=True)
(res / 'drawable/carrel_fg.xml').write_text('''<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <group android:translateX="30" android:translateY="30" android:scaleX="2" android:scaleY="2">
        <path android:fillColor="#FFFFFFFF" android:pathData="M12,2a10,10 0,1 0,0 20a10,10 0,0 0,0 -20M11,6h2v6.6l4.2,2.4 -1,1.7 -5.2,-3z" android:fillType="evenOdd" />
    </group>
</vector>
''')
(res / 'values/carrel_colors.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="carrel_bg">#1C6A4E</color></resources>\n')
icon = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/carrel_bg"/>\n    <foreground android:drawable="@drawable/carrel_fg"/>\n</adaptive-icon>\n'
(res / 'mipmap-anydpi-v26/ic_launcher.xml').write_text(icon)
(res / 'mipmap-anydpi-v26/ic_launcher_round.xml').write_text(icon)

print('patched:', ', '.join(changed) or 'nothing new (already applied)')
