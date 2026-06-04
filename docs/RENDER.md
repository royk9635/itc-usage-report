# Deploy to Render (free tier)

This app runs as a **long-lived Node web service** (`node server.js`), which avoids Vercel’s 10-second serverless timeout on `POST /api/report/load`.

## Prerequisites

1. [Render](https://render.com) account (free)
2. GitHub repo with this project (see below)
3. Optional: [Neon](https://neon.tech) free PostgreSQL for login/admin
4. Optional: [Groq](https://console.groq.com/) API key for the room chatbot

## Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**.
3. Connect GitHub and select the repository.
4. Render reads [`render.yaml`](../render.yaml) at the repo root.
5. When prompted, set secret env vars (`GROQ_API_KEY`, `DATABASE_URL`, etc.).
6. Deploy.

After deploy, open `https://YOUR-SERVICE.onrender.com/health` — expect `"ok": true`.

## Option B — API script

1. Create an API key: Render Dashboard → **Account Settings → API Keys**.
2. Run:

```bash
export RENDER_API_KEY=rnd_your_key_here
node scripts/deploy-to-render.js
```

The script creates a Blueprint linked to your GitHub repo (repo must already exist and be pushed).

## Option C — Manual web service

1. **New → Web Service** → connect GitHub repo.
2. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Plan:** Free
   - **Health check path:** `/health`
3. Add environment variables from [`.env.example`](../.env.example).

## Environment variables

### Minimum (report only, no login)

| Key | Value |
|-----|--------|
| `AUTH_DISABLED` | `true` |
| `COOKIE_SECURE` | `true` |

### Full app (login + admin) — Neon PostgreSQL

**Option 1 — Automated (Neon API key)**

1. Create an API key at [Neon Console → API Keys](https://console.neon.tech/app/settings/api-keys)
2. Run:

```bash
export NEON_API_KEY=neon_api_...
export RENDER_API_KEY=rnd_...
node scripts/setup-neon-render.js
```

This creates the Neon project, runs migrations, creates a Super Admin, updates Render env vars, and redeploys.

**Option 2 — Manual Neon connection string**

1. Create a project at [Neon Console](https://console.neon.tech)
2. Copy the **connection string** (use `usage_report` as database name, or `neondb`)
3. Run:

```bash
export DATABASE_URL="postgresql://...@...neon.tech/usage_report?sslmode=require"
export RENDER_API_KEY=rnd_...
export SUPER_ADMIN_EMAIL=admin@example.com
export SUPER_ADMIN_PASSWORD="YourStrongPassword10+"
node scripts/setup-neon-render.js
```

**After integration**

| Key | Value |
|-----|--------|
| `AUTH_DISABLED` | `false` |
| `DATABASE_URL` | Neon connection string |
| `DATABASE_SSL` | `true` |
| `COOKIE_SECURE` | `true` |
| `PORTAL_PUBLIC_URL` | `https://YOUR-SERVICE.onrender.com/login` |

Login at `/login` with the Super Admin credentials printed by the setup script.

## Free tier notes

- Service **sleeps after ~15 minutes** of inactivity; first request after sleep may take 30–60s.
- Use **Neon** for PostgreSQL (Render’s free Postgres expires after 90 days).
- Report loads can take **15–60 seconds** — Render free web services handle this; Vercel Hobby does not.

## Verify

```bash
curl https://YOUR-SERVICE.onrender.com/health
curl -X POST https://YOUR-SERVICE.onrender.com/api/report/load \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-04-01","endDate":"2026-04-07"}'
```

With auth enabled, include session cookie after login.
