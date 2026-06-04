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

### Full app (login + admin)

| Key | Value |
|-----|--------|
| `AUTH_DISABLED` | remove or set `false` |
| `DATABASE_URL` | Neon connection string with `?sslmode=require` |
| `DATABASE_SSL` | `true` |
| `COOKIE_SECURE` | `true` |
| `PORTAL_PUBLIC_URL` | `https://YOUR-SERVICE.onrender.com/login` |
| `GROQ_API_KEY` | `gsk_...` |

Bootstrap Super Admin (run locally once):

```bash
export DATABASE_URL="postgresql://..."
export DATABASE_SSL=true
node scripts/setup-postgres.js
node scripts/create-super-admin.js admin@example.com "YourStrongPassword10+"
```

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
