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
if 'app.carrel.study.live.ActionReceiver' not in t:
    perms = ''.join(f'    <uses-permission android:name="android.permission.{x}" />\n' for x in
                    ['POST_NOTIFICATIONS', 'VIBRATE', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED'])
    comps = ('        <receiver android:name="app.carrel.study.live.ActionReceiver" android:exported="false" />\n'
             '        <receiver android:name="app.carrel.study.live.AlarmReceiver" android:exported="false" />\n'
             '        <receiver android:name="app.carrel.study.live.SystemReceiver" android:exported="true">\n'
             '            <intent-filter>\n'
             '                <action android:name="android.intent.action.BOOT_COMPLETED" />\n'
             '                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />\n'
             '                <action android:name="android.intent.action.TIMEZONE_CHANGED" />\n'
             '                <action android:name="android.intent.action.TIME_SET" />\n'
             '                <action android:name="android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" />\n'
             '            </intent-filter>\n'
             '        </receiver>\n'
             '        <activity android:name="app.carrel.study.live.DriftActivity" android:exported="false" '
             'android:theme="@style/Theme.Carrel.Translucent" android:excludeFromRecents="true" android:taskAffinity="" />\n')
    t = t.replace('</application>', comps + '    </application>', 1).replace('</manifest>', perms + '</manifest>', 1)
    changed.append('manifest notification components')
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
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}
kotlin { jvmToolchain(21) }
dependencies {
    implementation 'androidx.work:work-runtime:2.10.1'
}
""")
rg = root / 'build.gradle'
rs = rg.read_text()
if 'kotlin-gradle-plugin' not in rs:
    rs = re.sub(r"(classpath 'com\.android\.tools\.build:gradle:[^']*')", r"\1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20'", rs, count=1)
    rg.write_text(rs)
    changed.append('kotlin classpath')
g = app / 'build.gradle'
if g.exists():
    s = g.read_text()
    if "org.jetbrains.kotlin.android" not in s:
        s = s.replace("apply plugin: 'com.android.application'", "apply plugin: 'com.android.application'\napply plugin: 'org.jetbrains.kotlin.android'", 1)
        g.write_text(s)
        changed.append('kotlin plugin')
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
