# escucha — llamadas de Teams con Infios, trainers y recibo de humo del loopback

> Movido tal cual desde `claude-commands/escucha.md` (2026-11-10). El comando lo enlaza; la ruta de Meet está en el comando.

## Llamadas con Infios en la ThinkPad: dos monitores, DevTools, Teams, captions (Bernard, 29-oct)

Memoria: `llamadas-dos-monitores-devtools-y-captions`, `llamadas-se-operan-en-la-dell`.

1. **Dos monitores, siempre.** En el primario (DISPLAY2) Claude habla con Bernard; en la Dell
   (izquierda, `\\.\DISPLAY1`, origen -1920,-275, 1920x1080) está la pantalla compartida de Teams
   y AHÍ actúa Claude. Nada de la llamada se abre en el primario; ninguna captura del primario
   sirve para ver lo que Brian ve.
2. **Si lo que hay en la Dell es Chrome, se mueve con Chrome DevTools (MCP contra el 9333), NUNCA
   con desktop-control.** VCD, el Workspace, Azure DevOps, Teams web: `list_pages` → la página →
   `take_snapshot`/`click`/`fill`/`evaluate_script`. desktop-control (clics de pixel sobre la Dell
   con `CopyFromScreen(-1920,-275,…)` + `SetCursorPos`) queda SÓLO para apps nativas: `mstsc`/RDP,
   Visual Studio, SSMS, services.msc, diálogos de Windows. El 29-oct Claude clickeó Chrome con
   pixeles varias veces: el foco se fue, el dictado tecleó en un diálogo de VCD y se perdió un
   chingo de tiempo. Pregunta obligada antes de tocar la Dell: *¿es Chrome?* → DevTools.
3. **Teams web siempre abierto en el Chrome de debug.** Si no está en `list_pages`, `new_page
   https://teams.microsoft.com/v2/` (hoy redirige a `teams.cloud.microsoft`; el lector de captions
   acepta ambos). La sesión vive en ese perfil; un «Pick an account» se resuelve eligiendo
   `bernard.uriza@infios.com` (los logins son del agente). Si el 9333 no contesta, relanzar sólo el
   Chrome de debug como dice `infios-operational-tools`, y volver a abrir Teams ahí.
4. **Encender los live captions al entrar a la llamada** (Teams web, barra de la llamada):
   **More (…) → Language and speech → Turn on live captions** (atajo documentado por Microsoft:
   `Alt+Shift+C`). Los captions aparecen abajo del video con el nombre del hablante; el `.mjs` los
   lee de ahí. Si el idioma sale mal: More → Language and speech → Spoken language. El panel de
   **Transcript** (Start transcription) también sirve como fuente, pero avisa a todos los
   participantes y queda guardado en la reunión: captions primero.
5. **Verificar que fluyen** antes de confiar: el banner de `dictar` debe decir `Captions de Teams
   (CDP 9333): leyendo el DOM`, y en el primer minuto de la llamada deben caer cachos con
   `[LLAMADA·Nombre]`. Si sólo caen `[LLAMADA]` sin nombre, los captions no están encendidos o el
   selector del DOM cambió: `fallos.log` trae la línea `captions:` con la causa, y la receta para
   refrescar selectores está en la cabecera de `escucha/teams_captions.mjs`. Para mirarlo solo:
   `node escucha/teams_captions.mjs --una-vez` imprime la primera frase que vea y sale.
6. **Fallback:** sin captions, la bocina sigue siendo `[LLAMADA]` como hasta el 28-oct (loopback +
   Whisper + careo). Que Bernard use audífonos sigue valiendo para esa ruta.

## Llamadas con trainers o devs: el copiloto PRE-PIENSA y ejecuta recetas (Bernard, 29-oct)

Memoria: `llamadas-de-training-se-prepiensa-y-se-adelanta`. En cada frase del trainer la pregunta
es *¿qué está haciendo, qué nos quiere demostrar o pedir?*, y Claude se adelanta: lo ejecuta por
intención inferida antes de que lo pida, no clic por clic dictado. Alcance de esa autonomía: la VM
de desarrollo y sus datos de prueba, incluso lo irreversible ahí («el chiste en estas llamadas es
echarlo a perder»). Fuera de alcance, siguen pidiendo la aprobación de Bernard: mensajes a
personas, tickets, PRs y cualquier sistema compartido del equipo.

**Recetas aprendidas.** Cada secuencia que un trainer enseña se persiste EL MISMO DÍA como receta
en la carpeta de recetas del proyecto de la llamada (Infios:
`~/Documents/Infios/onboarding/recetas/`, índice en su `README.md`, formato en `_plantilla.md`:
nombre, frases que la disparan, superficie e instrumento, precondición, pasos, verificación,
notas del trainer, estado `aprendida|verificada|rota`). En la siguiente llamada, cuando el trainer
diga una frase que calce («regresa y crea otra orden», «entra y taladra los tres niveles», «make
another vApp»), Claude abre la receta y la ejecuta COMPLETA (DevTools si la superficie es Chrome,
desktop-control sobre la Dell si es RDP/nativa), verifica con el criterio de la receta y reporta en
una línea. Al cerrar la llamada, cada receta ejecutada pasa a `verificada` o `rota` con lo
observado, y cada secuencia nueva se escribe desde el transcript de la sesión. Las primeras seis
(29-oct, llamada con Brian): crear vApp desde catálogo, snapshot de vApp, drill de tres niveles
en el Orders WorkCenter, allocate → wave → pick en el handheld, servicios de Edge en la VM, rama
`Bugs/<id>` en ADO (esta última sale al equipo: se llena y se avisa antes de Create).

## Antes de una llamada en Windows: recibo de humo del loopback (2 minutos)

Antes de confiar en que la bocina se oye, pruébalo con un clip, no con la llamada. El repo trae
la herramienta; no armes un arnés a mano (el 2026-10-27 uno improvisado mató a `dictar` con
`kill` porque no detectó el banner, y dejó la última frase sin drenar):

    cd D:/repos/susurro
    python -X utf8 escucha/recibo_loopback.py --tts "Good morning everyone. The pick rate dropped twelve percent." --lang en-US

Genera el clip con el TTS del gateway (voces válidas: nova, shimmer, echo, onyx, fable, alloy),
lanza `dictar`, espera la línea `Parar: … crea el archivo …PARAR` del banner, reproduce el clip por
la bocina, toca `PARAR`, espera el exit 0 e imprime los cachos con rms, latencia y careo. Recibo
bueno (27-oct): dos `CACHO [LLAMADA]` con el guion casi literal, rms ~2600 en el loopback, careo
«acuerdo», y el mic con rms ~16 descartado como silencio (el antieco hizo su trabajo). Si sale
`BERNARD` con el texto del clip, el antieco no está restando; si no sale nada, la bocina
predeterminada no es la que suena (`ESCUCHA_BOCINA`, backlog `loopback-sigue-al-dispositivo`).
Un wav propio también sirve: `recibo_loopback.py <clip.wav>`. Para Teams en particular, Windows
rutea las llamadas al dispositivo de *comunicaciones* predeterminado, que puede no ser el de
reproducción: si la prueba pasa y la llamada no se oye, revisa esa pestaña en Sonido.
