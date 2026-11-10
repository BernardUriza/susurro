// node --test escucha/test_meet_captions.mjs  (fixtures use invented sentences only)
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { PAGE_EXPR, Tracker, Presencia, formatear } from "./meet_captions.mjs";

const blk = (k, s, t) => ({ k, s, t });
const texto = (evs, speaker) => evs.filter((e) => !speaker || e.speaker === speaker).map((e) => e.text).join(" ");

function correr(pasos, opts) {
  const tr = new Tracker(opts);
  const evs = [];
  for (const [t, blocks] of pasos) for (const e of tr.feed(blocks, t).events) evs.push({ ...e, t });
  return evs;
}

test("the November rewrite sequence emits each utterance once, nothing lost", () => {
  const A = (t) => blk("b1", "Ana", t);
  const pasos = [
    [0, [A("The November.")]],
    [250, [A("The November. Yes.")]],
    [500, [A("The November. Yes, let")]],
    [750, [A("The November. Yes, let me share")]],
    [1000, [A("The November. Yes, let me share the sessions list. Can you")]],
    [1250, [A("The November. Yes, let me share the sessions list. Can you confirm the status?")]],
    [1500, [A("The November. Yes, let me share the sessions list. Can you confirm the status?")]],
    [1750, [A("The November. Yes, let me share the sessions list. Can you confirm the status?"), blk("b2", "You", "Sure.")]],
    [3500, [A("The November. Yes, let me share the sessions list. Can you confirm the status?"), blk("b2", "You", "Sure.")]],
  ];
  const evs = correr([[-1, []], ...pasos]);
  const ana = texto(evs, "Ana");
  assert.equal(ana, "The November. Yes, let me share the sessions list. Can you confirm the status?");
  assert.equal(evs.filter((e) => e.speaker === "Ana").length, 3);
  assert.equal(texto(evs, "You"), "Sure.");
  assert.ok(ana.includes("sessions") && (ana.match(/s/g) || []).length >= 9);
});

test("a question is emitted after questionMs, not after the full stability window", () => {
  const tr = new Tracker({ stableMs: 2500, questionMs: 350 });
  tr.feed([], 0);
  const A = (t) => blk("b1", "Ana", t);
  assert.equal(tr.feed([A("Bernard, can you walk us through the pagination fix?")], 1000).events.length, 0);
  assert.equal(tr.feed([A("Bernard, can you walk us through the pagination fix?")], 1250).events.length, 0);
  const e = tr.feed([A("Bernard, can you walk us through the pagination fix?")], 1350).events;
  assert.equal(e.length, 1);
  assert.match(formatear(1, e[0], { d: new Date(0) }), /→TI$/);
});

test("Meet rewriting punctuation/casing and trimming the start never re-emits a prefix", () => {
  const A = (t) => blk("b1", "Ana", t);
  const evs = correr([
    [0, []],
    [100, [A("we shipped the report yesterday and then")]],
    [1500, [A("we shipped the report yesterday and then")]],
    [1600, [A("We shipped the report yesterday, and then the team")]],
    [1700, [A("the report yesterday, and then the team fixed two bugs")]],
    [3000, [A("the report yesterday, and then the team fixed two bugs")]],
  ]);
  assert.equal(texto(evs), "we shipped the report yesterday and then the team fixed two bugs");
});

test("a recreated DOM node for the same speaker continues the old block", () => {
  const evs = correr([
    [0, []],
    [100, [blk("b1", "Ana", "Let us start with the budget review for the quarter.")]],
    [200, [blk("b9", "Ana", "Let us start with the budget review for the quarter. First item is hiring")]],
    [1800, [blk("b9", "Ana", "Let us start with the budget review for the quarter. First item is hiring")]],
  ]);
  assert.equal(texto(evs), "Let us start with the budget review for the quarter. First item is hiring");
});

test("a block that vanishes is flushed once", () => {
  const evs = correr([
    [0, []],
    [100, [blk("b1", "Ana", "One thing before we close"), blk("b2", "You", "ok")]],
    [200, [blk("b2", "You", "ok")]],
    [300, [blk("b2", "You", "ok")]],
  ]);
  assert.equal(texto(evs, "Ana"), "One thing before we close");
});

test("backlog on first sight: zero events, one count, later growth still emits", () => {
  const tr = new Tracker();
  const viejo = Array.from({ length: 24 }, (_, i) => blk("o" + i, "Ana", "Invented backlog sentence number " + i + "."));
  const r = tr.feed(viejo, 0);
  assert.equal(r.events.length, 0);
  assert.equal(r.backlog, 24);
  const nuevo = [...viejo, blk("n1", "Luis", "Fresh words arrive now.")];
  assert.equal(tr.feed(nuevo, 100).events.length, 0);
  assert.equal(tr.feed(nuevo, 1400).events.length, 1);
});

test("a long block is split into sentence-sized events with no loss", () => {
  const oraciones = Array.from({ length: 14 }, (_, i) => "Sentence number " + i + " talks about the invented rollout plan in detail.");
  const largo = oraciones.join(" ");
  const evs = correr([[0, []], [100, [blk("b1", "Ana", largo), blk("b2", "You", "Right.")]]], { maxChars: 220 });
  assert.ok(evs.length >= 3);
  assert.ok(evs.every((e) => e.text.length <= 260));
  assert.equal(texto(evs, "Ana"), largo);
});

test("page-side expression keeps every s and has no backslash", () => {
  assert.equal(PAGE_EXPR.includes(String.fromCharCode(92)), false);
  const el = (innerText) => ({ innerText });
  const bloque = { children: [{}, {}], querySelector: () => el("Sam"), lastElementChild: el("Sessions of this " + String.fromCharCode(10) + "class pass tests"), getAttribute: () => null };
  const region = { children: [bloque] };
  const ctx = {
    document: { querySelector: (s) => (s.includes("Captions") ? region : null), querySelectorAll: () => [] },
    location: { href: "https://meet.google.com/abc-defg-hij" },
  };
  ctx.window = ctx;
  const r = vm.runInNewContext(PAGE_EXPR, ctx);
  assert.equal(r.blocks[0].t, "Sessions of this class pass tests");
  assert.equal(r.blocks[0].s, "Sam");
  assert.equal(r.blocks[0].k, "b1");
});

test("presence: FIN when the call ends, waiting in the lobby", () => {
  const p = new Presencia({ graceMs: 6000 });
  const url = "https://meet.google.com/abc-defg-hij";
  assert.equal(p.step({ url, leave: false, blocks: null }, 0), "ESPERANDO");
  assert.equal(p.step({ url, leave: true, blocks: [] }, 1000), "OK");
  assert.equal(p.step({ url, leave: false, blocks: null }, 2000), "OK");
  assert.equal(p.step({ url, leave: false, blocks: null }, 9000), "FIN");
  assert.equal(new Presencia().step({ url, leave: true, blocks: [] }, 0), "OK");
  const q = new Presencia();
  q.step({ url, leave: true, blocks: [] }, 0);
  assert.equal(q.step({ url: "https://meet.google.com/landing", leave: false, blocks: null }, 100), "FIN");
});
