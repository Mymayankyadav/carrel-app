# Carrel for Android on Supabase: implementation plan

Written by Opus for a Sonnet implementer. Work phase by phase, in order.
Each phase ends in something the user can check on their phone.

Every phase header names the model and effort to use. If a phase says *escalate*, stop and tell the user which model and effort to switch to; don't push on.

---

## 0. Ground rules (read every session)

### Who and where
- The user is on an Android phone only, with no laptop.
- Timezone `Asia/Kolkata`; the logical day starts at `04:00`.
- The user is low on usage, so keep token use down:
  - `grep -n` first, then read only the line ranges you need.
  - Never re-read whole files, never paste large files into chat, never re-derive what this plan already decides.

### Sources
- **Carrel web source:** `carrel-source.zip` → `carrel/`. Vanilla JS, built by `build.py`; ~5k lines.
- **Old phone app:** `Carrel-Live-repository.zip` → `carrel-live/`. Kotlin; port from here, read-only.
- **Old artifact:** https://claude.ai/artifact/GPbHEVpi3YYoRM7UcpZxT6. It becomes a read-only archive and is never written to.

### Container limits (verified)
- The shell **cannot** reach npm, Google Maven, `dl.google.com` or `*.supabase.co`. GitHub works.
- So nothing is installed or Gradle-built locally. **All npm and Android builds run in GitHub Actions.**
- Don't try to work around the proxy.
- Locally you can do these:
  - `node` for logic tests
  - `python3 build.py`
  - headless Chromium (Playwright is pre-installed) to look at the mock test page
  - `keytool`
  - `gh` for CI logs: `gh run list`, `gh run view <id> --log-failed`

### Supabase
- Use only the Supabase MCP tools: `execute_sql`, `apply_migration`, `get_advisors`, `get_project_url`, `get_publishable_keys`, `list_tables`.

### Ask before
- running any SQL. Show it first; for long SQL, show the file path plus a 10-line summary.
- creating the Supabase project.
- the first push to `main` in each phase. Pushing deploys.
- anything destructive: drops, deletes, force-pushes, overwriting data.
- publishing a release.

### After each phase
- Tick it in §12 of this file, commit, and give the user a 3-line "what to test on your phone" note.

---

## 1. Decisions (resolved here; don't relitigate)

| # | Decision |
|---|---|
| D1 | **Public GitHub repo.** It's needed for free GitHub Pages, which hosts the web build and the update bundles, and for public APK downloads. Nothing secret is in it: the Supabase URL and publishable key are designed to be public under RLS, and signing keys live in Actions secrets. *If the user refuses:* use Cloudflare Pages for hosting instead; that needs a Cloudflare account and a deploy token secret. |
| D2 | **Bundled web code + self-update** via `@capgo/capacitor-updater` in manual, self-hosted mode (Phase 6). The app always starts from a local bundle, so it works fully offline. On start it checks `latest.json` on GitHub Pages, downloads the newer web bundle and switches to it on the next launch. Only native (Kotlin) changes need a new APK. A hosted `server.url` was rejected: it gives a blank screen when the app is cold-started offline. |
| D3 | **One generic table `docs(owner, path, data jsonb)`.** It mirrors the artifact database exactly, so app code barely changes. SQL views give Claude flat tables for cheap aggregate queries. |
| D4 | **Writes go through RPCs** (`doc_merge`, `doc_set`, `doc_delete`): server-side deep merge, which is atomic, so the app, the phone notification and Claude can't clobber each other. |
| D5 | **Notification buttons call server-side timer verbs directly from Kotlin** (`carrel_stop`, `carrel_break`, `carrel_mark`, all SQL). They work even when the WebView is dead, and Claude can use the same verbs. The JS app keeps its own client-side logic, which has undo. |
| D6 | **Sign-in:** Google through Supabase Auth, with PKCE. Web uses a normal redirect. The Android app opens a Custom Tab and gets the result back on the deep link `app.carrel.study://auth`. No native Google SDK and no SHA-1 setup. |
| D7 | **New applicationId `app.carrel.study`.** It installs alongside the old Carrel Live; the user uninstalls that one after Phase 5. **A new signing key** is generated in the container with `keytool`. |
| D8 | **Single user.** `carrel_owner` holds the one owner uuid, so SQL run by Claude (as `postgres`, with no `auth.uid()`) resolves to the user. New sign-ups are disabled after the first sign-in. |
| D9 | **Phase order:** the web build is usable in phone Chrome (GitHub Pages) *before* any APK exists. That lets sign-in, migration and sync be tested with zero Android risk. |

---

## 2. Target repo layout (`Mymayankyadav/<repo>`; get the name from the user)

```
web/                     Carrel source moved here (logic.js app.js cal.js gcal.js boot.js style.css build.py test/)
web/supa.js              NEW  db adapter: same interface as the artifact db (§5.2)
web/auth.js              NEW  Supabase client, sign-in/out, session → native
web/native.js            NEW  bridge to the CarrelLive plugin + export shim (§7.6)
web/config.js            NEW  SUPABASE_URL, SUPABASE_KEY (publishable), APP_SCHEME
supabase/migrations/     SQL files, numbered (§4)
android/                 Capacitor project, committed (generated once by scaffold.yml)
android/app/src/main/java/app/carrel/study/live/*.kt   NEW native plugin (§7)
package.json, package-lock.json, capacitor.config.json
.github/workflows/scaffold.yml  web.yml  android.yml
docs/PLAN-carrel-android.md   (this file)   docs/PLAN-carrel-live.md (old, for reference)
```
`web/live.js` is deleted.

---

## Phase P0: Setup · **Sonnet, low effort**

### P0.1 User tasks (give them as a checklist)
1. **GitHub:** create the **public** repo (D1). Make sure the Claude GitHub app can access it, then send `owner/repo`.
2. **Google Cloud Console**, on the phone in desktop-site mode:
   1. Create a new project named "Carrel".
   2. **OAuth consent screen:**
      - External.
      - App name Carrel, with the user's email as the support email.
      - Add themselves as a test user.
      - *Publishing status can stay Testing until Phase G.*
   3. **Credentials:**
      - Create an OAuth client ID of type **Web application**.
      - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Get the ref after P0.2.
      - Copy the Client ID and secret.
3. **Supabase dashboard**, after P0.2:
   1. Authentication → Providers → **Google**: enable it, then paste the Client ID and secret.
   2. Authentication → URL Configuration:
      - **Site URL** = `https://<owner>.github.io/<repo>/`
      - **Redirect URLs**: add `https://<owner>.github.io/<repo>/**` and `app.carrel.study://auth`.

### P0.2 Claude tasks
1. **Supabase project.** Ask first, then `create_project`:
   - name `carrel`
   - region `ap-south-1`
   - org `Carrel` (id `xxyggfiobjjrmoxkquhk`)

   The server handles cost confirmation; expect $0 on the free plan. Poll `get_project` until it's healthy. Then get the URL and publishable key with `get_project_url` and `get_publishable_keys`, and write them to `web/config.js`.
2. **Repo.** `add_repo` with push access, then clone.
   - Copy in the source: `carrel/` → `web/`, and this plan plus the old plan → `docs/`.
   - Add a `.gitignore`: `node_modules/`, `www/`, `dist/`, `*.jks`, `android/app/build/`, `android/.gradle/`.
3. **Workflow-push test, first.** Push a trivial `.github/workflows/noop.yml` (`on: workflow_dispatch`).
   - If the push is rejected because the token has no `workflow` scope, **stop**. Tell the user that the workflow files must be added through GitHub's web editor. Plan for that by keeping every workflow file small and self-contained.
   - Delete `noop.yml` afterwards.
4. **Signing key.**
   - Generate it:
     ```
     keytool -genkeypair -keystore carrel-release.jks -alias carrel -keyalg RSA -keysize 4096 -validity 36500 -storepass <P> -keypass <P> -dname "CN=Carrel"
     ```
     `<P>` is 24 random alphanumeric characters.
   - Set the secrets with `gh secret set`:
     - `KEYSTORE_BASE64` (base64 -w0)
     - `KEYSTORE_PASSWORD`
     - `KEY_PASSWORD`
     - `KEY_ALIAS=carrel`

     If `gh` lacks admin rights, give the user the four values to paste under Settings → Secrets → Actions.
   - Send the `.jks` and the password to the user **for safekeeping** with SendUserFile, and tell them to store both in their password manager or Drive. Losing them means the app can't be updated in place.
   - Never commit the `.jks`.
5. **GitHub Pages.** Ask the user to set Settings → Pages → Source = **GitHub Actions**. (`gh api` may also work: `repos/{o}/{r}/pages -f build_type=workflow`.)

**Done when:** the project is healthy, `config.js` is filled, the repo has the source, the secrets are set, and Pages is enabled.

---

## Phase P1: Database · **Sonnet, low effort**

The SQL below is final. Save it as `supabase/migrations/001_core.sql`. Show the user the summary, apply it with `apply_migration` (name `core`), then run `get_advisors` (security) and fix only real findings.

```sql
-- ===== table =====
create table public.docs (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null check (path ~ '^[a-z]+/[A-Za-z0-9_.:@+~-]+$'),
  coll text generated always as (split_part(path, '/', 1)) stored,
  id   text generated always as (split_part(path, '/', 2)) stored,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  date text generated always as (data->>'date') stored,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'app',          -- 'app' | 'native' | 'claude' | 'migration'
  primary key (owner, path)
);
create index docs_coll_date on public.docs (owner, coll, date);
alter table public.docs replica identity full;      -- realtime deletes carry the old row
alter table public.docs enable row level security;
create policy docs_own on public.docs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
alter publication supabase_realtime add table public.docs;
comment on table public.docs is
  'Carrel study tracker. Read the guide first: select data from docs where path = ''meta/guide''.';

-- ===== single owner (for SQL run by Claude as postgres) =====
create table public.carrel_owner (
  singleton boolean primary key default true check (singleton),
  owner uuid not null references auth.users(id) on delete cascade
);
alter table public.carrel_owner enable row level security;   -- no policies: invisible to the app

create or replace function public.carrel_uid() returns uuid
language sql stable set search_path = '' as $$
  select coalesce(auth.uid(),
    case when current_user in ('postgres', 'service_role', 'supabase_admin')
         then (select owner from public.carrel_owner) end)
$$;

-- ===== json helpers =====
create or replace function public.jsonb_merge_deep(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  if b is null then return r; end if;
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(v) = 'object' and jsonb_typeof(r->k) = 'object' then
      r := r || jsonb_build_object(k, public.jsonb_merge_deep(r->k, v));
    else
      r := r || jsonb_build_object(k, v);           -- JSON null is stored, same as the artifact db
    end if;
  end loop;
  return r;
end $$;

-- ===== document RPCs (used by app, native and Claude) =====
create or replace function public.doc_merge(p_path text, p_patch jsonb, p_ensure jsonb default null, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare uid uuid := public.carrel_uid(); r jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.docs set data = public.jsonb_merge_deep(data, p_patch), updated_at = now(), updated_by = p_by
   where owner = uid and path = p_path returning data into r;
  if found then return r; end if;
  if p_ensure is null then raise exception 'missing document %', p_path using errcode = 'P0002'; end if;
  insert into public.docs (owner, path, data, updated_by)
  values (uid, p_path, public.jsonb_merge_deep(p_ensure, p_patch), p_by)
  on conflict (owner, path) do update
    set data = public.jsonb_merge_deep(public.docs.data, p_patch), updated_at = now(), updated_by = p_by
  returning data into r;
  return r;
end $$;

create or replace function public.doc_set(p_path text, p_data jsonb, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare uid uuid := public.carrel_uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.docs (owner, path, data, updated_by) values (uid, p_path, p_data, p_by)
  on conflict (owner, path) do update set data = excluded.data, updated_at = now(), updated_by = p_by;
  return p_data;
end $$;

create or replace function public.doc_delete(p_path text) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.docs where owner = public.carrel_uid() and path = p_path;
end $$;

-- ===== views for Claude (security_invoker → RLS applies to the app) =====
create view public.entries with (security_invoker = true) as
select d.owner, d.id as day, e.key as entry_id,
       e.value->>'activity' as activity,
       (e.value->>'start')::timestamptz as start_at,
       (e.value->>'end')::timestamptz   as end_at,
       round((extract(epoch from (e.value->>'end')::timestamptz - (e.value->>'start')::timestamptz) / 60)::numeric, 1) as minutes,
       e.value->>'note' as note, (e.value->>'focus')::int as focus, e.value->>'block' as block,
       (e.value->'pomo'->>'target')::int as pomo_target
from public.docs d cross join lateral jsonb_each(d.data->'entries') e
where d.coll = 'days' and jsonb_typeof(e.value) = 'object';

create view public.activities with (security_invoker = true) as
select d.owner, a.key as id, a.value->>'name' as name, a.value->>'kind' as kind, a.value->>'color' as color,
       (a.value->>'goal')::int as weekly_goal_min, a.value->>'role' as role,
       coalesce((a.value->>'archived')::boolean, false) as archived, (a.value->>'order')::numeric as sort
from public.docs d cross join lateral jsonb_each(d.data->'items') a
where d.path = 'config/activities' and jsonb_typeof(a.value) = 'object';

create view public.daily_totals with (security_invoker = true) as
select e.owner, e.day, e.activity, a.name, a.kind, sum(e.minutes) as minutes, count(*) as sessions
from public.entries e left join public.activities a on a.owner = e.owner and a.id = e.activity
group by 1, 2, 3, 4, 5;

create view public.plan_blocks with (security_invoker = true) as
select d.owner, d.id as day, d.data->>'source' as source, b.key as block_id,
       b.value->>'activity' as activity, b.value->>'title' as title,
       (b.value->>'minutes')::int as minutes, (b.value->>'orig')::int as orig,
       (b.value->>'order')::numeric as sort, b.value->>'at' as at, b.value->>'status' as status,
       b.value->>'pomo' as pomo, b.value->>'from' as carried_from
from public.docs d cross join lateral jsonb_each(coalesce(d.data->'blocks', '{}'::jsonb)) b
where d.coll = 'plans' and jsonb_typeof(b.value) = 'object';

create view public.current_timer with (security_invoker = true) as
select owner, coalesce((data->>'running')::boolean, false) as running, data->>'id' as id,
       data->>'activity' as activity, (data->>'start')::timestamptz as start_at,
       case when (data->>'running')::boolean
            then round((extract(epoch from now() - (data->>'start')::timestamptz) / 60)::numeric, 1) end as elapsed_min,
       data->>'note' as note, data->'pomo' as pomo, updated_at, updated_by
from public.docs where path = 'state/current';

-- ===== privileges: nothing for anon =====
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.entries, public.activities, public.daily_totals, public.plan_blocks, public.current_timer to authenticated;
grant execute on function public.carrel_uid(), public.jsonb_merge_deep(jsonb, jsonb),
  public.doc_merge(text, jsonb, jsonb, text), public.doc_set(text, jsonb, text), public.doc_delete(text) to authenticated;
```

**Checks** (run with `execute_sql`):
- `select public.jsonb_merge_deep('{"a":{"b":1,"c":2}}', '{"a":{"b":null,"d":3}}')` → `{"a": {"b": null, "c": 2, "d": 3}}`
- `select * from entries limit 1` → zero rows, no error.

The timer verbs (`carrel_stop` and the rest) are in Phase P5 SQL (§7.2). Don't create them now.

---

## Phase P2: Web app on Supabase (phone Chrome) · **Sonnet, medium effort**

Goal: `https://<owner>.github.io/<repo>/` works in phone Chrome. You sign in with Google, see an empty Carrel, and data syncs. No native code yet.

### 5.1 Remove the artifact coupling (in `web/`)
- **Delete `live.js`.** Remove it from `build.py`.
- In `app.js`:
  - remove the `config/live` subscription (line ~265)
  - remove `liveSync()` (~1740)
  - remove every `LV`/`live*`/`vLivePanel` reference (`grep -n "LV\.\|live[A-Z]\|vLivePanel"`)
- Leave `logic.js` live helpers in place (`liveStateOf` is reused in §7.6). `planMarks`, `encodeToken`, `decodeToken` and `cleanMark` can be deleted along with their tests.
- `gcal.js`: keep the file. When `S.mcp` is null (always, from now on), `gcWatch` must no-op, and `gcFor`/`gcAllDay` return `[]`; they already do because `GC.events` stays empty. Hide `vGcalPanel` behind `if (!S.mcp) return ''` with a one-line "Calendar busy time: coming later". Phase G replaces it.
- `boot.js` → just `boot({});`.
- Copy that mentions "Claude account" or "Claude app": rewrite it for signed-in Carrel (`grep -n "Claude" app.js`). This includes the `S.conn === 'none'` banner (~850) and the export line (~1620).

### 5.2 `supa.js`: the db adapter
It reproduces the interface app.js and `test/mock.js` already use, so `execOp`, `subscribe` and `ensureRange` stay **unchanged**.

```
makeDb(sb, uid) → db
db.doc(path) → ref { get(), set(data), update(patch), delete(), onSnapshot(next, err) → unsub }
db.collection(name) → query { where(field, op, v) → query, orderBy(field, dir) → query, limit(n) → query,
                               get(), onSnapshot(next, err) → unsub }
doc snapshot   = { id, exists, data(), metadata: { fromCache } }
query snapshot = { docs: [doc snapshot], size, empty }
```

**Reads**
- `sb.from('docs').select('path,data')`, with `.eq('path', p)` for a doc or `.eq('coll', name)` for a collection.
- Filters:
  - field `date` → column `date`
  - any other field → `'data->>' + field`
  - ops `>= <= > < ==` → `gte lte gt lt eq`
- `orderBy`/`limit` are applied **in memory**. The data is tiny, and that keeps realtime re-evaluation simple.

**Writes**
| Method | RPC |
|---|---|
| `update` | `rpc('doc_merge', {p_path, p_patch})`, no ensure, so that `execOp`'s missing-doc fallback still runs |
| `set` | `rpc('doc_set', {p_path, p_data})` |
| `delete` | `rpc('doc_delete', {p_path})` |

On success, apply the result to the cache and **emit to listeners immediately** (local echo). Otherwise pending ops are dropped before realtime arrives, and the UI flickers.

**Error → code mapping** (what `pump` expects)
| Error | Throw |
|---|---|
| PG `P0002` | `{code:'invalid_argument'}` |
| PG `42501`, or HTTP 401/403 after one `sb.auth.refreshSession()` attempt | `{code:'not_granted'}` |
| `TypeError` / fetch failure / 5xx | `{code:'unavailable'}` (retried) |

**Realtime**
- One channel for the whole table:
  ```js
  sb.channel('docs').on('postgres_changes', {event:'*', schema:'public', table:'docs', filter:'owner=eq.'+uid}, h)
  ```
- Handling an event:
  - Update the cache entry `path → data`; delete it on `DELETE`, using `payload.old.path`.
  - Re-emit every listener that matches: a doc listener on the same path, or a query listener on the same coll, with its filters, order and limit evaluated in memory over the cache.
- Refetch all active listeners when:
  - the channel status goes back to `SUBSCRIBED` after an error, a timeout or a close
  - `document.visibilitychange` → visible
  - `window.online`

**Offline cold start**
- Persist the cache to IndexedDB: db `carrel`, store `kv`, key `'docs:'+uid`, debounced to 1 s.
- On creation, load it first and emit to new listeners with `fromCache: true` before the network answers.
- About 40 lines; no library.

**Tests**
- Extend `test/mock.js`? No. Instead, add `test/supa_test.js`: a node test that runs `supa.js` against a fake `sb` object (stub `from`, `rpc`, `channel`). Assert:
  - filter mapping
  - the error mapping
  - local echo
  - in-memory order and limit for `reviews`
- `supa.js` must therefore export `makeDb` under `module.exports`, the same way `logic.js` does.

### 5.3 `auth.js` and boot
- **Load supabase-js locally as UMD.** CI copies `node_modules/@supabase/supabase-js/dist/umd/supabase.js` to `www/vendor/supabase.js`. `build.py` emits `<script src="vendor/supabase.js"></script>` before the app script. Never use a CDN: it must work offline.
- **Client:**
  ```js
  supabase.createClient(URL, KEY, {auth: {flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl: !NATIVE}})
  ```
- **Signed out:** render a small card in `#main`, in the existing banner style: title "Carrel", a "Sign in with Google" button, one line of copy. Nothing else renders.
- **Web sign-in:**
  ```js
  sb.auth.signInWithOAuth({provider:'google', options:{redirectTo: location.origin + location.pathname}})
  ```
- **Native sign-in (P4):** `signInWithOAuth({... redirectTo: APP_SCHEME + '://auth', skipBrowserRedirect: true})`, then:
  - `Capacitor.Plugins.Browser.open({url: data.url})`
  - `App.addListener('appUrlOpen', ({url}) => …)`: read `code`, call `exchangeCodeForSession(code)`, then `Browser.close()`
- **Replace the `window.claude` block at the end of `boot()`** (app.js ~2143-2161) with:
  ```js
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { S.conn = 'none'; recompute(); render(); return; }   // 'none' banner now shows the sign-in card
  S.db = makeDb(sb, session.user.id); S.user = session.user; S.owner = true; S.conn = 'live'; S.dl = DL;  // DL from native.js
  subscribe(); pumpAll(); recompute(); render();
  ```
  Also subscribe to `sb.auth.onAuthStateChange`:
  - `SIGNED_IN` (when not yet booted) → run the above.
  - `SIGNED_OUT` → clear S.base, the cache and pending → show the card.
  - `TOKEN_REFRESHED` → `nativeSession(session)` (no-op on web).
- **Setup view:** add "Signed in as <email> · Sign out" (Setup is a sheet opened by `data-act="setup"`; place it next to the export row, `grep -n 'data-act="export"' app.js`).
- **Settings:** if `settings.tz` is missing, write `Intl.DateTimeFormat().resolvedOptions().timeZone` once after load, with `undo:false`. The SQL timer verbs need it.

### 5.4 `build.py`
- Inputs: `logic.js`, `app.js`, `cal.js`, `gcal.js`, `config.js`, `supa.js`, `auth.js`, `native.js`, `boot.js`.
- Output `www/index.html` as a **full document**:
  - `<!doctype html>`, `<meta charset>`
  - `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`
  - `<meta name="theme-color">` taken from the CSS `--bg` token
  - the existing head (drop the `claude:` meta)
  - the CSS, the shell, then the scripts
- Keep the `module.exports` guard trick for **every** file that exports (`logic.js`, `supa.js`).
- Keep the `test/carrel-test.html` output. In it, `mock.js` must bypass auth: if `window.__mockDocs` exists, `auth.js` skips Supabase and uses the mock `window.claude.use('db')` path. Keep that path available **only** in the test build. The simplest way is a `MOCK` constant that `build.py` sets to true only for the test page.
- Fonts: leave Google Fonts links as they are for now; offline they fall back to system fonts. Optional polish in P6: CI downloads the woff2 files into `www/fonts/`.

### 5.5 `web.yml` (GitHub Pages)
- Triggers: push to `main` touching `web/**`, `package*.json` or this workflow; plus `workflow_dispatch`.
- Steps:
  1. `actions/checkout@v4`, `actions/setup-node@v4` (node 22)
  2. `npm ci` (package.json from P4; **in P2, create a minimal `package.json`** with just `@supabase/supabase-js@^2`)
  3. `python3 web/build.py` and copy the vendor file
  4. run node tests: `TZ=Asia/Kolkata node web/test/logic_test.js && node web/test/supa_test.js`
  5. `actions/upload-pages-artifact@v3` (path `www`), then `actions/deploy-pages@v4`
- Permissions: `pages: write`, `id-token: write`.

### P2 local verification
- Both node test files pass.
- Build, then take one headless Chromium screenshot of `test/carrel-test.html` (the mock): the app renders and nothing is broken.

### P2 on the phone
1. Open the Pages URL and sign in with Google. You land on an empty Carrel (onboarding).
2. Start and stop a timer, then reload: the entry persists.
3. Then run `select owner, path, updated_by from docs` → rows exist.
4. **Then:**
   - insert the owner:
     ```sql
     insert into public.carrel_owner (owner) select id from auth.users;   -- exactly 1 row expected; check first
     ```
   - Ask the user to turn off **Authentication → Sign In / Providers → "Allow new users to sign up"**.

**Escalate** if Google sign-in or realtime fails after two fix attempts: switch to **Opus, high effort**.

---

## Phase P3: Migrate artifact data + guide · **Sonnet, low–medium effort**

1. **Dump.** For each collection (`config`, `state`, `days`, `plans`, `reviews`, `planning`, `distractions`, `meta`), call `ArtifactData list` with `query.limit 1000` and `out_dir=<scratchpad>/dump`. This writes to files and keeps the data out of the chat.
2. **Ask the user first.** Some of the dump looks like example or test data: entry ids `t0`, `t1`, `run1` and the note "Organic: reaction mechanisms" match the old mock. Ask: migrate everything, or only from some date? Or start clean, keeping only the config, timetable, deadlines and backlog?
3. **Generate the SQL.** A python script (`-I`, reading the dump directory) writes `supabase/migrations/002_import.sql`:
   ```sql
   insert into public.docs (owner, path, data, updated_by)
   values ((select owner from public.carrel_owner), '<coll>/<id>', $j$<json>$j$::jsonb, 'migration')
   on conflict (owner, path) do nothing;
   ```
   - Skip `config/live` and `meta/guide`.
   - Unwrap each file to the document body. Check the dump's file shape: it may be `{id, data, version}`.
   - Add `"tz":"Asia/Kolkata"` to `config/settings`.
   - Guard against `$j$` appearing inside the JSON.
4. **Show, then run.** Show the user the row counts per collection, then run it with `execute_sql`, in chunks of under 40 KB.
5. **Verify.**
   - Row counts per `coll` match the dump.
   - Sum of `entries.minutes` per activity, in SQL, vs the same sum computed in node over the dump files with `logic.js` helpers. They must match to 0.1 min.
6. **Guide row** (`meta/guide`, written with `doc_set(..., 'migration')`). Start from the current artifact guide, already read and saved in the dump, keeping `paths`, `plans`, `time` and `conventions`. Set `"version": 3` and add a `supabase` section:
   - "All data lives in `public.docs(path, data jsonb)`, one row per document. Paths and shapes are below."
   - "Read with the views:
     - `entries` (one row per log entry, minutes)
     - `daily_totals`
     - `activities`
     - `plan_blocks`
     - `current_timer`

     For anything else, query `docs` with `data->…`."
   - "Write ONLY through the functions, always with `p_by => 'claude'`:
     - `select doc_merge('plans/2026-10-27', '{…}'::jsonb, '{\"date\":\"2026-10-27\",\"source\":\"claude\",\"blocks\":{}}'::jsonb, 'claude')`, which deep-merges (a JSON null deletes an entry or block)
     - `doc_set(path, data, 'claude')`, which replaces
     - `doc_delete(path)`

     Never use raw INSERT/UPDATE on docs."
   - "The timer, from chat:
     - `select carrel_stop()`
     - `select carrel_break()`
     - to start: `select doc_set('state/current', '{"running":true,"id":"e_<random>","activity":"<id>","start":"<ISO +05:30>","note":"","block":null,"pomo":null,"ret":null,"ack":null}', 'claude')`

     Only start if `current_timer.running` is false; otherwise stop first."
   - "Owner is implicit (`carrel_uid()`); never filter or insert owner yourself."
   - "Show the user the exact change before any write that edits or deletes log entries."
7. Mark the old artifact as an archive. No writes to it, ever. Tell the user it stays at its URL as a read-only backup.

**Phone check:** history shows in Today, Week and Patterns in phone Chrome. Then, in a fresh claude.ai chat with the Supabase connector, ask: "How many hours did I study last week by subject?" The answer should come from a single `daily_totals` query.

---

## Phase P4: Capacitor shell + APK · **Sonnet, medium effort**

### 6.1 `scaffold.yml` (run once with workflow_dispatch; it commits back)
- Permissions: `contents: write`.
- Steps:
  1. Checkout; setup-node 22; setup-java temurin **21**; `android-actions/setup-android@v3`.
  2. Install the packages and scaffold the Android project:
     ```
     npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/browser @capacitor/filesystem @capacitor/share @supabase/supabase-js@^2
     npx cap init Carrel app.carrel.study --web-dir www
     mkdir -p www && echo '<!doctype html>' > www/index.html
     npx cap add android
     ```
  3. `git add package.json package-lock.json capacitor.config.* android && git commit -m "Scaffold Capacitor" && git push`
- Read the run log for the Capacitor major version and the template's AGP/Kotlin setup, and note them in §12.

### 6.2 Android project edits (in the repo, after the scaffold)
- **`android/app/src/main/AndroidManifest.xml`**, MainActivity: add the deep link
  ```xml
  <intent-filter android:autoVerify="false"><action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="app.carrel.study" android:host="auth"/></intent-filter>
  ```
  Keep `android:launchMode="singleTask"`; the template has it.
- **`capacitor.config.json`:**
  ```json
  { "appId": "app.carrel.study", "appName": "Carrel", "webDir": "www",
    "android": { "allowMixedContent": false },
    "plugins": { "SplashScreen": { "launchShowDuration": 0 } } }
  ```
- **App icon:** reuse `carrel-live/app/src/main/res/drawable/ic_launcher_foreground.xml` plus a background colour. Generate the adaptive-icon XML by hand: `mipmap-anydpi-v26/ic_launcher.xml`.
- **Signing and version** in `android/app/build.gradle`: same pattern as `carrel-live/app/build.gradle.kts`, translated to the template's Groovy or KTS.
  - Use `KEYSTORE_PATH` and the password env vars.
  - Fail `packageRelease` when unsigned.
  - `versionCode` = env `VERSION_CODE`; `versionName` = env `VERSION_NAME`.
- **Safe areas:** the template may run edge-to-edge. After the first install, the user sends one screenshot. Fix the header or nav overlap in CSS with `env(safe-area-inset-*)`, or with the template's `adjustMarginsForEdgeToEdge` option. Pick whichever the scaffolded version supports.

### 6.3 `android.yml`
- Triggers: tag `v*`, `workflow_dispatch`, and push to `main` touching `android/**`.
- Steps:
  1. Checkout, node 22, java 21, setup-android.
  2. Build the web part and sync it:
     ```
     npm ci
     python3 web/build.py
     cp node_modules/@supabase/supabase-js/dist/umd/supabase.js www/vendor/
     npx cap sync android
     ```
  3. Restore the keystore exactly as `carrel-live/.github/workflows/release.yml` does.
  4. `cd android && ./gradlew --no-daemon assembleRelease`
  5. Verify with `apksigner verify`.
  6. Release: `VERSION_CODE = 100000 + run_number`. On a tag → release `vX.Y.Z`; otherwise a prerelease `build-N`. Upload `Carrel.apk` with `gh release upload`. Copy the release step from the old workflow.

### P4 on the phone
1. Open the release page in Chrome, download `Carrel.apk` and install it (allow "install unknown apps" for Chrome).
2. Sign in with Google: the Custom Tab opens and comes back to the app.
3. Data shows; a timer started in the app shows up in phone Chrome within seconds, and the other way round.
4. Turn on airplane mode, cold-start the app, start a timer and stop it. Turn airplane mode off: it syncs.

**Escalate** to **Opus, high effort** if the deep-link return or `exchangeCodeForSession` fails after two CI rounds.

---

## Phase P5: Native live notification plugin · **Sonnet, high effort** (escalate to Opus high after two failed device rounds)

### 7.1 Behaviour, the same as Carrel Live minus the bubble and the calendar
- A silent ongoing notification while a timer runs:
  - title = activity name; text = intention (note or block title)
  - a chronometer that counts **up** from the start, or **down** to `focusEndsAt` during a Pomodoro focus
  - colour = activity colour
  - subtext "N caught"
- When focus is due: title "Break due · <name>", phase "BREAK DUE", and the **Take break** button appears.
- On break: "☕ Break", "Back to <name>", counting up from the break start.
- **Vibration:** a gentle double pulse at `focusEndsAt`, and optionally at `breakEndsAt`. It respects DND and fires only once per deadline. Port `Alarms.kt` and `Nudges.kt` as they are.
- **Action buttons:**
  - **Urge**
  - **Drifted** → dialog 1 / 5 / 15 min
  - **Park** → inline reply
  - **Stop**, in the expanded view
  - **Take break**, in the expanded view, when due
- **Stop has a 10 s undo.** The notification flips to "Stopped · Undo" at once, and the server call is sent only after 10 s. Undo just cancels the queued op.
- **Tapping the notification** opens the app.

### 7.2 SQL timer verbs: `supabase/migrations/003_timer.sql` (show it, then apply)
Write these as plpgsql, `set search_path = ''`, owner `uid := public.carrel_uid()` with the same not-signed-in check as `doc_merge`. Grant execute to authenticated only.

**Helpers**
- `carrel_settings(uid) returns jsonb`: the data of `config/settings`.
- `carrel_iso(t timestamptz, tz text) returns text`: the local ISO with offset, like JS `isoLocal`:
  ```
  to_char(t at time zone tz, 'YYYY-MM-DD"T"HH24:MI:SS') || ±HH:MM
  ```
  The offset seconds are `extract(epoch from (t at time zone tz) - (t at time zone 'UTC'))`.
- `carrel_daykey(t timestamptz, tz text, day_start text) returns text`:
  ```
  to_char(((t at time zone tz) - (day_start || ':00')::interval)::date, 'YYYY-MM-DD')
  ```
  This matches `dayKeyOf` in `logic.js`.
- `tz = coalesce(settings->>'tz', 'Asia/Kolkata')`, `ds = coalesce(settings->>'dayStart', '04:00')`.
- New entry id: `'e_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)`.

**`carrel_stop(p_at timestamptz default now(), p_expect_id text default null, p_by text default 'app') returns jsonb`.** Mirrors `stopTimer` in app.js (~485).
1. Lock the timer: `select data … where path='state/current' for update`.
2. If not running, return `{"ok":false,"reason":"not_running"}`. If `p_expect_id` doesn't match `cur->>'id'`, return `{"ok":false,"reason":"stale"}`.
3. `s := (cur->>'start')::timestamptz; e := least(greatest(p_at, s), now())`.
4. If `e - s >= 15 s`: call `doc_merge('days/'||daykey(s), {"entries":{<cur.id>: entry}}, {"date": key}, p_by)`. The entry is built like `entryFromCur` (app.js 366):
   - `activity`, `start` (copied verbatim)
   - `end = carrel_iso(e)`
   - `note` (default `""`)
   - `focus: null`
   - `block` (or null)
   - `pomo = {phase: cur.pomo.phaseStart, target: cur.pomo.focus}` if `cur.pomo.phase = 'focus'`, else null.
5. Set the state to `{"running":false,"stopped":carrel_iso(e)}` (update the row, with `updated_by = p_by`).
6. Return `{"ok":true,"logged":<bool>,"state":<new>}`.

**`carrel_break(p_at default now(), p_expect_id default null, p_by default 'app') returns jsonb`.** Mirrors `takeBreak` + `startActivity` (app.js 450-521).
1. The break activity is the first item in `config/activities.items` with `role='break'` and not archived, else the id `break` if it exists, else return `{ok:false, reason:'no_break_activity'}`.
2. If not running → reason `not_running`. If running but stale → reason `stale`. If already on the break activity → reason `already`.
3. Take `now := least(p_at, now())` and `cs := start`. Then adjust:
   - if `at <= cs + 1 s` → `at := least(now(), cs + 1 s)`
   - if `at - cs < 15 s` → `at := cs` and **log no entry**
   - otherwise log the current entry ending at `at`, exactly as in stop.
4. Pomodoro: if `cur.pomo.phase = 'focus'`, then `pomo = cur.pomo || {phase:'break', phaseStart: carrel_iso(now), breakLen: (cycle % every = 0 ? long : short)}`. The defaults are cycle 1, every 4, long 15, short 5. Otherwise `pomo = null`.
5. The new state is:
   ```
   {running:true, id:new_id, activity:break_id, start:carrel_iso(at), note:'', block:null, pomo, ret:{activity:cur.activity, block:cur.block}, ack:null}
   ```
6. Return `{ok:true, state}`.

**`carrel_mark(p_type text, p_at timestamptz default now(), p_drift_min int default null, p_text text default null, p_by default 'native') returns jsonb`.**
- `p_type` must be one of `urge`, `drift`, `park`.
- It appends to `distractions/<daykey(p_at)>` with `doc_merge`, ensure `{date:key}`:
  ```
  items.<'d_'+random>: {type, at: carrel_iso(p_at), driftMin, text, activity: cur.activity if running else null,
  entry: cur.id if running else null, src:'phone', applied: (p_type <> 'drift')}
  ```
  `applied:false` means drift time hasn't yet been cut out of the log. The JS app does that in Phase F.

**Test with `execute_sql`, as a self-cleaning transaction:**
```
begin; select doc_set('state/current', …running fixture 20 min ago…); select carrel_stop(); select data from docs where path like 'days/%' order by updated_at desc limit 1; rollback;
```
Do the same for the break verb with a pomo fixture, and for stale ids.

### 7.3 Kotlin files: `android/app/src/main/java/app/carrel/study/live/`
Port from `carrel-live/app/src/main/java/app/carrel/live/` and change the package. Drop the calendar code, `TokenCodec`, the bubble, the `OwnershipStore` calendar parts and Compose. No new dependencies except `androidx.work:work-runtime-ktx`. JSON uses `org.json`, HTTP uses `HttpURLConnection`.

| File | Source / content |
|---|---|
| `Models.kt` | `Status`, `Activity`, `ReturnTo`, `Pomo`, `State` (+ `id: String?` = `state/current.id`, drop `url`), `MarkType`. From `core/Models.kt`. |
| `NotificationModel.kt` | Verbatim from `core/NotificationModel.kt`, plus `pulseDeadline`/`shouldPulse` from `core/Commands.kt`. |
| `Store.kt` | SharedPreferences `carrel_live`: config (`url`, `key`), session (`access`, `refresh`, `expiresAt`), current `State` JSON, prefs (`vibrateFocus` true, `vibrateBreak` false, `respectDnd` true, `privacy` false), `feedbackUntil`, op queue (JSON array), claimed pulses, per-`startedAt` tally. |
| `Api.kt` | `rpc(fn, json): JSONObject`: POST `{url}/rest/v1/rpc/{fn}` with headers `apikey`, `Authorization: Bearer <access>`, `Content-Type`. `ensureToken()`: if `expiresAt - 60 s < now`, POST `{url}/auth/v1/token?grant_type=refresh_token` `{refresh_token}` → store the new pair and emit a `session` event to JS (if the bridge is alive). `fetchState()`: GET `{url}/rest/v1/docs?select=path,data&path=in.(state/current,config/activities)`, mapped with `Map.kt`. 10 s timeouts. |
| `Map.kt` | A Kotlin port of `liveStateOf` (logic.js 541) from `state/current` + activities. Used after boot, after a stale reply, and in the periodic refresh. Add a unit test against a fixture that matches a JS output. |
| `Engine.kt` | Single-thread executor. `render()` comes from the old `Engine.render` minus the bubble: build the model → `Notifications.post` or `cancel`, and `Alarms.schedule`. `act(type, at, driftMin?, text?)`: (1) optimistic local state (stop → idle with an undo notification; break → local break state like `effectiveState` in `Commands.kt`; marks → feedback "Back to: …" for 8 s and tally+1); (2) enqueue op `{fn, args, notBefore}`, where stop's `notBefore = at + 10 s`; (3) `Flush.schedule()`. `undoStop()`: remove the queued stop and restore the previous state. `onReply(fn, json)`: `ok` → set state from `json.state` (map with `Map.kt`); `stale`/`not_running` → `fetchState()` and show "Timer changed elsewhere" as the notification text for 8 s. |
| `Flush.kt` | Runs due ops in order. A network failure keeps the op. A 4xx other than 401 drops it, with a warning. Scheduling: `Handler.postDelayed` for the fast path, plus a WorkManager `OneTimeWorkRequest` with a `CONNECTED` constraint and `initialDelay` = time to the next `notBefore`, unique name `carrel-flush`, `REPLACE`. |
| `Notifications.kt` | Port. Channel `carrel_live_silent_v1`, same layout. Remove the bubble toggle from `res/layout/notification_expanded.xml` (copy the layout and the drawables `ic_carrel`, `notification_chip`). Content intent → MainActivity. The undo notification keeps the same API. |
| `ActionReceiver.kt` | Port → `Engine.act(...)`. Actions: `carrel.URGE`, `carrel.PARK` (RemoteInput), `carrel.STOP`, `carrel.BREAK`, `carrel.UNDO`. |
| `DriftActivity.kt` | Rewrite **without Compose**: a translucent activity showing an `android.app.AlertDialog` with "Drifted for…" and buttons 1 / 5 / 15 min plus Cancel. Haptics off, as in the original. |
| `Alarms.kt`, `Nudges.kt` | Port. `claimPulse` → `Store`. `AlarmReceiver` re-renders from `Store` (no network) and then nudges. |
| `SystemReceiver.kt` | `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, `TIMEZONE_CHANGED` → `render()` from `Store`, then `fetchState()` if there's a session, and a flush. |
| `RefreshWorker.kt` | Periodic, 15 min, `CONNECTED`: `fetchState()` → `render()`. This catches timers that Claude or the web started or stopped while the app was closed. |
| `CarrelLivePlugin.kt` | `@CapacitorPlugin(name = "CarrelLive", permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])])`. Methods: `configure({url, key})`, `setSession({access, refresh, expiresAt})`, `getSession()`, `clearSession()` (also cancels the notification and clears the queue), `setState({state, id, tally?})` (a JSON object shaped like `liveStateOf` output plus `id`) → `Store` + `render`, `setPrefs({...})`, `openExactAlarmSettings()`, `openBatterySettings()` (from `ui/BatteryHelp.kt`), plus the standard `checkPermissions`/`requestPermissions`. Events: `action` `{type, ok, reason?}` and `session` `{access, refresh, expiresAt}`. Hold a static weak reference to the live plugin instance so `Engine` can emit events when the app is open. |
| `MainActivity` | `registerPlugin(CarrelLivePlugin::class.java)` **before** `super.onCreate`. The template MainActivity may be Java; edit it in Java if so. |

- **Manifest:**
  - permissions: `POST_NOTIFICATIONS`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`
  - `ActionReceiver`, `AlarmReceiver` and `SystemReceiver` (with the old intent filters), all `exported=false` except where the system needs them
  - `DriftActivity`, with a translucent theme copied from the old `styles.xml`
  - Keep `INTERNET`, which the template adds.
- **Kotlin in the app module:** if the template module is Java-only, enable Kotlin to match the template's AGP. With AGP ≥ 9, Kotlin is built in; otherwise apply `org.jetbrains.kotlin.android` at the version the root build already uses (or add it). Check the first CI error and adapt. If Kotlin setup fights for more than two rounds, **escalate** rather than rewriting in Java.

### 7.6 JS side: `native.js`
```js
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const CL = NATIVE ? Capacitor.registerPlugin('CarrelLive') : null;
```
- **On boot** (native): `CL.configure({url, key})`, then `requestPermissions()` once. Show a one-time Setup hint for exact alarms and battery, using the old `BatteryHelp` copy.
- **Session:**
  - After sign-in and on every `TOKEN_REFRESHED`, call `CL.setSession(...)`.
  - On resume (`App` `resume` event), call `CL.getSession()`. If its `expiresAt` is newer than sb's, call `sb.auth.setSession({access_token, refresh_token})`. This adopts a token that native refreshed while the app was closed.
  - Listen for `CL.addListener('session', ...)` and do the same.
- **`nativeSync()`**, called at the end of `changed()`:
  ```js
  st = liveStateOf(CUR, {rev: Date.now(), act, breakId: breakAct()?.id, blockTitle})
  ```
  Reuse `lvBlockTitle` from the deleted live.js: grab it from git history or rewrite it in 4 lines. Send `{state: st, id: CUR?.id || null}` only when `JSON.stringify` without `rev` changes.
- **`CL.addListener('action', ...)`** → refetch all listeners (the adapter exposes `db.refresh()`), and toast "From notification: stopped Chemistry" when the app is visible.
- **Export shim `DL.save({filename, data})`:**
  - web → Blob plus `<a download>`
  - native → `Filesystem.writeFile({path: filename, data, directory: 'CACHE', encoding: 'utf8'})`, then `Share.share({files: [uri]})`
- **Settings panel "Phone notification"** (native only):
  - toggles for vibrate at focus end, vibrate at break end, respect Do Not Disturb, and hide details on the lock screen → `CL.setPrefs`
  - a permission status line with fix buttons.

### P5 on the phone (use `carrel-live/docs/DEVICE_TESTS.md` as the checklist; adapt it)
1. Start a 25/5 Pomodoro in the app and lock the phone. The notification counts down; at 0 there's a gentle vibration and "Break due".
2. Tap **Take break**. Within seconds, phone Chrome shows Break running. The notification counts up as ☕ Break.
3. Tap Urge, then Drifted 5 min, then Park "buy milk". Then run `select data from docs where coll='distractions'` → 3 items.
4. Tap Stop, then Undo within 10 s → still running. Tap Stop again and wait 10 s → the entry is logged.
5. Swipe the app away from recents, then Stop from the notification → it's logged. Turn on airplane mode and tap Stop → it's logged after reconnecting.
6. From a claude.ai chat, run `select carrel_stop(p_by => 'claude')`. Within 15 min, or immediately on app open, the notification clears.

---

## Phase P6: Self-update · **Sonnet, medium effort**

1. **Install the updater.** Add `@capgo/capacitor-updater` (a scaffold-style one-off step, or in `android.yml` before `cap sync`; commit `package.json`). Set `capacitor.config.json` `plugins.CapacitorUpdater = {"autoUpdate": false}`. **First read its current README** with WebFetch on the npm or GitHub page, to confirm the manual-mode API: `notifyAppReady`, `download({url, version})`, `next({id})`/`set`, `current()`. Adapt names to what it documents.
2. **`web.yml` also publishes the bundle.** (Capgo 8.x refuses `download()` without `checksum` = lowercase SHA-256 hex of the zip; `latest.json` carries it.) It zips `www/` → `updates/web-<sha7>.zip` and writes `updates/latest.json` = `{"version":"<sha7>","url":"https://<owner>.github.io/<repo>/updates/web-<sha7>.zip","minNative":<lowest versionCode compatible>}`. Keep `minNative` in `web/config.js` as `NATIVE_API` and bump it whenever JS starts calling a new plugin method.
3. **App boot (native):**
   - Call `notifyAppReady()` first; otherwise Capgo rolls back after 10 s.
   - Then fetch `latest.json` with `cache: 'no-store'`, failing silently offline.
   - If the version differs from the current bundle and `App.getInfo().build >= minNative`, run `download` → `next`. It applies on the next launch, and a quiet toast says "Update ready. Reopen Carrel to apply."
4. **APK check:** once a day, GET `https://api.github.com/repos/<o>/<r>/releases/latest` and compare `tag` → versionCode. Prereleases can't be compared this way, so tag real releases. If newer, show a Setup banner "New app version" that opens the asset URL in the Browser.
5. **Fonts** (optional): CI downloads the three Google font woff2 files into `www/fonts/` and rewrites the `<link>` to a local `@font-face`.

**Phone check:** push a visible copy change. In the app, reopen twice → the change shows, with no reinstall.

---

## Later phases (separate sessions; plan briefly before starting each)

### Phase F: Distraction features · **Sonnet, medium effort**
Implements old `PLAN-carrel-live.md` Phase C, items 1–6, on the new data:
- Subscribe to `distractions` like `days` (where `date >= windowFrom`).
- A **Noticed** button and the `X` key on the timer card. Drift chips 1/5/15 → `w.update('distractions/<k>', …)` with `src:'page'`.
- A **"Back to:" re-entry card** for 8 s.
- A **parking lot**: a list on Today while on break, plus "→ backlog".
- **Patterns cards** (`patternsModel`): catch rate, drift time and the others listed there.
- **Apply phone drifts:** for items with `applied:false`, run the old `logDrift` logic (live.js 217-227, from git history), then set `applied:true` in the same commit. Apply once, on the device that sees them first. `doc_merge` is atomic, and re-applying is prevented by checking `applied`.
- Add a `distraction_items` view.
- Update the guide row.

### Phase G: Google Calendar busy time · **Opus, high effort** to design it, then **Sonnet, medium effort** to build it
The sketch to validate:
- Request the `calendar.readonly` scope with `access_type=offline`, `prompt=consent` on a separate "Connect calendar" action.
- Store `provider_refresh_token` in a private table `google_tokens` (RLS: own row; the app never reads it back).
- An Edge Function `gcal-busy` refreshes the Google access token, using the client secret held as an Edge secret, and returns events for a range. `gcal.js` then calls the function instead of MCP.
- The consent screen must be **published** (not Testing), or refresh tokens expire after 7 days.

### Phase H: Optional improvements · **Sonnet, medium effort** each
- Home-screen widget showing today's study total and the running timer.
- A quick-settings tile to start or stop the last activity.
- An FCM push, so chat-started timers update the notification instantly instead of within 15 min.
- CSV/JSON import (restore from backup).

---

## 11. Known unknowns. Resolve them in this order, and tell the user if one blocks
1. Whether the GitHub token can push `.github/workflows/*` (P0.2.3).
2. Whether `gh secret set` and the Pages API are permitted, or the user must do them by hand.
3. The Capacitor template's language (Java or Kotlin), its AGP version and its edge-to-edge behaviour (P4).
4. The `@capgo/capacitor-updater` manual-mode API names (P6).
5. Realtime delivery in a backgrounded WebView. This is expected to pause; the adapter refetches on resume, so nothing should be needed.
6. Whether the Supabase connector in claude.ai runs SQL as `postgres` (so `carrel_uid()` resolves through `carrel_owner`). Check in P3 step 6 with `select carrel_uid()`.

## 12. Progress log (update as you go)
- [x] P0 Setup
- [x] P1 Database
- [x] P2 Web on Supabase
- [x] P3 Migration + guide
- [x] P4 Capacitor APK
- [x] P5 Native notification
- [~] P6 Self-update (code pushed; needs the two-reopen phone check)
- Notes: P3 became "start clean, no migration". Focus-end buzz was not felt on the phone in build-4 (stronger alarm-usage buzz + Test buzz + "Last buzz" line added); parked by the user for later. 1/1 quick Pomodoro chip added for testing. Drifted/Take break/Stop-undo/offline-stop still unconfirmed on the phone.
