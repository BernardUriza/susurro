import logging
import os
import secrets as secrets_mod
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("susurro.gateway")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_WHISPER_DEPLOYMENT = os.getenv("AZURE_WHISPER_DEPLOYMENT", "whisper")
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_TTS_DEPLOYMENT", "tts")
AZURE_TTS_MODEL = os.getenv("AZURE_TTS_MODEL", "tts-1")
AZURE_TTS_VOICE = os.getenv("AZURE_TTS_VOICE", "onyx")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
ONBOARDING_TOKEN = os.getenv("SUSURRO_ONBOARDING_TOKEN", "")
ONBOARDING_DAILY_LIMIT = int(os.getenv("ONBOARDING_DAILY_LIMIT", "50"))
BOOTSTRAP_KEYS = [k.strip() for k in os.getenv("SUSURRO_KEYS", "").split(",") if k.strip()]
TABLES_CONN = os.getenv("TABLES_CONN", "")

TTS_USD_PER_CHAR = 15.0 / 1_000_000
STT_USD_PER_REQUEST = 0.001
REFINE_USD_PER_REQUEST = 0.0005

app = FastAPI(title="Susurro Voice Gateway", version="2.0.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_keys_table = None
_usage_table = None


def _tables():
    global _keys_table, _usage_table
    if _keys_table is None and TABLES_CONN:
        from azure.data.tables import TableServiceClient

        svc = TableServiceClient.from_connection_string(TABLES_CONN)
        _keys_table = svc.get_table_client("keys")
        _usage_table = svc.get_table_client("usage")
    return _keys_table, _usage_table


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def get_key_record(token: str) -> dict | None:
    keys_table, _ = _tables()
    if keys_table is None:
        if token in BOOTSTRAP_KEYS:
            return {"RowKey": token, "name": "bootstrap", "kind": "project", "daily_limit": 0, "active": True}
        return None
    from azure.core.exceptions import ResourceNotFoundError

    try:
        ent = keys_table.get_entity("key", token)
        return dict(ent) if ent.get("active", True) else None
    except ResourceNotFoundError:
        return None


def count_today(key_id: str) -> int:
    _, usage_table = _tables()
    if usage_table is None:
        return 0
    rows = usage_table.query_entities(
        f"PartitionKey eq '{key_id}' and day eq '{_today()}'", select=["RowKey"]
    )
    return sum(1 for _ in rows)


def record_usage(key_id: str, endpoint: str, units: int, cost_usd: float) -> None:
    _, usage_table = _tables()
    if usage_table is None:
        return
    now = datetime.now(timezone.utc)
    usage_table.create_entity(
        {
            "PartitionKey": key_id,
            "RowKey": f"{now.isoformat()}-{uuid.uuid4().hex[:8]}",
            "day": now.strftime("%Y-%m-%d"),
            "endpoint": endpoint,
            "units": units,
            "cost_usd": cost_usd,
            "ts": now.isoformat(),
        }
    )


def gen_token() -> str:
    return "sk-susurro-" + secrets_mod.token_urlsafe(24)


@app.on_event("startup")
def bootstrap_keys() -> None:
    keys_table, _ = _tables()
    if keys_table is None:
        logger.warning("bootstrap.skip no TABLES_CONN — env-only key mode")
        return
    seeds = []
    if ONBOARDING_TOKEN:
        seeds.append((ONBOARDING_TOKEN, "public-onboarding", "onboarding", ONBOARDING_DAILY_LIMIT))
    for k in BOOTSTRAP_KEYS:
        seeds.append((k, "bootstrap", "project", 0))
    from azure.core.exceptions import ResourceExistsError

    for token, name, kind, limit in seeds:
        try:
            keys_table.create_entity(
                {
                    "PartitionKey": "key",
                    "RowKey": token,
                    "name": name,
                    "kind": kind,
                    "daily_limit": limit,
                    "active": True,
                    "created": _today(),
                }
            )
            logger.info("bootstrap.key.created name=%s kind=%s", name, kind)
        except ResourceExistsError:
            pass


def require_susurro_key(authorization: str = Header(default="")) -> dict:
    presented = authorization.removeprefix("Bearer ").removeprefix("bearer ").strip()
    if not presented:
        raise HTTPException(status_code=401, detail="Missing Susurro key")
    record = get_key_record(presented)
    if record is None:
        raise HTTPException(status_code=401, detail="Invalid or inactive Susurro key")
    limit = int(record.get("daily_limit", 0) or 0)
    if limit > 0 and count_today(record["RowKey"]) >= limit:
        raise HTTPException(status_code=429, detail=f"Daily limit reached ({limit} req/day for this key)")
    return record


def require_admin(authorization: str = Header(default="")) -> None:
    presented = authorization.removeprefix("Bearer ").removeprefix("bearer ").strip()
    if not ADMIN_TOKEN or presented != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Admin token required")


def require_azure() -> None:
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY:
        raise HTTPException(status_code=500, detail="Azure OpenAI not configured")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "live",
            "azure_endpoint_set": bool(AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY),
            "metering": bool(TABLES_CONN),
            "deepgram": bool(DEEPGRAM_API_KEY),
            "claude": bool(ANTHROPIC_API_KEY),
            "note": "liveness only; GET /ready proves the real Azure voice serving contract",
        }
    )


@app.get("/ready")
async def ready() -> JSONResponse:
    if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY):
        return JSONResponse(status_code=503, content={"ready": False, "reason": "Azure not configured"})
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_TTS_DEPLOYMENT}/audio/speech?api-version={AZURE_OPENAI_API_VERSION}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={"api-key": AZURE_OPENAI_KEY, "Content-Type": "application/json"},
                json={"model": AZURE_TTS_MODEL, "input": ".", "voice": AZURE_TTS_VOICE, "response_format": "mp3"},
            )
    except Exception as exc:
        return JSONResponse(status_code=503, content={"ready": False, "reason": str(exc)})
    ok = resp.status_code == 200 and len(resp.content) > 0
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"ready": ok, "tts_status": resp.status_code, "tts_bytes": len(resp.content)},
    )


@app.get("/v1/discovery")
async def discovery(request: Request) -> JSONResponse:
    base = str(request.base_url).rstrip("/").replace("http://", "https://")
    return JSONResponse(
        {
            "service": "Susurro Voice Gateway",
            "purpose": "Single self-owned STT/TTS provider. Call these instead of any vendor SDK.",
            "onboarding_token": ONBOARDING_TOKEN or None,
            "auth": "Send header: Authorization: Bearer <token>",
            "rate_limit": f"onboarding token: {ONBOARDING_DAILY_LIMIT} req/day. Ask the owner for an unlimited project key.",
            "endpoints": {
                "tts": {
                    "method": "POST",
                    "url": f"{base}/v1/tts",
                    "body": {"input": "text to speak", "voice": "onyx", "format": "mp3"},
                    "returns": "audio bytes (audio/mpeg)",
                    "curl": f'curl -X POST {base}/v1/tts -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{{"input":"hola"}}\' --output out.mp3',
                },
                "stt": {
                    "method": "POST",
                    "url": f"{base}/v1/stt?language=es",
                    "body": "raw audio bytes (Content-Type: audio/wav or audio/mpeg)",
                    "returns": {"transcript": "...", "engine": "azure-whisper"},
                    "curl": f'curl -X POST "{base}/v1/stt?language=es" -H "Authorization: Bearer $TOKEN" -H "Content-Type: audio/mpeg" --data-binary @audio.mp3',
                },
                "refine": {
                    "method": "POST",
                    "url": f"{base}/v1/refine",
                    "body": {"web_speech_text": "...", "deepgram_text": "..."},
                    "returns": {"refined": "best transcript"},
                },
            },
        }
    )


@app.post("/v1/stt")
async def stt(request: Request, key: dict = Depends(require_susurro_key), engine: str = "whisper", language: str | None = None) -> JSONResponse:
    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio body")
    content_type = request.headers.get("content-type", "audio/wav")

    if engine == "deepgram":
        if not DEEPGRAM_API_KEY:
            raise HTTPException(status_code=500, detail="Deepgram not configured")
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.deepgram.com/v1/listen",
                params={"model": "nova-2", "smart_format": "true", "punctuate": "true", "language": language or "es"},
                headers={"Authorization": f"Token {DEEPGRAM_API_KEY}", "Content-Type": content_type},
                content=audio,
            )
        resp.raise_for_status()
        data = resp.json()
        alt = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0]
        record_usage(key["RowKey"], "stt", len(audio), STT_USD_PER_REQUEST)
        return JSONResponse({"success": True, "transcript": alt.get("transcript", ""), "engine": "deepgram-nova-2"})

    require_azure()
    filename = "audio.mp3" if "mp3" in content_type else "audio.wav"
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_WHISPER_DEPLOYMENT}/audio/transcriptions?api-version={AZURE_OPENAI_API_VERSION}"
    data = {"language": language} if language else None
    logger.info("stt.whisper.start bytes=%d lang=%s key=%s", len(audio), language or "auto", key.get("name"))
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, headers={"api-key": AZURE_OPENAI_KEY}, files={"file": (filename, audio, content_type)}, data=data)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Azure whisper {resp.status_code}: {resp.text}")
    record_usage(key["RowKey"], "stt", len(audio), STT_USD_PER_REQUEST)
    return JSONResponse({"success": True, "transcript": resp.json().get("text", ""), "engine": "azure-whisper"})


@app.post("/v1/tts")
async def tts(request: Request, key: dict = Depends(require_susurro_key)) -> Response:
    require_azure()
    payload = await request.json()
    text = (payload.get("input") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'input' text")
    response_format = payload.get("format", "mp3")
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_TTS_DEPLOYMENT}/audio/speech?api-version={AZURE_OPENAI_API_VERSION}"
    logger.info("tts.start chars=%d voice=%s key=%s", len(text), payload.get("voice", AZURE_TTS_VOICE), key.get("name"))
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            headers={"api-key": AZURE_OPENAI_KEY, "Content-Type": "application/json"},
            json={"model": AZURE_TTS_MODEL, "input": text, "voice": payload.get("voice", AZURE_TTS_VOICE), "response_format": response_format},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Azure tts {resp.status_code}: {resp.text}")
    record_usage(key["RowKey"], "tts", len(text), len(text) * TTS_USD_PER_CHAR)
    media_type = "audio/mpeg" if response_format == "mp3" else f"audio/{response_format}"
    return Response(content=resp.content, media_type=media_type)


@app.post("/v1/refine")
async def refine(request: Request, key: dict = Depends(require_susurro_key)) -> JSONResponse:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Claude not configured")
    payload = await request.json()
    candidates = [payload.get("web_speech_text", ""), payload.get("deepgram_text", "")]
    prompt = (
        "Eres un corrector de transcripciones. Te doy variantes del mismo audio; "
        "devuelve SOLO la transcripción más fiel, sin comentarios.\n\n"
        + "\n".join(f"- {c}" for c in candidates if c)
    )
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={"model": ANTHROPIC_MODEL, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Claude {resp.status_code}: {resp.text}")
    blocks = resp.json().get("content", [])
    refined = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
    record_usage(key["RowKey"], "refine", len(prompt), REFINE_USD_PER_REQUEST)
    return JSONResponse({"success": True, "refined": refined, "engine": ANTHROPIC_MODEL})


@app.get("/admin/keys", dependencies=[Depends(require_admin)])
async def admin_list_keys() -> JSONResponse:
    keys_table, usage_table = _tables()
    if keys_table is None or usage_table is None:
        raise HTTPException(status_code=500, detail="Metering not configured")
    out = []
    for ent in keys_table.list_entities():
        kid = ent["RowKey"]
        today = count_today(kid)
        total_req = 0
        total_cost = 0.0
        for u in usage_table.query_entities(f"PartitionKey eq '{kid}'", select=["cost_usd"]):
            total_req += 1
            total_cost += float(u.get("cost_usd", 0))
        out.append(
            {
                "token": kid,
                "token_preview": kid[:14] + "…",
                "name": ent.get("name"),
                "kind": ent.get("kind"),
                "daily_limit": ent.get("daily_limit"),
                "active": ent.get("active"),
                "requests_today": today,
                "requests_total": total_req,
                "est_cost_usd_total": round(total_cost, 4),
            }
        )
    return JSONResponse({"keys": out})


@app.post("/admin/keys", dependencies=[Depends(require_admin)])
async def admin_create_key(request: Request) -> JSONResponse:
    keys_table, _ = _tables()
    if keys_table is None:
        raise HTTPException(status_code=500, detail="Metering not configured")
    body = await request.json()
    name = (body.get("name") or "project").strip()
    daily_limit = int(body.get("daily_limit", 0) or 0)
    token = gen_token()
    keys_table.create_entity(
        {"PartitionKey": "key", "RowKey": token, "name": name, "kind": "project", "daily_limit": daily_limit, "active": True, "created": _today()}
    )
    return JSONResponse({"token": token, "name": name, "daily_limit": daily_limit})


@app.post("/admin/keys/{token}/revoke", dependencies=[Depends(require_admin)])
async def admin_revoke_key(token: str) -> JSONResponse:
    from azure.core.exceptions import ResourceNotFoundError
    from azure.data.tables import UpdateMode

    keys_table, _ = _tables()
    if keys_table is None:
        raise HTTPException(status_code=500, detail="Metering not configured")
    try:
        ent = keys_table.get_entity("key", token)
    except ResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Key not found")
    ent["active"] = False
    keys_table.update_entity(ent, mode=UpdateMode.MERGE)
    return JSONResponse({"revoked": token[:14] + "…", "active": False})


@app.get("/{full_path:path}")
async def spa(full_path: str) -> FileResponse:
    candidate = os.path.normpath(os.path.join(STATIC_DIR, full_path))
    if full_path and candidate.startswith(STATIC_DIR) and os.path.isfile(candidate):
        immutable = full_path.startswith(("js/", "assets/", "wasm/"))
        cache = "public, max-age=31536000, immutable" if immutable else "no-cache"
        return FileResponse(candidate, headers={"Cache-Control": cache})
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    raise HTTPException(status_code=404, detail="Not found")
