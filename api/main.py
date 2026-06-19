import logging
import os

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, Response

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

SUSURRO_KEYS = [k.strip() for k in os.getenv("SUSURRO_KEYS", "").split(",") if k.strip()]

app = FastAPI(title="Susurro Voice Gateway", version="1.0.0")


def require_susurro_key(authorization: str = Header(default="")) -> None:
    if not SUSURRO_KEYS:
        raise HTTPException(status_code=500, detail="SUSURRO_KEYS not configured")
    presented = authorization.removeprefix("Bearer ").removeprefix("bearer ").strip()
    if presented not in SUSURRO_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing Susurro key")


def require_azure() -> None:
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY:
        raise HTTPException(status_code=500, detail="Azure OpenAI not configured")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "live",
            "azure_endpoint_set": bool(AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY),
            "susurro_keys": len(SUSURRO_KEYS),
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


@app.post("/v1/stt", dependencies=[Depends(require_susurro_key)])
async def stt(request: Request, engine: str = "whisper", language: str | None = None) -> JSONResponse:
    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio body")
    content_type = request.headers.get("content-type", "audio/wav")

    if engine == "deepgram":
        if not DEEPGRAM_API_KEY:
            raise HTTPException(status_code=500, detail="Deepgram not configured")
        logger.info("stt.deepgram.start bytes=%d", len(audio))
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.deepgram.com/v1/listen",
                params={"model": "nova-2", "smart_format": "true", "punctuate": "true", "language": "es"},
                headers={"Authorization": f"Token {DEEPGRAM_API_KEY}", "Content-Type": content_type},
                content=audio,
            )
        logger.info("stt.deepgram.done status=%d", resp.status_code)
        resp.raise_for_status()
        data = resp.json()
        alt = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0]
        return JSONResponse({"success": True, "transcript": alt.get("transcript", ""), "engine": "deepgram-nova-2"})

    require_azure()
    filename = "audio.mp3" if "mp3" in content_type else "audio.wav"
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_WHISPER_DEPLOYMENT}/audio/transcriptions?api-version={AZURE_OPENAI_API_VERSION}"
    logger.info("stt.whisper.start bytes=%d lang=%s", len(audio), language or "auto")
    data = {"language": language} if language else None
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            headers={"api-key": AZURE_OPENAI_KEY},
            files={"file": (filename, audio, content_type)},
            data=data,
        )
    logger.info("stt.whisper.done status=%d", resp.status_code)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Azure whisper {resp.status_code}: {resp.text}")
    return JSONResponse({"success": True, "transcript": resp.json().get("text", ""), "engine": "azure-whisper"})


@app.post("/v1/tts", dependencies=[Depends(require_susurro_key)])
async def tts(request: Request) -> Response:
    require_azure()
    payload = await request.json()
    text = (payload.get("input") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'input' text")
    response_format = payload.get("format", "mp3")
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_TTS_DEPLOYMENT}/audio/speech?api-version={AZURE_OPENAI_API_VERSION}"
    logger.info("tts.start chars=%d voice=%s", len(text), payload.get("voice", AZURE_TTS_VOICE))
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            headers={"api-key": AZURE_OPENAI_KEY, "Content-Type": "application/json"},
            json={
                "model": AZURE_TTS_MODEL,
                "input": text,
                "voice": payload.get("voice", AZURE_TTS_VOICE),
                "response_format": response_format,
            },
        )
    logger.info("tts.done status=%d", resp.status_code)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Azure tts {resp.status_code}: {resp.text}")
    media_type = "audio/mpeg" if response_format == "mp3" else f"audio/{response_format}"
    return Response(content=resp.content, media_type=media_type)


@app.post("/v1/refine", dependencies=[Depends(require_susurro_key)])
async def refine(request: Request) -> JSONResponse:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Claude not configured")
    payload = await request.json()
    candidates = [payload.get("web_speech_text", ""), payload.get("deepgram_text", "")]
    prompt = (
        "Eres un corrector de transcripciones. Te doy variantes del mismo audio; "
        "devuelve SOLO la transcripción más fiel, sin comentarios.\n\n"
        + "\n".join(f"- {c}" for c in candidates if c)
    )
    logger.info("refine.start variants=%d", len([c for c in candidates if c]))
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
    logger.info("refine.done status=%d", resp.status_code)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Claude {resp.status_code}: {resp.text}")
    blocks = resp.json().get("content", [])
    refined = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
    return JSONResponse({"success": True, "refined": refined, "engine": ANTHROPIC_MODEL})
