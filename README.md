# ITC Guest Behaviour Report — Web App

Interactive usage analytics for ITC hotels: summary dashboards, site comparison, room drill-down, and an AI-assisted room chatbot.

## Quick start (Node.js — recommended)

Install dependencies, configure `.env`, then start the server:

```bash
npm install
npm start
```

Open **http://127.0.0.1:8000** in Chrome, Edge, or Safari.

## Live data (Smartler API)

The app loads ITC usage data from the Smartler API (no embedded `raw_report_*.json` required):

- **Upstream:** `POST https://anlyeng.smartler.in/report/raw/download-fast` with body `{ "group": "itc", "hubRegistrationId": [], "startDate", "endDate" }` (GET is not supported).
- **Local proxy:** `POST /api/report/load` on this server (avoids browser CORS, runs aggregation server-side).
- **Month dropdown:** current month plus the previous 6 months (7 options). Current month uses **today** in **Asia/Kolkata** as `endDate`.
- **Day-on-Day:** checkbox + start/end date pickers; sends the selected date range as `startDate` and `endDate`.

Run `node scripts/enable-api-mode.js` after restoring an old HTML export if embedded JSON was reintroduced.

## Report caching

To speed up switching between months, the server and browser cache aggregated report data by date range (`startDate` + `endDate`):

| Layer | Behavior |
|-------|----------|
| **Browser (session)** | Revisiting a month in the same tab is instant (no new network request). |
| **Browser (processed, past months)** | After a past month loads once, the full processed bundle (`reports`, `enhanced`, `rawDaily`) is saved in `sessionStorage` so charts can render instantly on refresh. |
| **Server (memory)** | Shared across users; stores the same processed bundle after aggregation (skips Smartler on cache hit). |

**Expiry rules:**

- **Current calendar month** — not cleared by time (stays until Retry, LRU limit, or server restart).
- **Past months** — auto-expire after **10 days** (configurable via `REPORT_CACHE_TTL_PAST_MS` in `.env`).
- **New day on current month** — `endDate` changes to today, so one fresh fetch runs automatically.

Use **Retry loading data** on the dashboard to force a fresh load from Smartler for the selected period.

Configure in `.env`: `REPORT_CACHE_ENABLED`, `REPORT_CACHE_MAX_ENTRIES`, `REPORT_CACHE_TTL_PAST_MS`. See `GET /health` for `reportCache` stats.

## Alternative: Python

```bash
pip install -r requirements.txt
python app.py
```

Same URL: **http://127.0.0.1:8000**

## Why run as a web app?

Opening `index.html` directly (`file://`) disables the chatbot AI endpoint and some browser APIs. The included server:

- Serves the report over **http://**
- Provides **`POST /api/chat`** for the Room chatbot (local insight mode, or OpenAI when configured)
- Provides **`POST /api/report/load`** to fetch and aggregate live ITC raw report data
- Exposes **`GET /health`** for a quick status check

## AI chatbot (optional)

### Groq (free tier — recommended)

1. Sign up at [Groq Console](https://console.groq.com/) and create an API key (`gsk_...`).
2. Copy `.env.example` to `.env` and set:

   ```
   GROQ_API_KEY=gsk_your_key_here
   OPENAI_BASE_URL=https://api.groq.com/openai/v1
   OPENAI_MODEL=llama-3.3-70b-versatile
   ```

3. Run `node server.js` — console should show `AI: OpenAI (llama-3.3-70b-versatile)`.
4. Open **http://127.0.0.1:8000** → **Room chatbot** → **Check AI**, then ask a room question.

### OpenAI or other providers

Same `.env` file; set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` for your provider.

Without a key, the server returns **local insight** summaries built from the room data you select (still useful for operations review).

## Dashboard (MSR-style portal)

The report opens as an **admin dashboard** with:

- **Left sidebar** — Overview, report sections, brand segments (All / ITC / Sheraton / Storii / Welcomhotel), dynamic site list, export & tools
- **Top header** — Month, site, and view controls
- **Summary strip** — Current month, brand, site, and view at a glance

Use the sidebar or the **View** dropdown: Summary report · Compare sites · Room chatbot.

## Views

| View | Description |
|------|-------------|
| **Summary report** | KPIs, weekday/weekend, OTT/DTH/casting, trends |
| **Compare between sites** | Pick up to 4 sites (first four auto-selected), charts, and a **15-section executive briefing** for management |
| **Room chatbot** | Natural-language Q&A on the full report (sites, mobile, DTH, trends) or room drill-down |

**Sidebar — Room-wise activity analysis** scrolls to room drill-down (loaded with the same API range).

**Compare Sites** includes a printable **Site comparison — executive briefing** (KPIs, weekday/weekend, mix, OTT/DTH/Casting, CMS, Smartler where available). Uses dashboard data only; no IRD revenue.

## Project layout

| File | Purpose |
|------|---------|
| `index.html` | Full report UI + embedded April 2026 data |
| `server.js` | Node.js web server (no npm install required) |
| `app.py` | Python/FastAPI alternative server |
| `raw_report_*.json` | MSR raw exports — processed by the build pipeline (not read in the browser) |
| `scripts/raw-to-report/` | **Raw → report pipeline** — aggregates logs and rebuilds `index.html` |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Server port |
| `OPENAI_API_KEY` | — | Enables full AI via OpenAI-compatible API |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API base URL |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name |
| `DATABASE_URL` | — | PostgreSQL connection string for login, roles, sessions, and audits |
| `COOKIE_SECURE` | `false` | Set to `true` only behind HTTPS |
| `SESSION_COOKIE_NAME` | `itc_session` | HTTP-only auth cookie name |
| `SESSION_TTL_DAYS` | `7` | Session lifetime |
| `PORTAL_PUBLIC_URL` | `http://127.0.0.1:8000/login` | Login URL included in new-user access emails |
| `SMTP_HOST` | — | SMTP server host for sending new-user access emails |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use `true` for SMTPS/465 |
| `SMTP_USER` | — | SMTP username, if required |
| `SMTP_PASS` | — | SMTP password/app password, if required |
| `SMTP_FROM` | — | From address for portal emails |

## Authentication and access control

The dashboard supports PostgreSQL-backed login and role-based access:

- `SUPER_ADMIN`: all reports/sites, user management, site access management, login/admin audit APIs.
- `ADMIN`: all report data/sites, can manage site-level users and site access, cannot manage Super Admin users.
- `SITE_USER`: can only access assigned sites; Compare Sites is hidden and backend report data is filtered.

When an Admin or Super Admin creates a user, the portal sends a welcome email with the login email, temporary password, role, site access, and portal URL. Configure the SMTP variables in `.env`; if SMTP is missing or fails, the user is still created and the admin page shows the email error.

Super Admin Audits include login history, admin changes, focused activity tracking, per-person day-on-day usage, and overall portal usage totals.

Setup:

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
   - No-password local format: `postgres://postgres@localhost:5432/usage_report`
   - Password local format: `postgres://postgres:your_password@localhost:5432/usage_report`
3. Install dependencies and start the server:

   ```bash
   npm install
   node server.js
   ```

4. Create the first Super Admin:

   ```bash
   node scripts/create-super-admin.js admin@example.com "StrongPassword123"
   ```

5. Open `http://127.0.0.1:8000/login`.

The server runs `db/schema.sql` automatically on startup when `DATABASE_URL` is configured.

## Rebuild report from raw MSR exports

When you receive new `raw_report_*.json` files (same format as the April exports):

1. Copy them into the project folder (e.g. `raw_report_2026-05-01_to_2026-05-31.json`).
2. Run the pipeline (embeds fresh data into `index.html`):

```bash
node scripts/raw-to-report/build-from-raw.js
```

Or double-click **`build.bat`** — it auto-runs the pipeline when `raw_report_*.json` files are present, then validates and syncs the export HTML.

**What the pipeline does**

- Reads all `raw_report_*.json` in the project root (or pass explicit paths).
- Aggregates TV app/channel streams, casting, Smartler, mobile usage, and occupancy.
- Rebuilds `reportData`, `reportRawDaily`, and `reportEnhancedDataGzip` inside `index.html`.
- Applies the same rules as the dashboard: one guest per occupied room-day, DTH from `TV_CHANNEL_STREAM` only, Guest Message excluded from mobile charts.

**Optional flags**

```bash
node scripts/raw-to-report/build-from-raw.js path/to/raw1.json path/to/raw2.json
node scripts/raw-to-report/build-from-raw.js --html index.html --raw-dir .
```

After rebuilding: `node server.js` → hard refresh (**Ctrl+Shift+R**).

## Development

```bash
node validate.js              # syntax-check index.html scripts
node validate.js other.html   # check another HTML file
node fix_compare_chat_views.js index.html   # repair Compare/Chat views
node scripts/sync-app.js      # copy index.html → chatbot export filename
node scripts/finish-all.js    # validate + sync export + sanity checks
```

## Windows quick start

Double-click **`start.bat`** — starts the server and keeps the window open if it errors.

## Files you use day to day

| Action | File |
|--------|------|
| Run the app | `start.bat` or `node server.js` |
| Main UI | `index.html` |
| Share offline copy | `ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html` (sync from index) |
