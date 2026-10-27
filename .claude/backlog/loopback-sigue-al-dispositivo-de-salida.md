# El loopback de la bocina debe seguir al dispositivo de salida cuando Windows lo cambia a media llamada

Status: Proposed
Proposed: 2026-10-27 by Claude (hallazgo #4 del /cruel-critic sobre el port a Windows)

## Qué es

`FuenteLoopback.arrancar()` abre el loopback WASAPI del dispositivo de salida **default en ese
momento** (`get_default_wasapi_loopback()`). Si Windows cambia el default durante la sesión
(se conectan audífonos Bluetooth, se desconectan, se enchufa un dock), Teams sigue sonando por
el dispositivo nuevo y el motor sigue oyendo el viejo: solo recibe el silencio que `frames()`
inyecta, indistinguible de «nadie habla». Fallo mudo, sin aviso (Art. 2).

## Camino canónico a reusar

- PyAudioWPatch expone `get_default_wasapi_loopback()` y `get_loopback_device_info_generator()`;
  no hay evento de cambio de endpoint. La detección barata: cada ~2 s comparar el índice/nombre
  del default con el abierto y, si difiere, cerrar y reabrir la fuente (callback mode, mismo
  patrón que hoy), avisando por `Fallos` («bocina cambió a X»).
- La detección fina sería `IMMNotificationClient` (Core Audio) vía `comtypes`; es una
  dependencia nueva y el sondeo cubre el caso real.

## Decisión de Bernard

Si vale la dependencia extra o basta el sondeo; y si el cambio de bocina debe cortar el
utterance en curso o terminarlo primero.

## Siguiente paso

Reproducir en la ThinkPad: arrancar `dictar`, conectar audífonos Bluetooth, hablar desde un
mp3 y confirmar que `[LLAMADA]` deja de salir; luego implementar el sondeo.
