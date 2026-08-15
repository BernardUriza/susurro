#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# LÉXICO — la capa de precisión del motor de escucha. Stdlib puro.
#
# Tres cosas, y sólo tres:
#   1. ALUCINACIONES — el corpus VERIFICADO de basura que Whisper escupe sobre
#      audio SIN habla (música, ruido de bar, silencio). Cada familia trae la
#      URL de donde se verificó; lo que no se pudo verificar NO entró.
#   2. CORRECCIONES  — errores de palabra REALES observados en las sesiones de
#      Bernard. Cada uno documenta su criterio y su riesgo. Nada se cambia en
#      silencio: `corregir()` devuelve la lista de cambios para que sea
#      auditable.
#   3. LEXICO_DOMINIO — el vocabulario que el ticker destroza, exportable como
#      hint/initial_prompt para el tier que lo soporte.
#
# POR QUÉ EXISTE (2026-08-15): sobre 10 videos de puro bafle, el tier gateway
# (`engine: azure-whisper`, confirmado en /v1/discovery) devolvió
# «¡Suscríbete al canal!» ×10 y «Gracias por ver el video». El
# `es_alucinacion()` que vivía en motor.py era una tupla de 7 substrings y no
# atrapaba ninguna de las dos.
#
# EL PRINCIPIO QUE GOBIERNA TODO ESTE ARCHIVO: es preferible dejar pasar una
# alucinación que matar habla legítima. Un falso positivo BORRA lo que Bernard
# dijo; un falso negativo sólo ensucia el transcript. Por eso los patrones
# dudosos viven en tiers opcionales apagados por default.
# ─────────────────────────────────────────────────────────────────────────────
import re
import time
import unicodedata
from collections import namedtuple

# ═════════════════════════════════════════════════════════════════════════════
# NORMALIZACIÓN
# ═════════════════════════════════════════════════════════════════════════════


# La ñ se blinda antes de NFD: la descomposición la parte en «n» + tilde
# combinante y el filtro de acentos la dejaría en «n», convirtiendo «año» en
# «ano» y «Sinfín» en un vecino equivocado. Se sustituye por un centinela que
# no existe en texto real y se restaura al final.
_CENTINELA_ENE = "\x00"


try:
    from escucha.instrumentacion import evento
except ModuleNotFoundError:
    try:
        from instrumentacion import evento
    except ModuleNotFoundError:            # el módulo es opcional: medir no rompe
        def evento(*_a, **_k):
            return False


def sin_acentos(texto):
    """Quita tildes y diacríticos PERO conserva la ñ y toda la puntuación.

    Es el paso que necesitan los patrones que sí dependen de los signos —
    p.ej. las etiquetas de sonido «[Música]» / «(Aplausos)».
    """
    if not texto:
        return ""
    protegido = texto.replace("ñ", _CENTINELA_ENE).replace("Ñ", _CENTINELA_ENE.upper())
    plano = "".join(
        c for c in unicodedata.normalize("NFD", protegido)
        if unicodedata.category(c) != "Mn")
    return plano.replace(_CENTINELA_ENE, "ñ").replace(_CENTINELA_ENE.upper(), "Ñ")


def normalizar(texto):
    """Baja a la forma canónica de comparación: sin acentos, minúsculas, sin
    puntuación, espacios colapsados.

    Es lo que hace que «¡Suscríbete al canal!» y «suscribete al canal» sean el
    mismo string. Los patrones de ALUCINACIONES se escriben SIEMPRE contra esta
    forma — o sea, sin acentos y en minúsculas.
    """
    if not texto:
        return ""
    solo_alnum = re.sub(r"[^0-9a-zA-ZñÑ ]+", " ", sin_acentos(texto))
    return re.sub(r"\s+", " ", solo_alnum).strip().lower()


# ═════════════════════════════════════════════════════════════════════════════
# 1. ALUCINACIONES — corpus verificado
# ═════════════════════════════════════════════════════════════════════════════
#
# FUENTES PRIMARIAS (consultadas y leídas 2026-08-15, no de memoria):
#
#   [F1] openai/whisper — discussion #928 «Hallucination on silence»
#        https://github.com/openai/whisper/discussions/928
#        El hilo raíz del fenómeno. De ahí salen verbatim: « www.mooji.org»,
#        « Thank you for watching», « Thanks for watching!»,
#        «Transcribed by https://otter.ai»,
#        « Subtítulos realizados por la comunidad de Amara.org»,
#        « www.alimmenta.com», y las familias Amara de fr/de/nl/pt/it.
#
#   [F2] openai/whisper — discussion #2608
#        https://github.com/openai/whisper/discussions/2608
#        Explica la CAUSA: el training incluyó YouTube con subtítulos, y los
#        créditos del traductor caen justo sobre silencio/música/créditos. De
#        ahí la familia «like and subscribe» (ro: «nu uitati sa da-ti like si
#        subscribe», de: «Untertitelung des ZDF für funk, 2017»).
#
#   [F3] HuggingFace dataset `sachaarbonel/whisper-hallucinations` (MIT)
#        https://huggingface.co/datasets/sachaarbonel/whisper-hallucinations
#        7,889 filas construidas corriendo Whisper sobre un corpus SÓLO-RUIDO y
#        recolectando toda salida no vacía. Es la corroboración EMPÍRICA de lo
#        que Bernard observó: contiene literalmente «suscríbete al canal»,
#        «gracias por ver el video», «gracias por ver el vídeo»,
#        «no olvides suscribirte», «dale like y suscríbete»,
#        «gracias por ver el vídeo suscríbete al canal».
#        Copia navegable: amicalhq/amical `hallucination-phrases.ts` (7422).
#
#   [F4] Listas curadas independientes que coinciden entre sí (triangulación):
#        JSchmie/ScrAIbe `scraibe/hallucinations.py`
#        machinelearningZH/audio-transcription `data/const.py`
#        DCC-BS/bentoml-faster-whisper `utils/hallucinations.py`
#        Las tres traen el bloque «es» idéntico: las 7 variantes de Amara en
#        español, « www.mooji.org» y « ...Más información www.alimmenta.com».
#
#   [F5] Observación de primera mano (Art. 2), 2026-08-15: 10 videos de puro
#        bafle → «¡Suscríbete al canal!» ×10 y «Gracias por ver el video».
#        Es la evidencia más fuerte que existe para ESTA máquina y ESTE
#        gateway; F3 la confirma como fenómeno general.
#
# DESCARTADAS POR NO VERIFICABLES (no entran, por regla):
#   · «Un poquito más.»  — sólo aparece en un repo suelto (raul2222/ears_Aztec),
#     sin respaldo en F1/F2/F3. Y es habla perfectamente legítima.
#   · «¿Estás ahí?»      — idem (JoaquinCar/E.V.), y matarla borraría una
#     pregunta real que Bernard hace seguido por teléfono.
#   · «Jackie»           — Bernard lo observó (F5) pero NO está en F3 y es un
#     nombre propio; va al tier DÉBIL, apagado por default.

ALUCINACIONES = (
    # ── Créditos de subtítulos (la familia más documentada de todas) ─────────
    # [F1][F4] «Subtítulos realizados/creados/hechos por la comunidad de
    # Amara.org», y sus 8 hermanas en fr/de/nl/pt/it/pl/hu/zh. El dominio solo
    # ya identifica la familia entera sin importar el idioma.
    r"\bamara\s*\.?\s*org\b",
    # [F1][F4] La misma familia sin la marca: «Subtitulado por la comunidad»,
    # «Subtítulos por la comunidad», «Subtitles by the ... community».
    r"\bsubtitul[oa]s?\b.{0,40}\b(por|de|realizados?|creados?|hechos?|community|comunidad)\b",
    r"\bsubtitles by\b",
    # [F1] Créditos de servicios de transcripción.
    r"\btranscribed by\b",
    r"\botter\s*\.?\s*ai\b",

    # ── Outro de YouTube en ESPAÑOL — lo que Bernard vio [F5], confirmado [F3]
    # F3 trae: «suscríbete al canal», «suscríbete a mi canal», «suscribete»,
    # «no olvides suscribirte», «no olviden suscribirse»,
    # «dale like y suscríbete», «críbete al canal» (recorte de Whisper).
    r"\bsuscri(b|v)",              # suscríbete / suscribete / suscribirte / suscribirse
    r"\bcribete al canal\b",       # [F3] el recorte literal que produce Whisper
    # F3: «gracias por ver», «gracias por ver el video/vídeo/este video»,
    # «muchas gracias por ver». La cola « el video» es opcional a propósito:
    # el corte de Whisper varía. «gracias por ver» aislado NO es habla normal.
    r"\bgracias por ver\b",
    r"\bdale like\b",
    r"\bdale me gusta\b",
    r"\bnos vemos en el proximo\b",
    r"\bhasta la proxima\b.{0,20}\bvideo\b",

    # ── Outro de YouTube en INGLÉS [F1][F2][F3] ──────────────────────────────
    r"\bthanks? (you )?for watching\b",
    r"\bplease subscribe\b",
    r"\b(subscribe to|don t forget to subscribe)\b",
    r"\bsee you in the next video\b",
    r"\blike and subscribe\b",

    # ── Dominios que Whisper escupe sobre silencio [F1][F4] ──────────────────
    r"\bmooji\s*\.?\s*org\b",
    r"\balimmenta\s*\.?\s*com\b",

    # ── Marcadores de música/aplauso: NO son habla, son etiquetas ────────────
    # Se comparan contra el texto CRUDO (ver es_alucinacion), porque normalizar
    # se come el «♪» y los corchetes.
)

# Marcadores no-alfabéticos: se buscan en el texto crudo, antes de normalizar.
ALUCINACIONES_CRUDAS = ("♪", "♫", "🎵", "🎶")

# Etiquetas de sonido entre corchetes/paréntesis que Whisper emite sobre
# música y ruido: [Music] [Música] (Applause) [Aplausos] [BLANK_AUDIO].
ETIQUETA_SONIDO = re.compile(
    r"^\s*[\[\(]\s*(music|musica|applause|aplausos?|silence|silencio|blank[_ ]audio|"
    r"sonido|noise|ruido|risas|laughter)[^\]\)]*[\]\)]\s*$", re.I)

# ── Tier DÉBIL: apagado por default (es_alucinacion(..., estricto=True)) ─────
# Frases que SÍ están en el corpus [F3] pero que también son habla legítima
# perfectamente normal en una sesión de dictado. Matarlas por default violaría
# el principio de este archivo (mejor dejar pasar basura que borrar a Bernard).
# Se comparan por IGUALDAD EXACTA del utterance normalizado completo, nunca por
# substring.
ALUCINACIONES_DEBILES = frozenset({
    "gracias",              # [F3] fila propia del dataset — y a la vez, español
    "muchas gracias",       # [F3]
    "thank you",            # [F3]
    "thanks",               # [F3]
    "you",                  # [F3] el hallucination #1 de Whisper en inglés
    "bye",                  # [F3]
    "bye bye",              # [F3]
    "music",                # [F3]
    "applause",             # [F3]
    "jackie",               # [F5] observado hoy sobre ruido; sin respaldo en F3
})

_RX_ALUCINACION = tuple(re.compile(p) for p in ALUCINACIONES)

# Mínimo de palabras y de repeticiones para llamarle bucle. Por debajo de esto
# «sí sí sí sí» (habla real, enfática) quedaría atrapado.
BUCLE_MIN_PALABRAS = 8
BUCLE_MIN_REPETICIONES = 4
BUCLE_COBERTURA_MIN = 0.75


def es_bucle_repetido(texto):
    """¿El texto es un bucle degenerado de Whisper?

    El decoder autoregresivo se atora y repite una frase corta hasta llenar la
    ventana. Hoy (2026-08-15) salió «the next day the next day the next day…».
    Es un fenómeno ESTRUCTURAL, no una frase de lista: se detecta por forma.
    Causa documentada junto con las alucinaciones sobre silencio [F1].

    Criterio (deliberadamente estrecho): una frase de 1 a 4 palabras que se
    repite ≥4 veces consecutivas y cubre ≥75% del utterance, con ≥8 palabras en
    total. Así «sí sí sí sí» (4 palabras) o «no, no, no» NO se marcan.
    """
    palabras = normalizar(texto).split()
    if len(palabras) < BUCLE_MIN_PALABRAS:
        return False
    for largo in range(1, 5):
        frase = palabras[:largo]
        repeticiones = 0
        i = 0
        while palabras[i:i + largo] == frase:
            repeticiones += 1
            i += largo
        if repeticiones >= BUCLE_MIN_REPETICIONES and i / len(palabras) >= BUCLE_COBERTURA_MIN:
            return True
    return False


def es_alucinacion(texto, estricto=False):
    """¿Este transcript es basura que el modelo inventó sobre audio sin habla?

    Sustituye a la versión de motor.py, que era una tupla de 7 substrings sin
    normalizar y dejaba pasar «¡Suscríbete al canal!» — el fallo de hoy.

    Args:
        texto: el transcript crudo tal como lo devolvió el tier.
        estricto: además del corpus duro, mata las frases del tier DÉBIL
            («gracias», «you», «bye»…) por igualdad exacta. Apagado por default
            porque son habla legítima. Enciéndelo sólo para audio que ya sabes
            que es ruido (p.ej. barrer un lote de videos de bafle).

    Returns:
        bool
    """
    if not texto:
        return True
    crudo = texto.strip()
    motivo = _motivo_de_alucinacion(crudo, estricto)
    if motivo:
        # Instrumentado: sin saber QUÉ patrón dispara, no se puede afinar el
        # corpus ni detectar un falso positivo que esté borrando habla real.
        evento("lexico.alucinacion", motivo=motivo, estricto=estricto,
               texto=crudo[:120], chars=len(crudo))
        return True
    return False


def _motivo_de_alucinacion(crudo, estricto=False):
    """→ el nombre de la regla que dispara, o None. Separado de `es_alucinacion`
    para que el booleano siga siendo booleano y el motivo se pueda medir."""
    if any(m in crudo for m in ALUCINACIONES_CRUDAS):
        return "simbolo_musical"
    # Sin acentos pero CON corchetes: «[Música]» debe casar igual que «[Music]».
    if ETIQUETA_SONIDO.match(sin_acentos(crudo)):
        return "etiqueta_sonido"
    t = normalizar(crudo)
    if len(t) < 3:
        return "demasiado_corto"
    for rx in _RX_ALUCINACION:
        if rx.search(t):
            return f"corpus:{rx.pattern[:40]}"
    if es_bucle_repetido(crudo):
        return "bucle_repetido"
    if estricto and t in ALUCINACIONES_DEBILES:
        return "tier_debil"
    return None


# ═════════════════════════════════════════════════════════════════════════════
# 2. CORRECCIONES — errores de palabra observados (corpus real de hoy)
# ═════════════════════════════════════════════════════════════════════════════
#
# Todas son errores del tier LOCAL (`hear`, o sea SFSpeechRecognizer de Apple en
# es-MX), que no tiene forma de recibir vocabulario — por eso destroza los
# nombres propios del dominio y hay que arreglarlo aquí, aguas abajo.
#
# CADA regla declara su RIESGO, y de ahí sale si corre por default:
#   · "segura"      → la forma errónea es tan improbable en español real que
#                     corregirla nunca borra habla legítima. Corre siempre.
#   · "contextual"  → la forma errónea ES una palabra normal («bus», «coronas»).
#                     Sólo corre si el utterance trae contexto del dominio.
#                     Si no hay contexto, se deja intacta.
#
# `caja=True` significa que el patrón distingue MAYÚSCULAS (para siglas como
# MHC, donde «mhc» en minúsculas ya sería otra cosa).

Regla = namedtuple("Regla", "patron reemplazo riesgo contexto caja porque")
Cambio = namedtuple("Cambio", "regla original corregido inicio fin")

# Palabras que prueban que el utterance habla de código/git/máquina. Si alguna
# aparece, las reglas "contextual" de ese dominio se habilitan.
CONTEXTO_DEV = frozenset("""
    git commit commits push pull repo repositorio branch rama merge deploy build
    codigo code script motor test tests bug bugs error errores log logs api
    terminal agente agentes claude servidor server fix arreglar arreglo tirar
    reportar clonar clonas clonando compilar correr corriendo funcion clase
""".split())

# Palabras que prueban que el utterance habla del caso vape/THC.
CONTEXTO_VAPE = frozenset("""
    vape vapes vapear cartucho cartuchos sinfin muha meds thc cannabis pluma
    bateria sabor hierba carrito carro510 concentrado
""".split())

CORRECCIONES = (
    Regla(
        patron=r"\bbus\b",
        reemplazo="bug",
        riesgo="contextual",
        contexto=CONTEXTO_DEV,
        caja=False,
        porque="«bus» es palabra real (el bus, un bus de datos), así que NUNCA "
               "se corrige sola: exige que el utterance ya hable de código/git. "
               "Sin contexto se deja intacta — mejor un 'bus' mal transcrito que "
               "borrarle el camión.",
    ),
    Regla(
        patron=r"\bcoronas\b",
        reemplazo="clonas",
        riesgo="contextual",
        contexto=CONTEXTO_DEV,
        caja=False,
        porque="«coronas» es palabra real y frecuentísima (coronas dentales, "
               "Coronas la cerveza, coronavirus). Sólo se corrige dentro de una "
               "frase que ya habla de repos — el error nació de «cuando clonas "
               "el repo».",
    ),
    Regla(
        patron=r"\brezarla\b",
        reemplazo="relanzarla",
        riesgo="segura",
        contexto=None,
        caja=False,
        porque="«rezarla» (rezar+la) es gramatical pero prácticamente inexistente "
               "en el habla de Bernard, que sí dice «relanzarla» de la sesión/el "
               "motor todo el tiempo. Riesgo de falso positivo: mínimo.",
    ),
    Regla(
        patron=r"\b(?:el\s+)?mbapp[eé]\b",
        reemplazo="el vape",
        riesgo="segura",
        contexto=None,
        caja=False,
        porque="Bernard no habla de futbol; sí habla del vape en cada sesión del "
               "caso Sinfín. El recognizer oye «el vape» y saca al futbolista. "
               "El «el » opcional del patrón evita el doble artículo si el "
               "recognizer ya escribió «el Mbappé».",
    ),
    Regla(
        patron=r"\bMHC\b",
        reemplazo="THC",
        riesgo="segura",
        contexto=None,
        caja=True,
        porque="MHC es un término real de inmunología (complejo mayor de "
               "histocompatibilidad) y cero probable en estas sesiones; THC es "
               "vocabulario diario del caso. Sensible a MAYÚSCULAS a propósito: "
               "sólo la sigla, jamás un «mhc» suelto en minúsculas.",
    ),
    Regla(
        patron=r"\bbe allowed\b",
        reemplazo="Visalaw",
        riesgo="segura",
        contexto=None,
        caja=False,
        porque="Frase en inglés dentro de un stream en español: el recognizer "
               "es-MX no tiene «Visalaw» en su léxico y lo parte en la frase "
               "inglesa más cercana. «be allowed» no aparece jamás en el habla "
               "real de estas sesiones.",
    ),
)

_RX_CORRECCION = tuple(
    (re.compile(r.patron, 0 if r.caja else re.I), r) for r in CORRECCIONES)


def _respetar_caja(original, reemplazo):
    """Si la palabra original venía capitalizada, el reemplazo también.

    Evita que «Bus arreglado» se convierta en «bug arreglado» a media frase.
    Si el reemplazo ya trae mayúsculas propias (Visalaw, THC), se respeta tal
    cual.
    """
    if reemplazo != reemplazo.lower():
        return reemplazo
    if original[:1].isupper():
        return reemplazo[:1].upper() + reemplazo[1:]
    return reemplazo


def corregir(texto, modo="conservador"):
    """Aplica el corpus de correcciones y DEVUELVE QUÉ CAMBIÓ.

    El cambio jamás es silencioso: ése es el contrato. Quien llame decide si lo
    imprime, lo loguea o lo ignora, pero siempre lo recibe.

    Args:
        texto: transcript ya libre de alucinaciones.
        modo:
            "conservador" (default) — corre las reglas "segura" siempre, y las
                "contextual" SÓLO si el utterance trae palabras de su dominio.
            "agresivo" — corre todas, ignorando la compuerta de contexto. Úsalo
                sólo sobre material que ya sabes que es de trabajo.
            "ninguno" — no toca nada; útil para comparar.

    Returns:
        (texto_corregido, [Cambio, ...]) — la lista viene en orden de aparición
        y trae la Regla completa, así que el `porque` viaja con el cambio.
    """
    if modo == "ninguno" or not texto:
        return texto, []
    normalizado = set(normalizar(texto).split())
    cambios = []
    resultado = texto
    for rx, regla in _RX_CORRECCION:
        if regla.contexto and modo != "agresivo" and not (normalizado & regla.contexto):
            continue
        piezas = []
        fin_previo = 0
        for m in rx.finditer(resultado):
            nuevo = _respetar_caja(m.group(0), regla.reemplazo)
            piezas.append(resultado[fin_previo:m.start()])
            piezas.append(nuevo)
            fin_previo = m.end()
            cambios.append(Cambio(regla=regla, original=m.group(0),
                                  corregido=nuevo, inicio=m.start(), fin=m.end()))
        if piezas:
            piezas.append(resultado[fin_previo:])
            resultado = "".join(piezas)
    # Una corrección es una intervención sobre lo que Bernard dijo: queda medida
    # una por una, con su regla, para poder auditar falsos positivos después.
    for c in cambios:
        evento("lexico.correccion",
               regla=f"{getattr(c.regla, 'patron', '?')}→{getattr(c.regla, 'reemplazo', '?')}",
               riesgo=getattr(c.regla, "riesgo", None), modo=modo,
               antes=c.original, despues=c.corregido)
    return resultado, cambios


def formatear_cambios(cambios):
    """→ ['bus → bug', 'MHC → THC'] para pintar en pantalla o en el log."""
    return [f"{c.original} → {c.corregido}" for c in cambios]


def registrar_cambios(archivo, cambios, imprimir=True):
    """Deja el rastro auditable de lo que el léxico tocó.

    Escribe una línea por corrección en `archivo` (el mismo .log de fallos) y,
    por default, pinta una línea tenue en pantalla. NO usa `Fallos.avisar`
    a propósito: una corrección no es un fallo y no debe inflar ese contador.
    """
    if not cambios:
        return
    marca = time.strftime("%H:%M:%S")
    try:
        with open(archivo, "a") as f:
            for c in cambios:
                f.write(f"[{marca}] lexico: '{c.original}' → '{c.corregido}' "
                        f"({c.regla.riesgo})\n")
    except OSError:
        pass
    if imprimir:
        print(f"\033[2m   ✎ léxico: {' · '.join(formatear_cambios(cambios))}\033[0m")


# ═════════════════════════════════════════════════════════════════════════════
# 3. LEXICO_DOMINIO — el vocabulario que el ticker destroza
# ═════════════════════════════════════════════════════════════════════════════

LEXICO_DOMINIO = (
    # Producto / dispositivos
    "AirTag", "AirPods", "vape", "bocina", "cacho", "half-duplex",
    # Caso Sinfín
    "Sinfín", "Muha Meds", "THC", "Peligro al Fondo", "RuVa",
    # Personas
    "Erick", "Miguel Santander",
    # Geografía
    "Guadalajara", "Zapopan", "Tlaquepaque",
    # Filosofía
    "Cioran", "Améry", "Nietzsche", "Schopenhauer",
    # Técnico / plataformas
    "commit", "push", "repo", "Instagram", "WhatsApp", "drag",
)


def prompt_dominio(extra=()):
    """El léxico como `initial_prompt` de Whisper (o hint equivalente).

    Whisper condiciona su decodificación en este texto, así que sesga hacia
    escribir «Sinfín» y no «sin fin», «THC» y no «MHC».

    ⚠️ HOY NO ESTÁ CABLEADO Y ES A PROPÓSITO — los dos tiers vivos no lo aceptan:
      · `hear` (SFSpeechRecognizer de Apple): `hear --help` no expone ninguna
        opción de vocabulario/prompt. Verificado 2026-08-15.
      · Susurro Gateway `/v1/stt`: su /v1/discovery documenta sólo `?language=`
        y `?task=`; no hay parámetro de prompt. Verificado 2026-08-15.
    Queda listo para el día que el gateway lo exponga. Inventar el parámetro
    "por si acaso" sería un fake-green.
    """
    return ", ".join(tuple(LEXICO_DOMINIO) + tuple(extra)) + "."
