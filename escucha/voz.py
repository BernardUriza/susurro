#!/Users/bernardurizaorozco/.pyenv/versions/3.14.0/bin/python
"""voz.py — segunda linea de defensa: reconocer la FUENTE por su huella acustica.

El microfono de las sesiones de dictado no capta una fuente, capta TRES:

  1. BERNARD    — voz humana en vivo, cerca del microfono.
  2. ASISTENTE  — la voz sintetizada del gateway (onyx) saliendo por la bocina
                  y volviendo al microfono como eco. Trae candado
                  ($TMPDIR/susurro-hablando.lock) cuando la reproduce hablar.py.
  3. MUSICA     — musica y ambiente por la bocina o por el cuarto. NO trae
                  candado, y por eso hoy entra al registro como si la hubiera
                  dicho Bernard. Ademas hace ALUCINAR al transcriptor: diez
                  videos de puro bafle de bar devolvieron diez veces
                  "Suscribete al canal" y "Gracias por ver el video".

La primera linea de defensa es el candado, ya verificada en vivo y siempre
preferente: es una certeza, no una estimacion. Este modulo es el RESPALDO para
cuando el candado falle (proceso muerto, lock pegado) o para la fuente que el
candado nunca cubrio: la musica.

SESGO CONSERVADOR, deliberado y no negociable
---------------------------------------------
Marcar una frase real de Bernard como ASISTENTE o como MUSICA es MUCHO peor que
dejar pasar un eco: el eco solo ensucia el registro, pero un falso positivo
BORRA lo que el vino a decir. Por eso, ante la duda, la respuesta es INCIERTO,
y los umbrales por defecto exigen margen amplio antes de acusar a una fuente.

Interprete
----------
parselmouth (Praat) vive en pyenv 3.14.0:
    ~/.pyenv/versions/3.14.0/bin/python
NO esta en el conda `escucha` ni en el python3 de brew. Si falta, el modulo
DEGRADA: estima F0 con un autocorrelador propio en numpy puro y renuncia a
jitter/shimmer/HNR. Si tampoco hay numpy, `perfil()` devuelve {'error': ...} y
`clasificar()` devuelve INCIERTO. Nunca levanta una excepcion hacia el que lo
llame: el motor de escucha jamas debe morir por culpa de este analisis.

PUNTO DE INTEGRACION — ver la seccion INTEGRACION al final del archivo.
Este modulo NO esta cableado a nada a proposito.
"""

from __future__ import annotations

import json
import math
import os
import sys
import wave

RUTA_UMBRALES = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "voz-umbrales.json")

try:
    import numpy as np
    TIENE_NUMPY = True
except Exception:                                        # pragma: no cover
    np = None
    TIENE_NUMPY = False

try:
    import parselmouth
    from parselmouth.praat import call as _praat
    TIENE_PRAAT = True
except Exception:
    parselmouth = None
    _praat = None
    TIENE_PRAAT = False


# ---------------------------------------------------------------- umbrales --

UMBRALES_POR_DEFECTO = {
    "_origen": "medidos 2026-08-15 sobre 26 utterances de Bernard + 8 del "
               "asistente (sesion dictado-20260815, ventana de bocina cruzada "
               "contra los mp3 del gateway) + 10 wav de musica (stories-1408). "
               "voz-umbrales.json, si existe, los pisa.",

    # --- puerta de entrada: sin esto no se clasifica nada ---
    "dur_minima_s": 0.6,
    "rms_db_minimo": -55.0,
    "voz_frac_minima": 0.04,

    # --- MUSICA: la ausencia de estructura de habla ---
    # `ritmo` = pico de autocorrelacion de la envolvente entre 0.25 y 2.0 s
    # (30-240 BPM). Es la mejor senal de musica que encontre y es estructural
    # (no depende del canal ni del nivel de grabacion), pero NO separa limpio:
    # MEDIDO, Bernard llega hasta 0.330 y la musica baja hasta 0.176. Se
    # solapan de verdad. El corte se pone ARRIBA del maximo observado de
    # Bernard (0.330 x 1.15), no en un percentil: un percentil deja fuera
    # justo a sus frases raras, y una de ellas fue el unico error caro del
    # leave-one-out (utt-0062, ritmo 0.27, contra un umbral auto de 0.271).
    # El precio es perder musica de tempo vago (instrumental, ambient), y ese
    # precio es el correcto: dejar pasar musica cuesta ruido, marcar a Bernard
    # cuesta una frase suya.
    "musica_ritmo": 0.38,
    # apoyos: F0 caotica (el seguidor salta entre parciales de la mezcla),
    # notas sostenidas, y energia que nunca respira.
    "musica_f0_std": 60.0,
    "musica_sostenido": 0.03,
    "musica_continuidad": 0.96,
    "musica_din_db_max": 3.3,
    # el ritmo por si solo NO condena: hace falta al menos un apoyo.
    "musica_apoyos_minimos": 1,
    # ...y al reves: con SUFICIENTES apoyos no hace falta pulso. MEDIDO, el
    # conteo de apoyos es lo que mejor separa sin tocar a Bernard:
    #     Bernard   -> 0 apoyos x15, 1 x9, 2 x2, y NUNCA 3
    #     asistente -> maximo 2
    #     musica    -> siempre >=2, y 7 de 10 llegan a 3 o 4
    # Por eso 3 apoyos bastan: es un umbral que la voz de Bernard no alcanza
    # en ninguna de sus 26 frases. Esto rescata la musica de tempo vago que el
    # corte de `ritmo` deja pasar (una vocal cantada a 234 Hz con F0 caotica,
    # notas sostenidas y dinamica de 0.8 dB, pero con ritmo 0.364 < 0.38).
    "musica_apoyos_sin_pulso": 3,

    # --- ASISTENTE (onyx por bocina) vs BERNARD ---
    # LA FEATURE QUE DE VERDAD SEPARA, y la unica con separacion PERFECTA:
    # MEDIDO sobre 34 muestras, onyx cae en 87.6-94.7 Hz y Bernard en
    # 122.0-217.2 Hz. Un hueco de 27 Hz sin una sola muestra dentro, igual en
    # cachos crudos que recortados. El corte se pone a la mitad de ese hueco.
    #
    # OJO, LA FRAGILIDAD PRINCIPAL DE ESTE MODULO: esto reconoce a `onyx` por
    # su registro grave, NO a "una voz sintetica" en general. Si cambia
    # SUSURRO_VOICE a una voz aguda (nova, shimmer), el corte se invierte y
    # empezaria a acusar a Bernard. Al cambiar de voz hay que RECALIBRAR, y
    # mientras tanto el candado sigue cubriendo el caso normal.
    "asistente_f0_max": 108.0,
    "bernard_f0_min": 115.0,
    # Techo de Bernard. MEDIDO: su mediana de F0 nunca paso de 217 Hz en 26
    # frases. Arriba de 260 Hz ya no es su voz hablada — es una voz CANTADA
    # (la que se colo aqui fue una vocal femenina a 344 Hz que el modulo
    # llamaba "registro humano en vivo" y dejaba pasar como si fuera el).
    # Pasarse de este techo NO condena por si solo: sin apoyos queda INCIERTO.
    "bernard_f0_max": 260.0,
    # La sintesis sale comprimida: su energia casi no respira en dB. Apoya,
    # pero NO decide: MEDIDO, el rango de Bernard (min 3.39) roza el del
    # asistente (max 3.46) en cuanto se mezclan cachos crudos y recortados.
    "asistente_din_db_max": 3.35,
    "bernard_din_db_min": 3.40,
    # cuantos indicios hacen falta para acusar al asistente (de 3).
    "asistente_indicios_minimos": 2,

    # --- confianza minima que el consumidor deberia exigir para MARCAR ---
    "confianza_minima": 0.75,

    # --- correlacion contra la grabacion de bocina (AudioTee) ---
    # MEDIDO en condiciones controladas (audio real pasado por un viaje
    # simulado bocina->cuarto->microfono): contra su propia referencia r cae
    # en 0.57-0.99, contra una referencia ajena en -0.03-0.27. Separacion
    # perfecta, y el punto medio es 0.42.
    # OJO: este numero viene de simulacion, NO de una captura real de AudioTee
    # corriendo junto al microfono — esa captura no existe todavia. Al
    # encenderla por primera vez hay que RECALIBRARLO con datos de verdad.
    "referencia_r_minimo": 0.42,
}


def cargar_umbrales(ruta: str | None = None) -> dict:
    """Umbrales por defecto, pisados por los calibrados si existe el JSON."""
    u = dict(UMBRALES_POR_DEFECTO)
    ruta = ruta or RUTA_UMBRALES
    try:
        with open(ruta) as fh:
            u.update({k: v for k, v in json.load(fh).items()
                      if not k.startswith("_")})
    except Exception:
        pass
    return u


# ------------------------------------------------------------------ audio --

def _leer_wav(ruta: str):
    """Devuelve (muestras float32 en [-1,1], sr). Mono; mezcla si viene estereo."""
    with wave.open(ruta, "rb") as w:
        canales, ancho, sr, n = (w.getnchannels(), w.getsampwidth(),
                                 w.getframerate(), w.getnframes())
        crudo = w.readframes(n)
    if ancho == 2:
        x = np.frombuffer(crudo, dtype="<i2").astype(np.float32) / 32768.0
    elif ancho == 4:
        x = np.frombuffer(crudo, dtype="<i4").astype(np.float32) / 2147483648.0
    elif ancho == 1:
        x = (np.frombuffer(crudo, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    else:
        raise ValueError(f"ancho de muestra no soportado: {ancho} bytes")
    if canales > 1:
        x = x.reshape(-1, canales).mean(axis=1)
    return x, sr


def _f0_autocorrelacion(x, sr, piso=70.0, techo=400.0, paso=0.01):
    """F0 por autocorrelacion normalizada. Respaldo cuando no hay Praat.

    Piso en 70 Hz: abajo de eso se cuela el zumbido de 60 Hz de la corriente
    (leccion heredada de tesitura.py / glissando-1).
    """
    n = int(0.04 * sr)
    salto = max(1, int(paso * sr))
    lag_min, lag_max = int(sr / techo), int(sr / piso)
    f0 = []
    for i in range(0, max(0, len(x) - n), salto):
        m = x[i:i + n]
        m = m - m.mean()
        pot = float(np.dot(m, m))
        if pot < 1e-7:
            f0.append(0.0)
            continue
        ac = np.correlate(m, m, mode="full")[n - 1:]
        seg = ac[lag_min:lag_max]
        if len(seg) < 3:
            f0.append(0.0)
            continue
        k = int(np.argmax(seg))
        # GUARDA DE OCTAVA: el pico mas alto de la autocorrelacion suele caer
        # en MEDIO periodo, y eso reporta el doble de la frecuencia real. Se
        # prefiere el lag MAS LARGO que llegue al 85% del pico — es decir, el
        # periodo completo. Sin esto, medido, la F0 maxima de Bernard saltaba
        # de 217 a 400 Hz y rompia el techo que lo distingue de una voz cantada.
        buenos = np.flatnonzero(seg >= 0.85 * seg[k])
        if len(buenos):
            k = int(buenos[-1])
        # 0.35 de autocorrelacion normalizada: mismo criterio laxo que Praat
        # para no perder frames de voz debil captada de lejos.
        f0.append(sr / (lag_min + k) if seg[k] / pot > 0.35 else 0.0)
    return np.array(f0), paso


def _f0_praat(snd, piso=70.0, techo=400.0, paso=0.01):
    p = snd.to_pitch_ac(time_step=paso, pitch_floor=piso, pitch_ceiling=techo)
    return p.selected_array["frequency"], paso


# ----------------------------------------------------------------- perfil --

def perfil(ruta_wav: str) -> dict:
    """Extrae la huella acustica de un wav.

    Devuelve un dict de features. Ante cualquier fallo devuelve
    {'error': '<motivo>', 'archivo': ruta} — nunca levanta excepcion.
    """
    salida = {"archivo": ruta_wav, "praat": TIENE_PRAAT}
    if not TIENE_NUMPY:
        salida["error"] = "sin numpy — este modulo queda inerte"
        return salida
    try:
        x, sr = _leer_wav(ruta_wav)
    except Exception as e:
        salida["error"] = f"no se pudo leer el wav: {e}"
        return salida

    dur = len(x) / sr
    salida["dur"] = float(dur)
    salida["sr"] = int(sr)
    if dur < 0.25:
        salida["error"] = "demasiado corto para medir nada"
        return salida

    rms = float(np.sqrt(np.mean(x ** 2)) + 1e-12)
    salida["rms_db"] = float(20 * math.log10(rms))

    # ---- F0 ----
    try:
        if TIENE_PRAAT:
            snd = parselmouth.Sound(ruta_wav)
            if snd.n_channels > 1:
                snd = snd.convert_to_mono()
            f0v, paso = _f0_praat(snd)
        else:
            snd = None
            f0v, paso = _f0_autocorrelacion(x, sr)
    except Exception as e:
        salida["error"] = f"fallo el estimador de F0: {e}"
        return salida

    f0v = np.asarray(f0v, dtype=float)
    voz = f0v[f0v > 0]
    salida["voz_frac"] = float(len(voz) / max(1, len(f0v)))
    if len(voz) < 10:
        salida["error"] = "sin frames sonoros suficientes"
        return salida

    st = 12 * np.log2(voz / 100.0)          # semitonos sobre 100 Hz
    salida["f0_media"] = float(voz.mean())
    salida["f0_mediana"] = float(np.median(voz))
    salida["f0_std"] = float(voz.std())
    salida["f0_p10"] = float(np.percentile(voz, 10))
    salida["f0_p90"] = float(np.percentile(voz, 90))
    salida["f0_iqr_st"] = float(np.percentile(st, 75) - np.percentile(st, 25))
    salida["f0_delta_st"] = float(np.median(np.abs(np.diff(st)))) if len(st) > 1 else 0.0

    # --- SOSTENIDO: la firma de la musica. Fraccion de frames sonoros dentro
    # de tramos de >=250 ms donde la nota no se mueve mas de medio semitono.
    # El habla no sostiene: siempre esta cayendo o subiendo.
    salida["sostenido"] = _fraccion_sostenida(f0v, paso)

    # ---- envolvente de energia (marcos de 25 ms, salto 10 ms) ----
    #
    # INVARIANCIA AL TROCEADO (medido 2026-08-15, y no es un detalle menor):
    # con el cacho crudo de 15 s por reloj, `ritmo` de Bernard daba 0.43 y se
    # confundia con la musica (0.64); recortando el silencio de las orillas
    # bajaba a 0.21 y la separacion quedaba limpia. Esos 10 s de silencio al
    # final del cacho son un escalon en la envolvente que la autocorrelacion
    # lee como si fuera un pulso. Un modulo cuyos umbrales dependan de como
    # troceo el que llama es un modulo que miente, asi que el recorte se hace
    # AQUI DENTRO y una sola tabla de umbrales sirve para las dos formas.
    n_v, salto_v = int(0.025 * sr), int(0.010 * sr)
    if len(x) > n_v + salto_v:
        marcos = np.lib.stride_tricks.sliding_window_view(x, n_v)[::salto_v]
        ener = (marcos ** 2).mean(axis=1)
        edb = 10 * np.log10(ener + 1e-12)
        pico = float(np.percentile(edb, 99))
        vivo = edb > (pico - 35.0)
        idx = np.flatnonzero(vivo)
        # se recorta a [primer, ultimo] marco vivo; las pausas de EN MEDIO se
        # conservan a proposito: respirar es estructura de habla, no basura.
        if len(idx) > 4:
            edb = edb[idx[0]:idx[-1] + 1]
        salida["recorte_frac"] = float(len(edb) * salto_v / max(1, len(x)))
        activos = edb > (pico - 25.0)
        # continuidad: la musica no respira, el habla si
        salida["continuidad"] = float(activos.mean())
        # dinamica: la sintesis sale comprimida, la voz en vivo no
        vivos = edb[edb > np.percentile(edb, 40)]
        salida["din_db"] = float(vivos.std()) if len(vivos) > 2 else 0.0
        salida["mod_silabica"] = _modulacion_silabica(edb, 1.0 / 0.010)
        salida["ritmo"] = _periodicidad_ritmica(edb, 1.0 / 0.010)
    else:
        salida["recorte_frac"] = 1.0
        salida["continuidad"] = 0.0
        salida["din_db"] = 0.0
        salida["mod_silabica"] = 0.0
        salida["ritmo"] = 0.0

    # ---- espectro promedio sobre los marcos con energia ----
    salida.update(_espectro(x, sr))

    # ---- calidad de voz: solo con Praat ----
    if TIENE_PRAAT and snd is not None:
        try:
            pp = _praat(snd, "To PointProcess (periodic, cc)", 70.0, 400.0)
            salida["jitter"] = float(_praat(pp, "Get jitter (local)",
                                            0, 0, 1e-4, 0.02, 1.3))
            salida["shimmer"] = float(_praat([snd, pp], "Get shimmer (local)",
                                             0, 0, 1e-4, 0.02, 1.3, 1.6))
        except Exception:
            salida["jitter"] = salida["shimmer"] = float("nan")
        try:
            h = _praat(snd, "To Harmonicity (cc)", 0.01, 70.0, 0.1, 1.0)
            salida["hnr"] = float(_praat(h, "Get mean", 0, 0))
        except Exception:
            salida["hnr"] = float("nan")
    else:
        salida["jitter"] = salida["shimmer"] = salida["hnr"] = float("nan")

    return salida


def _fraccion_sostenida(f0v, paso, tol_st=0.5, min_ms=250.0):
    """Fraccion de frames sonoros dentro de notas sostenidas."""
    minimo = max(2, int((min_ms / 1000.0) / paso))
    sonoros = f0v > 0
    total = int(sonoros.sum())
    if total == 0:
        return 0.0
    sostenidos = 0
    i = 0
    while i < len(f0v):
        if not sonoros[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(f0v) and sonoros[j + 1]:
            j += 1
        tramo = f0v[i:j + 1]
        # ventana deslizante dentro del tramo sonoro
        k = 0
        while k < len(tramo):
            m = k + 1
            while m < len(tramo):
                sub = tramo[k:m + 1]
                if 12 * abs(math.log2(float(sub.max()) / float(sub.min()))) > tol_st:
                    break
                m += 1
            largo = m - k
            if largo >= minimo:
                sostenidos += largo
                k = m
            else:
                k += 1
        i = j + 1
    return float(sostenidos / total)


def _modulacion_silabica(edb, fs_env):
    """Energia de modulacion 3-8 Hz (silabas) sobre 0.3-2.5 Hz (frases/compas).

    El habla tiene su pico de modulacion cerca de 4-5 Hz — es la tasa silabica.
    La musica modula mas lento (el compas) y de forma mas plana.
    """
    e = edb - edb.mean()
    if len(e) < 32:
        return 0.0
    esp = np.abs(np.fft.rfft(e * np.hanning(len(e)))) ** 2
    fr = np.fft.rfftfreq(len(e), 1.0 / fs_env)
    sil = esp[(fr >= 3.0) & (fr < 8.0)].sum()
    lento = esp[(fr >= 0.3) & (fr < 2.5)].sum()
    return float(sil / (lento + 1e-12))


def _periodicidad_ritmica(edb, fs_env, lag_min_s=0.25, lag_max_s=2.0):
    """Pico de autocorrelacion de la envolvente: el pulso del ritmo.

    Antes de correlacionar se le quita a la envolvente su tendencia lenta
    (media movil de 2 s = corte en 0.5 Hz). Sin ese paso, un cacho de 15 s con
    una frase de 5 s y 10 s de silencio produce un ESCALON que la
    autocorrelacion confunde con un pulso: medido, subia el `ritmo` de Bernard
    de 0.21 a 0.44 y lo metia en el rango de la musica. Ningun tempo real vive
    abajo de 0.5 Hz (30 BPM), asi que quitarlo no borra ningun ritmo de verdad.
    """
    if len(edb) < int(lag_max_s * fs_env) + 4:
        return 0.0
    v = max(3, int(2.0 * fs_env) | 1)
    if len(edb) > v:
        nucleo = np.ones(v) / v
        lenta = np.convolve(np.pad(edb, v // 2, mode="edge"), nucleo, mode="valid")[:len(edb)]
        e = edb - lenta
    else:
        e = edb - edb.mean()
    e = e - e.mean()
    ac = np.correlate(e, e, mode="full")[len(e) - 1:]
    if ac[0] <= 0:
        return 0.0
    ac = ac / ac[0]
    a, b = int(lag_min_s * fs_env), int(lag_max_s * fs_env)
    seg = ac[a:b]
    return float(seg.max()) if len(seg) else 0.0


def _espectro(x, sr, n=512, salto=256):
    """Bandas, centroide, rolloff y planitud sobre los marcos con energia.

    OJO: a 16 kHz el Nyquist son 8 kHz — arriba de eso NO HAY NADA que medir.
    Por eso la banda "alta" util aqui es 4-8 kHz, no >8 kHz.
    """
    fuera = {"centroide": 0.0, "rollo95": 0.0, "plan": 0.0,
             "b0_1k": 0.0, "b1_2k": 0.0, "b2_4k": 0.0, "b4_8k": 0.0}
    if len(x) < n * 2:
        return fuera
    w = np.hanning(n)
    marcos = np.lib.stride_tricks.sliding_window_view(x, n)[::salto] * w
    pot = np.abs(np.fft.rfft(marcos, axis=1)) ** 2
    ener = pot.sum(axis=1)
    activos = pot[ener >= np.percentile(ener, 70)]
    if not len(activos):
        return fuera
    ps = activos.mean(axis=0)
    total = ps.sum()
    if total <= 0:
        return fuera
    ps = ps / total
    fr = np.fft.rfftfreq(n, 1.0 / sr)

    def banda(a, b):
        return float(ps[(fr >= a) & (fr < b)].sum())

    return {
        "centroide": float((fr * ps).sum()),
        "rollo95": float(fr[min(len(fr) - 1, int(np.searchsorted(np.cumsum(ps), 0.95)))]),
        "plan": float(np.exp(np.mean(np.log(ps + 1e-20))) / np.mean(ps)),
        "b0_1k": banda(0, 1000), "b1_2k": banda(1000, 2000),
        "b2_4k": banda(2000, 4000), "b4_8k": banda(4000, sr / 2),
    }


# ------------------------------------------------------------ clasificador --

def clasificar(ruta_wav: str, referencia: dict | None = None,
               umbrales: dict | None = None) -> tuple[str, float, list[str]]:
    """('BERNARD'|'ASISTENTE'|'MUSICA'|'INCIERTO', confianza 0-1, motivos).

    `referencia` es un perfil (o dict de umbrales) previo de Bernard; si se
    entrega, se usa su F0 mediana para centrar el corte en vez del default.
    `motivos` explica SIEMPRE el veredicto en lenguaje legible: un fallo sin
    explicacion no sirve para auditar nada.
    """
    u = dict(umbrales or cargar_umbrales())
    p = perfil(ruta_wav)
    if p.get("error"):
        return "INCIERTO", 0.0, [f"no medible: {p['error']}"]

    motivos: list[str] = []
    if p["dur"] < u["dur_minima_s"]:
        return "INCIERTO", 0.0, [f"dura {p['dur']:.2f}s, menos del minimo "
                                 f"{u['dur_minima_s']}s para medir"]
    if p["rms_db"] < u["rms_db_minimo"]:
        return "INCIERTO", 0.0, [f"nivel {p['rms_db']:.0f} dB, demasiado debil"]
    if p["voz_frac"] < u["voz_frac_minima"]:
        return "INCIERTO", 0.0, [f"solo {p['voz_frac']:.0%} de frames sonoros, "
                                 f"no hay material tonal que juzgar"]

    if referencia:
        f0_ref = referencia.get("f0_mediana") or referencia.get("bernard_f0_mediana")
        if f0_ref:
            u["bernard_f0_min"] = min(u["bernard_f0_min"], float(f0_ref) * 0.80)
            u["asistente_f0_max"] = min(u["asistente_f0_max"], float(f0_ref) * 0.68)
            motivos.append(f"referencia de Bernard en {float(f0_ref):.0f} Hz: "
                           f"corte de asistente movido a {u['asistente_f0_max']:.0f} Hz")

    # El ORDEN de las tres preguntas no es capricho: primero se resuelve con la
    # feature que separa PERFECTO (F0 para el asistente), y solo despues con
    # las que se solapan de verdad (el ritmo para la musica). Al reves, una
    # frase del asistente con pulso marcado se iba a MUSICA — error barato,
    # pero evitable.
    apoyos = []
    if p["f0_std"] >= u["musica_f0_std"]:
        apoyos.append(f"F0 caotica (desviacion {p['f0_std']:.0f} Hz >= "
                      f"{u['musica_f0_std']:.0f}): el seguidor de tono salta entre "
                      f"parciales de una mezcla, no sigue una sola voz")
    if p["sostenido"] >= u["musica_sostenido"]:
        apoyos.append(f"sostiene notas el {p['sostenido']:.0%} del tiempo sonoro "
                      f"(>={u['musica_sostenido']:.0%}); el habla no sostiene")
    if p["continuidad"] >= u["musica_continuidad"]:
        apoyos.append(f"energia continua el {p['continuidad']:.0%} del tiempo "
                      f"(>={u['musica_continuidad']:.0%}): no respira")
    if p["din_db"] <= u["musica_din_db_max"]:
        apoyos.append(f"dinamica {p['din_db']:.1f} dB (<={u['musica_din_db_max']}): "
                      f"comprimida como un master, no como un cuarto")
    hay_pulso = p["ritmo"] >= u["musica_ritmo"]
    pulso = (f"pulso periodico en la envolvente ({p['ritmo']:.2f} >= "
             f"{u['musica_ritmo']}): la energia se repite a intervalo fijo, "
             f"eso es un compas y no una frase hablada")

    # ---- 1) MUSICA evidente, por cualquiera de los dos caminos:
    #         pulso + 2 apoyos, o 3 apoyos sin necesidad de pulso.
    #         Con esa evidencia gana incluso antes que el asistente.
    if (hay_pulso and len(apoyos) >= 2) or len(apoyos) >= u["musica_apoyos_sin_pulso"]:
        pruebas = ([pulso] if hay_pulso else
                   [f"sin pulso claro ({p['ritmo']:.2f}), pero se acumulan "
                    f"{len(apoyos)} rasgos de musica y ninguna voz de Bernard "
                    f"medida llego a tantos"]) + apoyos
        return "MUSICA", min(0.92, 0.50 + 0.14 * len(apoyos)), motivos + pruebas

    # ---- 2) ¿es el ASISTENTE (onyx por bocina)? ----
    #
    # LA F0 GRAVE ES REQUISITO, no un indicio mas que sume. Es la unica feature
    # con separacion perfecta medida; `din_db` y la estabilidad de F0 solo la
    # acompañan. Cuando se dejaba que dos apoyos cualesquiera bastaran, una
    # frase real de Bernard —bajita y pareja, con din_db 3.5— junto con unos
    # umbrales recalibrados a la alza alcanzo el veredicto ASISTENTE sin que su
    # F0 (muy por arriba del corte) tuviera voto. Ese es exactamente el error
    # caro, y aqui se cierra de forma estructural: sin F0 grave no hay condena,
    # por mal calibrado que este todo lo demas.
    if p["f0_mediana"] > u["asistente_f0_max"]:
        ind_asi = []
    else:
        ind_asi = [f"F0 mediana {p['f0_mediana']:.0f} Hz "
                   f"(<={u['asistente_f0_max']:.0f}): registro grave de onyx, "
                   f"muy por debajo de la voz de Bernard"]
    if ind_asi and p["din_db"] <= u["asistente_din_db_max"]:
        ind_asi.append(f"dinamica {p['din_db']:.1f} dB "
                       f"(<={u['asistente_din_db_max']}): energia comprimida, tipica de TTS")
    if ind_asi and p["f0_std"] <= 35.0:
        ind_asi.append(f"F0 antinaturalmente estable (desviacion {p['f0_std']:.0f} Hz): "
                       f"la entonacion sintetica no se mueve como la humana")
    if len(ind_asi) >= u["asistente_indicios_minimos"]:
        conf = min(0.93, 0.45 + 0.16 * len(ind_asi))
        return "ASISTENTE", conf, motivos + ind_asi

    # ---- 3) MUSICA con un solo apoyo: ya descartado el asistente. ----
    if hay_pulso and len(apoyos) >= u["musica_apoyos_minimos"]:
        return "MUSICA", min(0.92, 0.50 + 0.14 * len(apoyos)), motivos + [pulso] + apoyos

    # ---- 4) Demasiado agudo para ser su voz hablada: canto, no Bernard. ----
    if p["f0_mediana"] > u["bernard_f0_max"]:
        alto = (f"F0 mediana {p['f0_mediana']:.0f} Hz, arriba del techo de "
                f"{u['bernard_f0_max']:.0f} Hz: fuera del registro hablado de "
                f"Bernard (su maximo medido son 217 Hz); huele a voz cantada")
        if not TIENE_PRAAT:
            # Sin Praat, una F0 alta es tan probablemente un ERROR DE OCTAVA del
            # respaldo como una voz cantada — medido: el estimador propio leyo
            # 348 Hz en una frase real de Bernard, y con esta regla activa lo
            # habria marcado como musica. Un techo solo se puede aplicar con un
            # medidor en el que se confie, asi que aqui se renuncia a la regla.
            return "INCIERTO", 0.30, motivos + [
                alto, "pero sin parselmouth la F0 alta puede ser un error de "
                      "octava del estimador de respaldo, no una voz cantada: "
                      "no se acusa"]
        if apoyos:
            return "MUSICA", min(0.85, 0.48 + 0.14 * len(apoyos)), motivos + [alto] + apoyos
        return "INCIERTO", 0.40, motivos + [alto, "pero sin apoyos de musica no "
                                            "se acusa: pasa como dudoso"]

    # ---- 5) ¿es BERNARD? Solo si esta CLARAMENTE del lado humano ----
    ind_ber = []
    if p["f0_mediana"] >= u["bernard_f0_min"]:
        ind_ber.append(f"F0 mediana {p['f0_mediana']:.0f} Hz "
                       f"(>={u['bernard_f0_min']:.0f}): registro humano en vivo")
    if p["din_db"] >= u["bernard_din_db_min"]:
        ind_ber.append(f"dinamica {p['din_db']:.1f} dB "
                       f"(>={u['bernard_din_db_min']}): la energia respira")
    if p["ritmo"] < u["musica_ritmo"]:
        ind_ber.append(f"sin pulso periodico ({p['ritmo']:.2f} < {u['musica_ritmo']}): "
                       f"estructura de habla, no de compas")
    if len(ind_ber) >= 2:
        conf = min(0.92, 0.42 + 0.17 * len(ind_ber))
        return "BERNARD", conf, motivos + ind_ber

    # ---- 6) en la duda, INCIERTO. Nunca se acusa a la ligera. ----
    return "INCIERTO", 0.35, motivos + [
        f"F0 {p['f0_mediana']:.0f} Hz, dinamica {p['din_db']:.1f} dB, "
        f"ritmo {p['ritmo']:.2f}, continuidad {p['continuidad']:.0%}",
        f"{len(apoyos)} apoyo(s) de musica y {len(ind_asi)} indicio(s) de "
        f"asistente: ninguno alcanza el minimo. Se prefiere dudar antes que "
        f"quitarle una frase a Bernard.",
    ]


# ------------------------------------------------- correlacion de REFERENCIA --
#
# LA VIA BUENA, y hay que decirlo fuerte: si existe una grabacion de lo que
# SALIO POR LA BOCINA (AudioTee, ~/.local/bin/audiotee, Core Audio Process
# Taps — ver ~/Documents/videopipe/audiotee/CAPTURE-RECIPE.md), entonces la
# pregunta deja de ser la dificil ("¿esto suena a sintesis?") y pasa a ser una
# de senal: "¿este utterance correlaciona con lo que la bocina emitia en ese
# mismo instante?". Eso resuelve LAS DOS clases no-Bernard de un golpe, porque
# mi voz y la musica salen las dos por la misma bocina y las dos aparecen en la
# referencia. No hay que caracterizarlas por separado ni por su timbre.
#
# Se compara la ENVOLVENTE de energia, no la onda: entre la bocina y el
# microfono hay cuarto, reverberacion, ecualizacion del altavoz y un retardo
# desconocido. La forma de onda no sobrevive ese viaje; el contorno de energia
# si.

def envolvente(x, sr, paso=0.010, ventana=0.025):
    """Envolvente log-energia normalizada (media 0, desviacion 1) a 100 Hz."""
    n, salto = max(2, int(ventana * sr)), max(1, int(paso * sr))
    if len(x) < n + salto:
        return np.zeros(0)
    marcos = np.lib.stride_tricks.sliding_window_view(x, n)[::salto]
    e = 10 * np.log10((marcos ** 2).mean(axis=1) + 1e-12)
    s = e.std()
    return (e - e.mean()) / s if s > 1e-9 else np.zeros(len(e))


def correlacion_referencia(ruta_utterance: str, ruta_referencia: str,
                           desfase_max_s: float = 2.0,
                           offset_ref_s: float = 0.0) -> dict:
    """Correlaciona un utterance del microfono contra la referencia de bocina.

    `offset_ref_s` es donde empieza, DENTRO de la referencia, el tramo que
    corresponde temporalmente a este utterance. El desfase fino (arranque del
    reproductor, latencia de la tarjeta, vuelo por el aire) lo busca solo
    dentro de +-`desfase_max_s`.

    Devuelve {'r': pico de correlacion 0-1, 'desfase_s': ..., 'error': ...}.
    Un `r` alto significa: esto que entro por el microfono ES lo que estaba
    saliendo por la bocina. No importa si era voz sintetica o Goldfrapp.
    """
    if not TIENE_NUMPY:
        return {"error": "sin numpy", "r": 0.0}
    try:
        x, sr = _leer_wav(ruta_utterance)
        r, sr_r = _leer_wav(ruta_referencia)
    except Exception as e:
        return {"error": f"no se pudo leer: {e}", "r": 0.0}
    if sr_r != sr:
        return {"error": f"sample rate distinto ({sr} vs {sr_r})", "r": 0.0}

    a = envolvente(x, sr)
    if len(a) < 30:
        return {"error": "utterance demasiado corto para correlacionar", "r": 0.0}
    dur_a = len(a) * 0.010
    desde = max(0.0, offset_ref_s - desfase_max_s)
    hasta = min(len(r) / sr, offset_ref_s + dur_a + desfase_max_s)
    b = envolvente(r[int(desde * sr):int(hasta * sr)], sr)
    if len(b) < len(a) + 2:
        return {"error": "tramo de referencia mas corto que el utterance",
                "r": 0.0}

    # Pearson en CADA desplazamiento. La ventana de la referencia se normaliza
    # LOCALMENTE (media y desviacion de esa ventana, via sumas acumuladas): sin
    # eso no es un coeficiente de correlacion sino un producto punto suelto, y
    # llega a dar valores arriba de 1 — que fue justo el sintoma que delato el
    # bug en la primera medicion (r=1.021, imposible para una correlacion).
    n = len(a)
    az = (a - a.mean())
    na = np.sqrt(np.dot(az, az))
    if na < 1e-9:
        return {"error": "utterance sin dinamica que correlacionar", "r": 0.0}
    c1 = np.concatenate([[0.0], np.cumsum(b)])
    c2 = np.concatenate([[0.0], np.cumsum(b * b)])
    k = len(b) - n + 1
    suma = c1[n:n + k] - c1[:k]
    suma2 = c2[n:n + k] - c2[:k]
    var = np.maximum(suma2 - suma * suma / n, 1e-12)
    prod = np.correlate(b, az, mode="valid")[:k]
    rr = prod / (np.sqrt(var) * na)

    i = int(np.argmax(rr))
    return {"r": float(np.clip(rr[i], -1.0, 1.0)),
            "desfase_s": float(desde + i * 0.010 - offset_ref_s),
            "n_marcos": n}


def clasificar_con_referencia(ruta_utterance: str, ruta_referencia: str,
                              offset_ref_s: float = 0.0,
                              desfase_max_s: float = 2.0,
                              umbral_r: float | None = None,
                              umbrales: dict | None = None):
    """Clasifica USANDO la grabacion de la bocina. Es la via preferente.

    Si el utterance correlaciona con lo que la bocina emitia, ES la bocina —
    da igual si era mi voz o Goldfrapp — y se devuelve 'BOCINA'. Esa etiqueta
    engloba a ASISTENTE y MUSICA a proposito: cuando hay referencia, la
    distincion entre las dos deja de importar (ninguna es Bernard) y ademas
    deja de ser adivinable por timbre.

    Si NO correlaciona, NO se concluye "es Bernard": pudo entrar por otra via
    (audifonos, otro cuarto, el celular). Se cae al analisis acustico, que es
    el respaldo, y se marca el motivo.
    """
    u = umbrales or cargar_umbrales()
    umbral = umbral_r if umbral_r is not None else u.get("referencia_r_minimo", 0.42)
    c = correlacion_referencia(ruta_utterance, ruta_referencia,
                               desfase_max_s=desfase_max_s,
                               offset_ref_s=offset_ref_s)
    if c.get("error"):
        et, conf, mot = clasificar(ruta_utterance, umbrales=u)
        return et, conf, [f"sin referencia utilizable ({c['error']}); "
                          f"se juzga por huella acustica"] + mot
    if c["r"] >= umbral:
        conf = float(min(0.98, 0.60 + 0.38 * (c["r"] - umbral) / max(1e-6, 1 - umbral)))
        return "BOCINA", conf, [
            f"correlaciona r={c['r']:.2f} (>={umbral:.2f}) con lo que salia por "
            f"la bocina, con desfase {c['desfase_s']:+.2f}s: esto no lo dijo "
            f"Bernard, lo emitio el altavoz"]
    et, conf, mot = clasificar(ruta_utterance, umbrales=u)
    return et, conf, [f"no correlaciona con la bocina (r={c['r']:.2f} < "
                      f"{umbral:.2f}), pero eso no prueba que sea Bernard: "
                      f"se confirma por huella acustica"] + mot


# -------------------------------------------------------------- calibrado --

def calibrar(wavs_bocina, wavs_bernard, wavs_musica=(), ruta=None) -> dict:
    """Aprende umbrales de muestras reales y los guarda en JSON.

    `wavs_bocina` conserva el nombre historico por compatibilidad: son las
    muestras del ASISTENTE. Los cortes se ponen en el punto que MAS margen deja
    a Bernard, no a la mitad — el sesgo conservador se hornea aqui, no despues.
    """
    def perfiles(rutas):
        out = []
        for r in rutas:
            p = perfil(r)
            if not p.get("error"):
                out.append(p)
        return out

    A, B, M = perfiles(wavs_bocina), perfiles(wavs_bernard), perfiles(wavs_musica)
    u = dict(UMBRALES_POR_DEFECTO)
    u["_origen"] = (f"calibrado con {len(A)} asistente, {len(B)} bernard, "
                    f"{len(M)} musica")
    u["_praat"] = TIENE_PRAAT

    def p_(muestras, clave, q):
        return float(np.percentile([m[clave] for m in muestras], q)) if muestras else None

    def entre(bajo, alto, sesgo=0.5):
        """Corte entre dos poblaciones. sesgo<0.5 lo pega a `bajo`.

        El sesgo NO es cosmetico: es donde vive la asimetria de costos. Los
        cortes que pueden condenar a Bernard se pegan al lado del acusado
        (0.35), dejando la banda ancha del lado de Bernard.
        """
        if bajo is None or alto is None:
            return None
        if bajo > alto:                      # poblaciones cruzadas: sin margen
            return (bajo + alto) / 2
        return bajo + (alto - bajo) * sesgo

    if A and B:
        # Mismo criterio que el ritmo: los extremos REALES, no percentiles, y
        # pegado al asistente (0.35) para que a Bernard le sobre banda.
        piso_b = min(m["f0_mediana"] for m in B)
        c = entre(max(m["f0_mediana"] for m in A), piso_b, 0.35)
        if c:
            u["asistente_f0_max"] = round(c, 1)
            u["bernard_f0_min"] = round(min(c * 1.10, piso_b * 0.98), 1)
        c = entre(max(m["din_db"] for m in A), min(m["din_db"] for m in B), 0.35)
        if c:
            u["asistente_din_db_max"] = round(c, 2)
            u["bernard_din_db_min"] = round(c * 1.02, 2)
        u["bernard_f0_mediana"] = round(p_(B, "f0_mediana", 50), 1)
        # Techo con 20% de aire sobre su maximo observado: si algun dia grita o
        # se rie agudo, sigue siendo el y no queremos condenarlo por eso.
        # El tope absoluto de 280 Hz NO es negociable por calibracion: ninguna
        # voz masculina HABLADA tiene una F0 mediana ahi arriba, y sin ese tope
        # un estimador de F0 con error de octava (el respaldo sin Praat lo
        # tiene) inflaba el techo a 408 Hz y dejaba pasar una vocal cantada.
        u["bernard_f0_max"] = round(min(280.0,
                                        max(m["f0_mediana"] for m in B) * 1.20), 1)
    if M and B:
        # El corte de ritmo se pone arriba del MAXIMO de Bernard, nunca en un
        # percentil suyo. Con p95 el leave-one-out produjo el unico error caro
        # que tuvo este modulo: al sacar una muestra del conjunto, el umbral
        # se recalculaba justo encima de ella y la condenaba al volver.
        # El maximo no tiene ese agujero, y el piso del default nunca se baja.
        tope_b = max(m["ritmo"] for m in B)
        u["musica_ritmo"] = round(max(UMBRALES_POR_DEFECTO["musica_ritmo"],
                                      tope_b * 1.15), 3)
        # Los apoyos se calibran al p90 de Bernard: un apoyo que Bernard
        # dispara habitualmente no es un apoyo, es ruido.
        u["musica_f0_std"] = round(max(p_(M, "f0_std", 25),
                                       p_(B, "f0_std", 90) * 1.05), 1)
        u["musica_sostenido"] = round(max(p_(M, "sostenido", 25),
                                          p_(B, "sostenido", 90) + 0.01), 4)
        u["musica_continuidad"] = round(max(p_(M, "continuidad", 25),
                                            p_(B, "continuidad", 90)), 4)
        u["musica_din_db_max"] = round(min(p_(M, "din_db", 90),
                                           p_(B, "din_db", 5) * 0.92), 2)

    ruta = ruta or RUTA_UMBRALES
    with open(ruta, "w") as fh:
        json.dump(u, fh, indent=2, ensure_ascii=False)
    return u


# -------------------------------------------------------------------- CLI --

def _cli(argv):
    if not argv:
        print(__doc__.strip().split("\n\n")[0])
        print("\nuso: voz.py <wav> [wav ...]")
        print("     voz.py --perfil <wav>        # todas las features crudas")
        print("     voz.py --calibrar --asistente a1.wav,a2.wav "
              "--bernard b1.wav --musica m1.wav")
        return 2
    if argv[0] == "--perfil":
        for r in argv[1:]:
            print(json.dumps(perfil(r), indent=2, ensure_ascii=False))
        return 0
    if argv[0] == "--calibrar":
        args = dict(zip(argv[1::2], argv[2::2]))
        u = calibrar(args.get("--asistente", "").split(",") if args.get("--asistente") else [],
                     args.get("--bernard", "").split(",") if args.get("--bernard") else [],
                     args.get("--musica", "").split(",") if args.get("--musica") else [])
        print(json.dumps(u, indent=2, ensure_ascii=False))
        return 0

    if not TIENE_PRAAT:
        print("aviso: sin parselmouth — F0 por autocorrelacion, sin "
              "jitter/shimmer/HNR. Interprete con Praat: "
              "~/.pyenv/versions/3.14.0/bin/python\n", file=sys.stderr)
    for r in argv:
        etiqueta, conf, motivos = clasificar(r)
        print(f"\n== {os.path.basename(r)}")
        print(f"   {etiqueta}  (confianza {conf:.2f})")
        for m in motivos:
            print(f"   · {m}")
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))


# ============================================================================
# INTEGRACION — NO CABLEADO A PROPOSITO. Esto es una nota, no codigo activo.
# ============================================================================
#
# Punto de enganche exacto: motor.py, en el momento en que un utterance ya se
# escribio a disco y ANTES de mandarlo al transcriptor / al registro .md — el
# mismo punto donde hoy se consulta el candado $TMPDIR/susurro-hablando.lock
# para poner la marca [BOCINA].
#
# Hay TRES niveles de evidencia, y se usan en este orden porque asi va de
# certeza a estimacion:
#
#     1. EL CANDADO ($TMPDIR/susurro-hablando.lock) -> [ASISTENTE].
#        Es un HECHO, no una medicion. Si esta, no se consulta este modulo:
#        seria cambiar una certeza por una opinion. Solo cubre MI voz.
#
#     2. LA REFERENCIA DE BOCINA (AudioTee) -> la via buena, y la que hay que
#        construir. Cubre lo que el candado nunca cubrio: la musica. Requiere
#        dejar corriendo, en paralelo a la captura del microfono:
#
#            ~/.local/bin/audiotee --sample-rate 16000 \
#              | ffmpeg -y -f s16le -ar 16000 -ac 1 -i pipe:0 referencia.wav
#
#        (receta canonica: ~/Documents/videopipe/audiotee/CAPTURE-RECIPE.md;
#         permiso TCC ya concedido; NO usar BlackHole, muerto desde jun-2026).
#        Guardando el t0 de esa captura, cada utterance sabe su offset:
#
#            from voz import clasificar_con_referencia
#            offset = t_inicio_utterance - t0_referencia
#            et, conf, mot = clasificar_con_referencia(
#                ruta_utterance, "referencia.wav", offset_ref_s=offset)
#            # et == 'BOCINA' -> salio del altavoz, sea mi voz o sea Goldfrapp
#
#        Conviene arrancarlo con `--exclude-processes <pid del propio motor>`
#        si alguna vez el motor reproduce audio, para no tapar su propia cola.
#
#     3. LA HUELLA ACUSTICA (`clasificar`) -> el respaldo, para cuando no hay
#        candado ni referencia (AudioTee caido, audio que entra por otra via,
#        ruido del cuarto o de la calle):
#
#            from voz import clasificar
#            etiqueta, conf, motivos = clasificar(ruta_utterance)
#            if etiqueta in ("ASISTENTE", "MUSICA") and conf >= 0.75:
#                marca = f"[{etiqueta}]"          # MARCAR, jamas BORRAR
#            else:
#                marca = ""                        # BERNARD e INCIERTO pasan
#
#        BERNARD e INCIERTO se tratan IGUAL a proposito: ambos pasan limpios.
#        La unica diferencia util de INCIERTO es dejar los `motivos` en el log
#        para poder auditar despues por que dudo.
#
#     4. Guardar `motivos` en el log de sesion (no en el .md legible): cuando
#        este modulo se equivoque, el motivo es lo unico que permitira
#        arreglarlo sin volver a grabar la sesion.
#
# Coste medido: ~0.35 s por utterance de 15 s con Praat. Si eso estorba al
# tiempo real, corre en el hilo de transcripcion, nunca en el de captura.
#
# AVISO sobre el interprete: motor.py corre en el conda `escucha`, donde HOY NO
# hay parselmouth. Al cablearlo hay dos caminos honestos:
#     (a) instalar parselmouth en el conda `escucha`, o
#     (b) invocar este modulo como subproceso con
#         ~/.pyenv/versions/3.14.0/bin/python voz.py <wav>
# Sin una de las dos, el modulo corre DEGRADADO (F0 por autocorrelacion) y su
# acierto medido baja — ver el reporte de calibracion.
