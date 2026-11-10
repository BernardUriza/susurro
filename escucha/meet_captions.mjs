// Live captions de Google Meet leidos del DOM por CDP (Chrome de debug, 9222), sin npm: node escucha/meet_captions.mjs [--out f] [--port 9222] [--detectar] [--una-vez]
// Env MEET_POLL_MS 250, MEET_STABLE_MS 1200, MEET_Q_MS 350, MEET_MAX_CHARS 220, MEET_NAMES bernard; salida `CACHO n [HH:MM ET · Quien]: texto`.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

// Page-side code: no backslashes anywhere (a template literal ate "\s" once and every "s" vanished).
export const PAGE_EXPR = `(() => {
  const nl = String.fromCharCode(10);
  const flat = s => (s || '').split(nl).join(' ').split(' ').filter(Boolean).join(' ');
  const q = sel => document.querySelector(sel);
  const region = q('[role="region"][aria-label="Captions"]') || q('[role="region"][aria-label="Subtítulos"]');
  const leave = !!(q('[aria-label*="Leave call"]') || q('[aria-label*="Salir de la llamada"]'));
  let capBtn = '';
  for (const b of document.querySelectorAll('button[aria-label]')) {
    const l = (b.getAttribute('aria-label') || '').toLowerCase();
    if (l.startsWith('turn on captions') || l.startsWith('activar subtítulos') || l.startsWith('activar los subtítulos')) { capBtn = l; break; }
  }
  let blocks = null;
  if (region) {
    blocks = [];
    for (const b of region.children) {
      const n = b.querySelector('span');
      const t = b.children.length >= 2 ? b.lastElementChild : null;
      if (!n || !t) continue;
      if (!b.__cid) b.__cid = 'b' + (window.__cidSeq = (window.__cidSeq || 0) + 1);
      blocks.push({ k: b.__cid, s: flat(n.innerText), t: flat(t.innerText) });
    }
  }
  return { url: location.href, leave, capBtn, blocks };
})()`;

export const CLICK_CAPTIONS_EXPR = `(() => {
  for (const b of document.querySelectorAll('button[aria-label]')) {
    const l = (b.getAttribute('aria-label') || '').toLowerCase();
    if (l.startsWith('turn on captions') || l.startsWith('activar subtítulos') || l.startsWith('activar los subtítulos')) { b.click(); return l; }
  }
  return '';
})()`;

const norm = (w) => [...w.toLowerCase()].filter((c) => /[\p{L}\p{N}']/u.test(c)).join("");
const endsSentence = (w) => /[.?!]["')\]]*$/.test(w);
const endsQuestion = (w) => /[?]["')\]]*$/.test(w);
const TAIL_N = 6;
const RE_REUNION = /meet[.]google[.]com[/][a-z]{3}-[a-z]{4}-[a-z]{3}/;

// Words -> events: one per sentence run up to maxChars; a question always closes its group.
function agrupar(words, maxChars) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) { out.push(cur.join(" ")); cur = []; } };
  for (const w of words) {
    if (cur.length && cur.join(" ").length + 1 + w.length > maxChars) flush();
    cur.push(w);
    if (endsQuestion(w)) flush();
    else if (endsSentence(w) && cur.join(" ").length >= maxChars * 0.6) flush();
  }
  flush();
  return out;
}

// Identity is the DOM-stamped id; progress is the normalised tail of what was emitted, so Meet
// rewriting punctuation, casing or the start of a block never re-emits a prefix nor loses new words.
export class Tracker {
  constructor({ stableMs = 1200, questionMs = 350, maxChars = 220, nombres = [] } = {}) {
    Object.assign(this, { stableMs, questionMs, maxChars, nombres });
    this.recs = new Map();
    this.first = true;
  }

  static pos(rec, words) {
    if (!rec.tail.length) return 0;
    const nw = words.map(norm);
    for (let len = Math.min(rec.tail.length, TAIL_N); len >= (rec.tail.length >= 2 ? 2 : 1); len--) {
      const tail = rec.tail.slice(-len);
      let best = -1;
      for (let i = len; i <= nw.length; i++) {
        if (tail.every((t, j) => nw[i - len + j] === t) && (best < 0 || Math.abs(i - rec.count) < Math.abs(best - rec.count))) best = i;
      }
      if (best >= 0) return best;
    }
    return Math.min(rec.count, words.length);
  }

  take(rec, words, upto) {
    const start = Tracker.pos(rec, words);
    const slice = words.slice(start, upto);
    if (!slice.length) return [];
    rec.count = start + slice.length;
    rec.tail = words.slice(0, rec.count).map(norm).filter(Boolean).slice(-TAIL_N);
    return agrupar(slice, this.maxChars).map((text) => ({ speaker: rec.speaker, text, id: rec.k }));
  }

  ready(rec, words, closed, now) {
    const start = Tracker.pos(rec, words);
    const pend = words.slice(start);
    if (!pend.length) return start;
    if (closed) return words.length;
    let cut = start;
    for (let i = 0; i < pend.length - 1; i++) if (endsSentence(pend[i])) cut = start + i + 1;
    const quiet = now - rec.changed;
    const aTi = this.nombres.some((x) => x && pend.join(" ").toLowerCase().includes(x));
    if ((endsQuestion(pend[pend.length - 1]) || (aTi && endsSentence(pend[pend.length - 1]))) && quiet >= this.questionMs) return words.length;
    if (quiet >= this.stableMs) return words.length;
    return cut;
  }

  feed(blocks, now) {
    const events = [];
    if (this.first) {
      this.first = false;
      for (const b of blocks) {
        const words = b.t.split(" ").filter(Boolean);
        this.recs.set(b.k, { k: b.k, speaker: b.s, text: b.t, changed: now, count: words.length, tail: words.map(norm).filter(Boolean).slice(-TAIL_N) });
      }
      return { events, backlog: blocks.length };
    }
    const gone = [...this.recs.values()].filter((r) => !blocks.some((b) => b.k === r.k));
    for (const b of blocks.filter((x) => !this.recs.has(x.k))) {
      const nw = b.t.split(" ").map(norm);
      const old = gone.find((r) => r.speaker === b.s && r.text && r.text.split(" ").map(norm).filter(Boolean).slice(-3).every((t) => nw.includes(t)));
      if (old) { this.recs.delete(old.k); gone.splice(gone.indexOf(old), 1); this.recs.set(b.k, { ...old, k: b.k, text: "", changed: now }); }
    }
    blocks.forEach((b, i) => {
      let rec = this.recs.get(b.k);
      if (!rec) { rec = { k: b.k, speaker: b.s, text: "", changed: now, count: 0, tail: [] }; this.recs.set(b.k, rec); }
      if (rec.text !== b.t) { rec.text = b.t; rec.changed = now; }
      rec.speaker = b.s;
      const words = b.t.split(" ").filter(Boolean);
      events.push(...this.take(rec, words, this.ready(rec, words, i < blocks.length - 1, now)));
    });
    for (const rec of gone) {
      const words = rec.text.split(" ").filter(Boolean);
      events.push(...this.take(rec, words, words.length));
      this.recs.delete(rec.k);
    }
    return { events, backlog: 0 };
  }
}

// Joined once a region or the leave button was seen; FIN after graceMs without either, or when the URL leaves the meeting.
export class Presencia {
  constructor({ graceMs = 6000, lobbyMs = 600000 } = {}) { Object.assign(this, { graceMs, lobbyMs }); this.joined = false; this.lostAt = null; this.t0 = null; }
  step(snap, now) {
    this.t0 ??= now;
    const enReunion = RE_REUNION.test(snap.url || "");
    if (enReunion && (snap.leave || snap.blocks !== null)) { this.joined = true; this.lostAt = null; return "OK"; }
    if (this.joined) {
      this.lostAt ??= now;
      return !enReunion || now - this.lostAt >= this.graceMs ? "FIN" : "OK";
    }
    return now - this.t0 > this.lobbyMs ? "FIN" : "ESPERANDO";
  }
}

export const hhmmET = (d = new Date()) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(d);

export function formatear(n, ev, { nombres = ["bernard"], d = new Date() } = {}) {
  const aTi = ev.speaker !== "You" && (endsQuestion(ev.text.trim()) || nombres.some((x) => x && ev.text.toLowerCase().includes(x)));
  return `CACHO ${n} [${hhmmET(d)} ET · ${ev.speaker}]: ${ev.text}${aTi ? " →TI" : ""}`;
}

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg("--port", process.env.MEET_CDP_PORT || "9222"));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pend = new Map(); this.cerrado = false; }
  abrir() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error("ws error"));
      this.ws.onclose = () => { this.cerrado = true; for (const p of this.pend.values()) p(null); this.pend.clear(); };
      this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); const p = this.pend.get(m.id); if (p) { this.pend.delete(m.id); p(m); } };
    });
  }
  async evaluar(expression) {
    const id = ++this.id;
    const r = await Promise.race([
      new Promise((res) => { this.pend.set(id, res); this.ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } })); }),
      esperar(5000).then(() => null),
    ]);
    return r?.result?.result?.value ?? null;
  }
  cerrar() { try { this.ws.close(); } catch { /* ya cerrado */ } }
}

async function pestanas() {
  const all = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  return all.filter((t) => t.type === "page" && /meet[.]google[.]com/.test(t.url) && t.webSocketDebuggerUrl);
}

async function detectar() {
  let ts;
  try { ts = await pestanas(); } catch { console.log(`SIN-CHROME: el ${PORT} no contesta`); return 2; }
  if (!ts.length) { console.log("SIN-MEET"); return 1; }
  for (const t of ts) {
    const cdp = new Cdp(t.webSocketDebuggerUrl);
    await cdp.abrir();
    const s = await cdp.evaluar(PAGE_EXPR);
    cdp.cerrar();
    const dentro = !!s && RE_REUNION.test(s.url) && (s.leave || s.blocks !== null);
    console.log(`MEET ${t.id} ${dentro ? "EN-LLAMADA" : "SIN-LLAMADA"} captions=${s?.blocks ? "on" : s?.capBtn ? "off" : "?"} ${t.url.split("?")[0]}`);
  }
  return 0;
}

async function main() {
  if (process.argv.includes("--detectar")) return detectar();
  const OUT = arg("--out", `${process.env.LOCALAPPDATA || process.env.HOME}/escucha/meet_captions.txt`);
  const POLL = Number(process.env.MEET_POLL_MS || 250);
  const nombres = (process.env.MEET_NAMES || "bernard").toLowerCase().split(",").map((x) => x.trim());
  const una = process.argv.includes("--una-vez");
  const tracker = new Tracker({ stableMs: Number(process.env.MEET_STABLE_MS || 1200), questionMs: Number(process.env.MEET_Q_MS || 350), maxChars: Number(process.env.MEET_MAX_CHARS || 220), nombres });
  const pres = new Presencia();
  mkdirSync(dirname(OUT), { recursive: true });
  const escribir = (l, consola = true) => { if (consola) console.log(l); try { appendFileSync(OUT, l + "\n"); } catch { /* el stdout sigue */ } };
  let ts = [];
  try { ts = await pestanas(); } catch { console.log(`MURIO: el ${PORT} no contesta`); return 2; }
  const t = ts.find((x) => RE_REUNION.test(x.url)) || ts[0];
  if (!t) { console.log(`MURIO: no hay pestaña de Meet en el ${PORT}`); return 2; }
  const cdp = new Cdp(t.webSocketDebuggerUrl);
  await cdp.abrir();
  console.log(`Captions de Meet (CDP ${PORT}): leyendo el DOM · poll ${POLL} ms · salida ${OUT}`);
  let n = 0, avisado = false, intentoOn = 0, sinRegion = null;
  for (;;) {
    const snap = cdp.cerrado ? null : await cdp.evaluar(PAGE_EXPR);
    const now = Date.now();
    if (!snap) { escribir("FIN: se cerró la pestaña de Meet"); return 0; }
    if (pres.step(snap, now) === "FIN") { escribir("FIN: la llamada terminó o saliste de la reunión"); cdp.cerrar(); return 0; }
    if (snap.blocks === null && snap.leave) {
      sinRegion ??= now;
      if (snap.capBtn && now - intentoOn > 4000) {
        intentoOn = now;
        escribir((await cdp.evaluar(CLICK_CAPTIONS_EXPR)) ? "captions estaban apagados: los encendí" : "⚠ captions apagados y no hallé el botón; presiona c en Meet");
      } else if (!snap.capBtn && !avisado && now - sinRegion > 8000) {
        avisado = true;
        escribir("⚠ no veo la región de captions (¿apagados?); presiona c en Meet");
      }
    } else { sinRegion = null; }
    if (snap.blocks) {
      avisado = false;
      const { events, backlog } = tracker.feed(snap.blocks, now);
      if (backlog) {
        for (const b of snap.blocks) escribir(`# backlog [${b.s}]: ${b.t}`, false);
        console.log(`BACKLOG ${backlog} bloques ya en pantalla → ${OUT} (no se re-emiten)`);
      }
      for (const ev of events) escribir(formatear(++n, ev, { nombres }));
      if (una && n) return 0;
    }
    await esperar(POLL);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c ?? 0), (e) => { console.log("MURIO: " + e.message); process.exit(1); });
}
