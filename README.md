# Carrel

Personal study timer and planner. Web app (vanilla JS) wrapped as an Android app with Capacitor; data in Supabase.

## Layout
| Path | What |
|---|---|
| `web/` | App source. `build.py` concatenates it into one `www/index.html`. |
| `web/test/` | Node tests (`*_test.js`) and the mock store used by the test page. |
| `android/` | Capacitor Android project + native live timer / notification (`app/src/main/java/app/carrel/study/live/`). |
| `supabase/migrations/` | Database schema (already applied). |
| `tools/` | `patch_android.py` (used by the Android CI build), `shots.py` (phone screenshots of the mock app). |
| `docs/` | Current plan: `PLAN-redesign.md`. Older plans live in git history. |

## Build and test
```bash
npm ci --no-audit --no-fund
npm run build:web                       # -> www/index.html and web/test/carrel-test.html (mock data, no sign-in)
for f in web/test/*_test.js; do TZ=Asia/Kolkata node "$f" || exit 1; done
python3 tools/shots.py /tmp/shots [--dark]
python3 tools/redesign_smoke.py           # Playwright/Chromium; mock-only integration matrix
```
CI: `ci.yml` (PRs), `web.yml` (main → GitHub Pages + in-app web update), `android.yml` (APK release).

Redesign integration and verification: [docs/redesign/INTEGRATION.md](docs/redesign/INTEGRATION.md). Browser screenshots are retained by the Redesign acceptance workflow. Native/build-input changes on main also create a signed APK release; ordinary web-only changes update Pages and compatible installed apps.
