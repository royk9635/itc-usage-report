"""
ITC Guest Behaviour Report — Python web app (alternative to server.js).
Run: python app.py  →  http://127.0.0.1:8000
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).parent
PORT = int(os.getenv("PORT", "8000"))
SMARTLER_API_URL = os.getenv(
    "SMARTLER_REPORT_API_URL", "https://anlyeng.smartler.in/report/raw/download-fast"
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("ITC_OPENAI_API_KEY") or ""
OPENAI_BASE = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL = os.getenv("OPENAI_MODEL") or os.getenv("ITC_AI_MODEL") or "gpt-4o-mini"

try:
    from fastapi import FastAPI, Request
    from fastapi.responses import FileResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    import httpx
except ImportError as e:
    raise SystemExit(
        "Missing dependencies. Install with:\n  pip install -r requirements.txt"
    ) from e

app = FastAPI(title="ITC Usage Report")


def fmt_num(n) -> str:
    try:
        x = float(n)
    except (TypeError, ValueError):
        return "0"
    return f"{x:,.1f}".rstrip("0").rstrip(".") if x % 1 else f"{int(x):,}"


def extract_context_json(raw: str):
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None


def build_local_insight(messages: list) -> str:
    user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    raw = str((user or {}).get("content") or "").strip()
    ctx = extract_context_json(raw)
    if not ctx:
        return (
            "**Local insight mode** (no OpenAI API key configured).\n\n"
            "Add `OPENAI_API_KEY` to `.env` and restart for full AI answers.\n\n"
            "Charts, compare, and rule-based summaries still work."
        )
    sel = ctx.get("selection") or {}
    totals = ctx.get("totals") or {}
    site = sel.get("site") or sel.get("siteId") or "the selected site"
    room = sel.get("room") or "the selected room"
    lines = [
        f"**Room insight** — {room} @ {site}",
        f"Period: {sel.get('startDate', '—')} to {sel.get('endDate', '—')}",
        "",
        f"- **Total viewing:** {fmt_num(totals.get('totalViewingMinutes'))} minutes across {fmt_num(totals.get('activeDays'))} active day(s)",
        f"- **Events / sessions:** {fmt_num(totals.get('totalEventsOrSessions'))}",
    ]
    if totals.get("peakDate"):
        lines.append(f"- **Peak day:** {totals['peakDate']} ({fmt_num(totals.get('peakCount'))} events)")
    by_cat = ctx.get("byCategory") or []
    if by_cat:
        lines.append("", "**By category:**")
        for row in sorted(by_cat, key=lambda r: -(r.get("durationMinutes") or 0))[:6]:
            if not row.get("count") and not row.get("durationMinutes"):
                continue
            lines.append(
                f"- **{row.get('category', '—')}:** {fmt_num(row.get('durationMinutes'))} min, {fmt_num(row.get('count'))} events"
            )
    top = ctx.get("topItems") or []
    if top:
        lines.append("", "**Top items:**")
        for item in top[:5]:
            name = item.get("name") or item.get("label") or "—"
            val = item.get("minutes") or item.get("count") or 0
            lines.append(f"- {name}: {fmt_num(val)}")
    lines.append(
        "\n_Generated in local mode. Set `OPENAI_API_KEY` in `.env` for richer analysis._"
    )
    return "\n".join(lines)


def resolve_upstream_model(requested) -> str:
    m = str(requested or "").strip()
    if not m or m == "local-report-insight" or m.lower().startswith("local-"):
        return OPENAI_MODEL
    return m


@app.get("/health")
def health():
    return {
        "ok": True,
        "ai": "openai" if OPENAI_API_KEY else "local",
        "port": PORT,
        "model": OPENAI_MODEL,
        "reportApi": "/api/report/load",
        "dataSource": SMARTLER_API_URL,
    }


@app.post("/api/report/load")
async def report_load(request: Request):
    """Proxy + aggregate ITC raw report (same as server.js)."""
    import subprocess

    body = await request.json()
    start = str(body.get("startDate") or "").strip()
    end = str(body.get("endDate") or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end):
        return JSONResponse({"error": "startDate and endDate must be YYYY-MM-DD"}, status_code=400)
    if start > end:
        return JSONResponse({"error": "startDate must be on or before endDate"}, status_code=400)

    cli = ROOT / "scripts" / "load-report-cli.js"
    if not cli.is_file():
        return JSONResponse({"error": "load-report-cli.js missing"}, status_code=500)

    payload = json.dumps({"startDate": start, "endDate": end})
    try:
        proc = subprocess.run(
            ["node", str(cli), payload],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except FileNotFoundError:
        return JSONResponse(
            {"error": "Node.js is required for live report data. Run: node server.js"},
            status_code=500,
        )
    except subprocess.TimeoutExpired:
        return JSONResponse({"error": "Report load timed out (try a shorter date range)"}, status_code=504)

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "Report API failed").strip()
        return JSONResponse({"error": err}, status_code=502)

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid report JSON from loader"}, status_code=502)


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    auth = request.headers.get("authorization") or ""
    bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    api_key = bearer or OPENAI_API_KEY

    if api_key:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OPENAI_BASE}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": resolve_upstream_model(body.get("model")),
                    "temperature": body.get("temperature", 0.2),
                    "messages": body.get("messages") or [],
                },
            )
        return JSONResponse(content=r.json(), status_code=r.status_code)

    content = build_local_insight(body.get("messages") or [])
    return {
        "id": "local-report-insight",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
    }


@app.get("/")
def index():
    p = ROOT / "index.html"
    if not p.is_file():
        return JSONResponse({"error": "index.html not found"}, status_code=404)
    return FileResponse(p)


public_dir = ROOT / "public"
if public_dir.is_dir():
    app.mount("/public", StaticFiles(directory=public_dir), name="public")
assets_dir = ROOT / "public" / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
elif (ROOT / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=ROOT / "assets"), name="assets_legacy")


if __name__ == "__main__":
    import uvicorn

    print(f"\n  ITC Guest Behaviour Report\n  → http://127.0.0.1:{PORT}\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
