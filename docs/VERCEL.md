# Deploy to Vercel

This app runs as a **serverless catch-all** via [`api/index.js`](../api/index.js) → [`server.js`](../server.js). All routes (`/`, `/health`, `/api/report/load`, `/public/*`) go through the same handler.

## Prerequisites

1. [Neon](https://neon.tech) or Vercel Postgres (connection string for `DATABASE_URL`)
2. Groq API key (room chatbot)
3. Vercel account (Hobby or Pro)

## Hobby plan timeout warning

`POST /api/report/load` can take **15–60 seconds** (Smartler fetch + aggregation). **Vercel Hobby limits functions to 10 seconds.** Large month loads may return **504 FUNCTION_INVOCATION_TIMEOUT**.

**If that happens:** upgrade to Vercel Pro and set `maxDuration: 60` in [`vercel.json`](../vercel.json), or host the API on a long-running Node server (Railway, Render, VPS).

---

## Environment variables (Production)

Replace `https://YOUR-APP.vercel.app` with your deployment URL.

### Required (auth enabled)

| Key | Value |
|-----|--------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST/DB?sslmode=require` |
| `DATABASE_SSL` | `true` |
| `COOKIE_SECURE` | `true` |
| `PORTAL_PUBLIC_URL` | `https://YOUR-APP.vercel.app/login` |

Do **not** set `AUTH_DISABLED`.

### AI — Groq (primary)

| Key | Value |
|-----|--------|
| `GROQ_API_KEY` | `gsk_...` |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `OPENAI_MODEL` | `llama-3.3-70b-versatile` |

### OpenRouter (fallback, recommended)

| Key | Value |
|-----|--------|
| `OPENROUTER_API_KEY` | your key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` |
| `OPENROUTER_HTTP_REFERER` | `https://YOUR-APP.vercel.app` |
| `OPENROUTER_APP_TITLE` | `ITCHL Analytics Portal` |

### Smartler (optional — defaults work)

| Key | Value |
|-----|--------|
| `SMARTLER_REPORT_API_URL` | `https://anlyeng.smartler.in/report/raw/download-fast` |
| `SMARTLER_GROUP` | `itc` |

### Do not set

- `PORT` (Vercel injects it)
- `AUTH_DISABLED`
- `SUPER_ADMIN_*` (bootstrap scripts only)

---

## Bootstrap database + super admin

Schema runs automatically on cold start (`db/migrate`). Create the first admin **once** from your machine:

```powershell
cd e:\usage_report
$env:DATABASE_URL="postgresql://..."
$env:DATABASE_SSL="true"
node scripts/setup-postgres.js
node scripts/create-super-admin.js admin@example.com "YourStrongPassword10+"
```

---

## Deploy

### GitHub (recommended)

1. Push `main` to GitHub
2. Vercel → New Project → Import repo
3. Add all env vars above → Deploy

### CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

---

## Verify

1. `GET https://YOUR-APP.vercel.app/health`  
   Expect: `"ok": true`, `"auth": "enabled"`, `"database": "configured"`
2. `GET https://YOUR-APP.vercel.app/public/itc-api-loader.js` → 200
3. Open `/login` → sign in → month load via `/api/report/load`

---

## Local development (unchanged)

```bash
node server.js
# → http://127.0.0.1:8000
```

Use `.env` from [`.env.example`](../.env.example).
