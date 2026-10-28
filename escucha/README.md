# escucha — motor de escucha local (Mac y Windows)

Captura el micrófono (y en Windows también la bocina), corta por VOZ (frases completas,
~500 ms de silencio tras hablar, nunca rebanadas de reloj) y transcribe cada frase por el
**Susurro Gateway** (`https://sus.bernarduriza.com`, whisper). Cada frase sale por stdout como
`CACHO n: texto`; lo que dice el interlocutor de una llamada sale como `CACHO n [LLAMADA]: texto`.
Es la SSOT de captura de voz: ninguna otra grabadora se escribe a mano (Art. 6).

El consumidor normal es el comando `/escucha` de Claude Code (modo dictado y modo copiloto de
llamadas). Este README es la receta de instalación para una máquina nueva; el detalle de diseño
y las mediciones viven en la sección 3 del `CLAUDE.md` raíz.

## Instalación

### Windows (ThinkPad, rayo9, …)

Todo desde PowerShell en el clon del repo (`git clone https://github.com/BernardUriza/susurro`;
es público, no hace falta invite).

```powershell
winget install Gyan.FFmpeg            # el motor lo encuentra aunque la shell no recargue PATH
winget install OpenJS.NodeJS.LTS      # para el VAD RNNoise (sin Node el motor avisa una vez y sigue)
python -m pip install --user -e .     # trae PyAudioWPatch, pywebrtc-audio y sherpa-onnx (sólo win32)
```

Primera corrida: descarga el modelo local Parakeet (~640 MB) a `~/.cache/susurro/modelos/` en un
hilo; mientras tanto el gateway transcribe solo. `dictar.exe` cae en
`%APPDATA%\Python\Python3xx\Scripts`; si no está en PATH usa `python -m escucha.dictar`.

### Mac

```bash
conda env create -f escucha/environment.yml   # instala editable y deja `dictar` en ~/.local/bin
```

En la Mac el primer tier es `hear` (local, es-MX) y el gateway es el respaldo; no hay loopback.

## Llave del gateway (una por máquina)

Cada máquina necesita su propia llave; **no** uses el token público de `/docs` (50 requests/día,
se agota en una junta). Bernard crea un claim en `https://sus.bernarduriza.com/admin`
("Onboard a new app", nombre `<maquina>-escucha`) y manda el link; en la máquina:

```bash
bash susurro-claim.sh "https://sus.bernarduriza.com/claim#claim-xxxx" <maquina>-escucha
```

(`susurro-claim.sh` vive en `BernardUriza/claude-scripts`.) Escribe el token en
`~/.secrets/susurro-token.txt`; el motor también acepta `susurro-gateway-key.txt` y
`susurro-key-<app>.txt`. El link se quema al primer uso. Verifica en `/admin` que la llave
acumule requests al primer cacho.

## Correr

```powershell
# Windows (cp1252 se ahoga con los emojis sin -X utf8)
$env:ESCUCHA_LANG="en-US"; python -X utf8 -u -m escucha.dictar <etiqueta>
```

```bash
# Mac
ESCUCHA_LANG=en-US dictar <etiqueta>
```

Etiqueta de llamada real: `<empresa>-<contacto>-<ronda>`. Para **parar** desde otro proceso
crea el archivo `PARAR` dentro de la carpeta de sesión (el banner dice la ruta); nunca `kill`,
se pierde la última frase. Los artefactos de la sesión: transcript `.md`, `registro.jsonl`
(cada utterance con origen, rms, latencia, careo y los descartes con su motivo) y los wav.

| variable | default | para qué |
|---|---|---|
| `ESCUCHA_LANG` | `es-MX` | idioma del STT (`en-US` para llamadas gringas) |
| `ESCUCHA_BOCINA` | `1` en Windows | loopback WASAPI de la bocina (`0` si suena música o TTS) |
| `ESCUCHA_AEC` | `1` | antieco WebRTC sobre el mic |
| `ESCUCHA_VAD` | `1` | noise gate RNNoise antes del STT |
| `ESCUCHA_ECO_ESPERA_S` | `3` | cuánto espera un cacho del mic a su gemelo `[LLAMADA]` antes de pasar |
| `SUSURRO_GATEWAY` | `https://sus.bernarduriza.com` | otro gateway |

## Antes de una llamada en Windows: prueba de humo (2 min)

```powershell
python -X utf8 escucha/recibo_loopback.py --tts "Good morning everyone. The pick rate dropped twelve percent." --lang en-US
```

Bueno: dos `CACHO [LLAMADA]` casi literales y el mic descartado como silencio. Si sale `BERNARD`
con el texto del clip, el antieco no resta; si no sale nada, la bocina predeterminada no es la que
suena. Teams rutea las llamadas al dispositivo de *comunicaciones* predeterminado, que puede ser
otro: revisa esa pestaña en Sonido.

## Si algo sale mal

- **La misma frase sale dos veces, una `[LLAMADA]` y otra sin etiqueta.** Bocinas abiertas: el
  interlocutor entra por loopback y por mic. Desde `c2a4fed` el filtro de eco textual
  (`eco.py`) descarta la copia del mic (`motivo=eco` en `registro.jsonl`). Audífonos lo evitan
  de raíz.
- **`¡Gracias!` / `Thank you.` / `Bye.` solos.** Alucinación de whisper sobre casi-silencio; el
  RMS mínimo, el VAD y el careo con Parakeet los tiran. Si pasan muchos, revisa `registro.jsonl`.
- **`gateway whisper: HTTP 429`.** Llave agotada o token público. Pide claim propio.
- **Emojis rotos o `UnicodeEncodeError`.** Falta `-X utf8`.
- **No aparece `[LLAMADA]` en Teams.** Dispositivo de comunicaciones distinto al de reproducción
  (arriba), o `ESCUCHA_BOCINA=0`.

## Tests

```bash
cd escucha && PYTHONUTF8=1 python -m unittest test_motor_corte test_lexico test_loopback test_careo test_antieco test_vad test_eco
```
