// Live captions de Teams web leídos del DOM por CDP (Chrome de debug en 9333), sin npm.
// Uso: node escucha/teams_captions.mjs [--out <ruta.jsonl>] [--port 9333] [--poll 150] [--estable 900] [--parciales] [--una-vez]
// Emite una línea JSON por frase en stdout y la agrega al JSONL de --out (default %LOCALAPPDATA%\escucha\captions.jsonl):
//   {"ts":"...","t_visto":"...","t_estable_ms":N,"speaker":"Brian","text":"...","rev":0,"id":"...","fuente":"cc|transcript","target":"..."}
// Dedupe por elemento del DOM: una frase se emite cuando su texto lleva --estable ms sin cambiar o cuando aparece otra
// frase después de ella; si Teams la corrige después se vuelve a emitir con rev+1. Selectores: ver SELECTORES abajo.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg("--port", process.env.ESCUCHA_CDP_PORT || "9333"));
const POLL_MS = Number(arg("--poll", "150"));
const ESTABLE_MS = Number(arg("--estable", "900"));
const PARCIALES = process.argv.includes("--parciales");
const UNA_VEZ = process.argv.includes("--una-vez");
const OUT = arg("--out", process.env.ESCUCHA_CAPTIONS || `${process.env.LOCALAPPDATA || process.env.HOME}\\escucha\\captions.jsonl`);
const PATRON_TEAMS = /teams\.microsoft\.com|teams\.cloud\.microsoft|teams\.live\.com/;

// Selectores del DOM de Teams web (T2.1, 2026-10). Cada entrada: contenedor, fila, autor, texto. El primero que devuelve
// filas gana; "fuente" dice cuál. Los contenedores "cc*" van UNO por entrada y en orden de layout (2026 → v2 → 2024),
// como los prueba Live-Captions-Saver (Zerg00s): una lista con comas devuelve el botón Captions del toolbar, no el panel.
// Sin verificar en llamada viva; fuentes en onboarding/conocimiento/investigacion/P5-teams-live-captions-dom.md.
const SELECTORES = [
  { fuente: "cc-2026", contenedor: '[data-tid="closed-caption-renderer-wrapper"]', fila: '.fui-ChatMessageCompact, [data-tid="closed-caption-message"], [role="listitem"]', autor: '[data-tid="author"], .fui-ChatMessageCompact__author', texto: '[data-tid="closed-caption-text"], .fui-ChatMessageCompact__body' },
  { fuente: "cc-v2", contenedor: '[data-tid="closed-caption-v2-window-wrapper"]', fila: '.fui-ChatMessageCompact, [data-tid="closed-caption-message"], [role="listitem"]', autor: '[data-tid="author"], .fui-ChatMessageCompact__author', texto: '[data-tid="closed-caption-text"], .fui-ChatMessageCompact__body' },
  { fuente: "cc", contenedor: '[data-tid="closed-captions-renderer"]', fila: '.fui-ChatMessageCompact, [data-tid="closed-caption-message"], [role="listitem"]', autor: '[data-tid="author"], .fui-ChatMessageCompact__author', texto: '[data-tid="closed-caption-text"], .fui-ChatMessageCompact__body' },
  { fuente: "cc-classic", contenedor: '.ts-captions-container, [class*="closedCaptions"], [class*="closed-captions"]', fila: '.ui-chat__message, [class*="caption-item"], [class*="captionItem"]', autor: '.ui-chat__message__author, [class*="author"]', texto: '.ui-chat__message__content, [class*="caption-text"], [class*="captionText"]' },
  { fuente: "transcript", contenedor: '[data-tid="transcript-pane"], [data-tid*="transcript"], [aria-label*="Transcript" i]', fila: '[data-tid*="transcript-entry"], [data-tid*="transcript-item"], .fui-ChatMessageCompact, [role="listitem"]', autor: '[data-tid="author"], [class*="author"]', texto: '[data-tid*="text"], [class*="body"], [class*="content"]' },
  { fuente: "generico", contenedor: '[class*="ClosedCaption"], [class*="closed-caption"], [class*="LiveCaption"], [class*="live-caption"]', fila: ':scope > *', autor: '[class*="author"], [class*="Author"], [class*="speaker"]', texto: '[class*="text"], [class*="Text"], [class*="body"]' },
];

// Se instala UNA vez por documento y guarda el estado en window.__escucha; cada poll llama drenar().
const INSTALADOR = `(() => {
  if (window.__escucha && window.__escucha.v === 3) return "ya";
  const SEL = ${JSON.stringify(SELECTORES)};
  const S = { v: 3, items: new Map(), seq: 0, fuente: "" };
  const docs = () => {
    const out = [document];
    for (const f of document.querySelectorAll("iframe")) { try { if (f.contentDocument) out.push(f.contentDocument); } catch (e) {} }
    return out;
  };
  const filas = () => {
    for (const d of docs()) for (const s of SEL) {
      const cont = d.querySelector(s.contenedor);
      if (!cont) continue;
      const fs = [...cont.querySelectorAll(s.fila)].filter(f => (f.textContent || "").trim());
      if (fs.length) return { s, fs };
    }
    return null;
  };
  const txt = (el, sel) => { const e = sel ? el.querySelector(sel) : null; return ((e || el).textContent || "").replace(/\\s+/g, " ").trim(); };
  S.escanear = () => {
    const r = filas();
    if (!r) return;
    S.fuente = r.s.fuente;
    const ahora = Date.now();
    r.fs.forEach((f, i) => {
      let it = S.items.get(f);
      const autor = txt(f, r.s.autor);
      let texto = txt(f, r.s.texto);
      if (autor && texto.startsWith(autor)) texto = texto.slice(autor.length).trim();
      if (!texto) return;
      if (!it) { it = { id: "c" + (++S.seq), autor, texto, tVisto: ahora, tCambio: ahora, emitido: "", rev: -1, parcial: "" }; S.items.set(f, it); }
      else if (it.texto !== texto) { it.texto = texto; it.tCambio = ahora; if (autor) it.autor = autor; }
      it.ultima = i === r.fs.length - 1;
    });
    for (const [el] of S.items) if (!el.isConnected) { const it = S.items.get(el); if (it.emitido === it.texto || !it.texto) S.items.delete(el); else { it.desconectado = true; } }
  };
  S.drenar = (estableMs, parciales) => {
    S.escanear();
    const ahora = Date.now(), out = [];
    for (const [el, it] of S.items) {
      const estable = ahora - it.tCambio >= estableMs;
      const final = estable || !it.ultima || it.desconectado;
      if (final && it.texto !== it.emitido) {
        it.rev += 1; it.emitido = it.texto;
        out.push({ id: it.id, speaker: it.autor, text: it.texto, rev: it.rev, t_visto: it.tVisto, t_estable_ms: ahora - it.tVisto, parcial: false, fuente: S.fuente });
        if (it.desconectado) S.items.delete(el);
      } else if (parciales && !final && it.texto !== it.parcial) {
        it.parcial = it.texto;
        out.push({ id: it.id, speaker: it.autor, text: it.texto, rev: it.rev + 1, t_visto: it.tVisto, t_estable_ms: ahora - it.tVisto, parcial: true, fuente: S.fuente });
      }
    }
    return out;
  };
  window.__escucha = S;
  return "instalado";
})()`;

const log = (m) => process.stderr.write(`[captions ${new Date().toISOString().slice(11, 19)}] ${m}\n`);

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const all = await r.json();
  return all.filter(t => (t.type === "page" || t.type === "iframe") && PATRON_TEAMS.test(t.url || "") && t.webSocketDebuggerUrl);
}

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pend = new Map(); }
  abrir() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(new Error("ws: " + (e.message || "error")));
      this.ws.onclose = () => { for (const p of this.pend.values()) p.rej(new Error("ws cerrado")); this.pend.clear(); this.cerrado = true; };
      this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); const p = this.pend.get(m.id); if (!p) return; this.pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pend.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async evaluar(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  }
  cerrar() { try { this.ws.close(); } catch {} }
}

function escribir(fila) {
  const linea = JSON.stringify(fila);
  console.log(linea);
  try { mkdirSync(dirname(OUT), { recursive: true }); appendFileSync(OUT, linea + "\n"); } catch (e) { log("no pude escribir " + OUT + ": " + e.message); }
}

const vistos = new Map(); // `${target}|${id}` -> rev emitido, para no repetir si el target se reconecta
async function vigilar(t) {
  const cdp = new Cdp(t.webSocketDebuggerUrl);
  await cdp.abrir();
  await cdp.evaluar(INSTALADOR);
  log(`vigilando ${t.type} ${t.url.slice(0, 80)}`);
  let conFilas = false, n = 0;
  while (!cdp.cerrado) {
    let filas;
    try { filas = await cdp.evaluar(`JSON.stringify(window.__escucha ? window.__escucha.drenar(${ESTABLE_MS}, ${PARCIALES}) : [])`); }
    catch (e) { if (/__escucha|Cannot find context|Execution context/.test(e.message)) { try { await cdp.evaluar(INSTALADOR); } catch {} } else { log("evaluate: " + e.message); } await espera(POLL_MS); continue; }
    for (const f of JSON.parse(filas)) {
      const k = `${t.id}|${f.id}|${f.parcial ? "p" : "f"}`;
      if (!f.parcial && vistos.get(k) === f.rev) continue;
      vistos.set(k, f.rev);
      conFilas = true; n++;
      escribir({ ts: new Date().toISOString(), target: t.id, ...f, t_visto: new Date(f.t_visto).toISOString() });
    }
    if (UNA_VEZ && conFilas) break;
    await espera(POLL_MS);
  }
  cdp.cerrar();
  return n;
}

const espera = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  log(`salida: ${OUT} · poll ${POLL_MS} ms · estable ${ESTABLE_MS} ms · parciales ${PARCIALES}`);
  const activos = new Map();
  for (;;) {
    let ts = [];
    try { ts = await targets(); } catch (e) { log(`9333 no contesta (${e.message}); reintento en 3 s`); await espera(3000); continue; }
    if (!ts.length && !activos.size) log("sin pestaña de Teams en el Chrome de debug; abre teams.microsoft.com ahí (reintento en 3 s)");
    for (const t of ts) {
      if (activos.has(t.id)) continue;
      activos.set(t.id, vigilar(t).catch(e => log(`target ${t.id}: ${e.message}`)).finally(() => activos.delete(t.id)));
    }
    if (UNA_VEZ && activos.size) { await Promise.all(activos.values()); return; }
    await espera(3000);
  }
}

main().catch(e => { log("fatal: " + e.message); process.exit(1); });
