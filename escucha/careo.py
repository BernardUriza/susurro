"""Careo: dos motores de STT sobre el MISMO audio y un juez LLM cuando discrepan.
Una transcripción sola es un testigo; dos son un careo.

Los dos motores viven en el gateway (`/v1/stt?engine=whisper|deepgram`) y el juez es
`/v1/refine`. Los tres existen desde 2026-07; el careo se enciende solo cuando
`/health` reporta `deepgram`/`claude` configurados (medido 2026-10-27: ambos en
500 «not configured» hasta que Bernard ponga las llaves en el Container App).
Sin ellos esto degrada a una sola llamada a whisper, exactamente como antes."""
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher

try:
    from escucha.lexico import es_alucinacion, normalizar
    from escucha.instrumentacion import evento
except ModuleNotFoundError:
    from lexico import es_alucinacion, normalizar
    from instrumentacion import evento

GATEWAY = os.environ.get("SUSURRO_GATEWAY", "https://sus.bernarduriza.com")
# Debajo de esta similitud (0-1) los dos motores DISCREPAN y entra el juez
UMBRAL_ACUERDO = float(os.environ.get("CAREO_UMBRAL", "0.85"))
_capacidades = {}


def capacidades(refrescar=False):
    """{deepgram: bool, claude: bool} según `/health` del gateway. Cacheado; vacío
    hasta que alguien lo refresque (el calentador al arrancar), así los tests y la
    Mac no tocan la red."""
    if refrescar:
        try:
            with urllib.request.urlopen(f"{GATEWAY}/health", timeout=10) as r:
                h = json.load(r)
            _capacidades.update(deepgram=bool(h.get("deepgram")), claude=bool(h.get("claude")))
        except Exception:
            pass
    return dict(_capacidades)


def similitud(a, b):
    return SequenceMatcher(None, normalizar(a), normalizar(b)).ratio()


def discrepan(a, b):
    return similitud(a, b) < UMBRAL_ACUERDO


def refinar(candidatos, key, timeout=30):
    """POST /v1/refine con las variantes → (texto, causa)."""
    cuerpo = {"web_speech_text": candidatos[0], "deepgram_text": candidatos[1] if len(candidatos) > 1 else ""}
    try:
        req = urllib.request.Request(
            f"{GATEWAY}/v1/refine", data=json.dumps(cuerpo).encode(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(req, timeout=timeout)).get("refined", "").strip(), ""
    except Exception as e:
        return "", f"refine: {type(e).__name__}: {e}"


def transcribir_careo(path, language, fallos, stt, key="", segundo=None):
    """`stt(path, language[, engine=...])` → (texto, causa) es el motor del gateway.
    `segundo(path, language)` es el testigo alterno cuando el gateway no tiene
    deepgram (el tier local, si ya está cargado). → (texto, causa, veredicto).
    Veredictos: 'solo' (sin careo), 'acuerdo', 'juez' (refine decidió),
    'desacuerdo' (sin juez: gana el que no alucina), 'uno' (sólo uno contestó)."""
    caps = capacidades()
    if caps.get("deepgram"):
        testigo, nombre = (lambda p, l: stt(p, l, engine="deepgram")), "deepgram"
    elif segundo:
        testigo, nombre = segundo, "local"
    else:
        txt, causa = stt(path, language)
        return txt, causa, "solo"
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_w = pool.submit(stt, path, language)
        f_d = pool.submit(testigo, path, language)
        whisper, causa_w = f_w.result()
        deepgram, causa_d = f_d.result()
    if causa_d:
        fallos.avisar(f"stt-{nombre}", causa_d)
    if not whisper or not deepgram:
        txt = whisper or deepgram
        evento("stt.careo", veredicto="uno", whisper=whisper[:80], deepgram=deepgram[:80])
        return txt, "" if txt else (causa_w or causa_d), "uno"
    sim = similitud(whisper, deepgram)
    if sim >= UMBRAL_ACUERDO:
        evento("stt.careo", veredicto="acuerdo", similitud=round(sim, 2))
        return whisper, "", "acuerdo"
    if caps.get("claude") and key:
        refinado, causa_r = refinar([whisper, deepgram], key)
        if refinado:
            evento("stt.careo", veredicto="juez", similitud=round(sim, 2),
                   whisper=whisper[:80], deepgram=deepgram[:80], refinado=refinado[:80])
            return refinado, "", "juez"
        fallos.avisar("refine", causa_r)
    ganador = deepgram if es_alucinacion(whisper) and not es_alucinacion(deepgram) else whisper
    evento("stt.careo", veredicto="desacuerdo", similitud=round(sim, 2),
           whisper=whisper[:80], deepgram=deepgram[:80], ganador=ganador[:80])
    return ganador, "", "desacuerdo"
