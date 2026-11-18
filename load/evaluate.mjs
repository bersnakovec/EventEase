// Vrednotenje obremenitvenega testa (naloga 4).
// Prebere rezultati.jtl (CSV iz JMetra) in docker-stats.csv ter izpiše metrike po nivojih
// in preveri kriterije sprejemljivosti: p95 < 500 ms in delež napak < 1 % (v ustaljenem stanju).
//
// Uporaba: node load/evaluate.mjs <mapa-rezultatov>
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const P95_LIMIT_MS = 500;
const ERROR_LIMIT_PCT = 1;

const dir = process.argv[2];
if (!dir) {
  console.error("Uporaba: node load/evaluate.mjs <mapa-rezultatov>");
  process.exit(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : NaN;

function stats(samples) {
  const el = samples.map((s) => Number(s.elapsed)).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.success !== "true").length;
  const ts = samples.map((s) => Number(s.timeStamp));
  const spanS = ts.length > 1 ? (Math.max(...ts) - Math.min(...ts)) / 1000 : 0;
  return {
    n: samples.length,
    errPct: samples.length ? (100 * errors) / samples.length : 0,
    avg: el.length ? el.reduce((a, b) => a + b, 0) / el.length : NaN,
    p50: percentile(el, 50),
    p90: percentile(el, 90),
    p95: percentile(el, 95),
    p99: percentile(el, 99),
    max: el.at(-1),
    rps: spanS ? samples.length / spanS : NaN,
  };
}

const fmt = (s) =>
  [s.n, s.errPct.toFixed(2) + " %", s.avg.toFixed(0), s.p50, s.p90, s.p95, s.p99, s.max, s.rps.toFixed(1)]
    .map(String);

function table(title, rows) {
  const head = ["Skupina", "Vzorci", "Napake", "Povp. ms", "p50", "p90", "p95", "p99", "Max", "zahtevkov/s"];
  const all = [head, ...rows];
  const w = head.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  console.log(`\n${title}`);
  for (const [k, r] of all.entries()) {
    console.log(r.map((c, i) => c.padEnd(w[i])).join("  "));
    if (k === 0) console.log(w.map((n) => "-".repeat(n)).join("  "));
  }
}

const samples = parseCsv(readFileSync(join(dir, "rezultati.jtl"), "utf8"));
const load = samples.filter((s) => s.label.startsWith("Nivo"));
const levels = [...new Set(load.map((s) => s.label.split(" | ")[0]))].sort();

// Celotni nivo (vključno z ramp-up) in po posameznih zahtevkih
const fullRows = [];
for (const lvl of levels) {
  const inLvl = load.filter((s) => s.label.startsWith(lvl + " |"));
  fullRows.push([lvl + " (vse)", ...fmt(stats(inLvl))]);
  for (const label of [...new Set(inLvl.map((s) => s.label))].sort())
    fullRows.push(["  " + label.split(" | ")[1], ...fmt(stats(inLvl.filter((s) => s.label === label)))]);
}
table("Metrike po nivojih (celoten nivo, vključno z ramp-up)", fullRows);

// Ustaljeno stanje = vzorci, ko so bile aktivne vse niti nivoja
const verdicts = [];
const steadyRows = [];
for (const lvl of levels) {
  const inLvl = load.filter((s) => s.label.startsWith(lvl + " |"));
  const maxThreads = Math.max(...inLvl.map((s) => Number(s.grpThreads)));
  const steady = inLvl.filter((s) => Number(s.grpThreads) === maxThreads);
  const st = stats(steady);
  steadyRows.push([`${lvl} (${maxThreads} VU)`, ...fmt(st)]);
  const ok = st.p95 < P95_LIMIT_MS && st.errPct < ERROR_LIMIT_PCT;
  verdicts.push(
    `${lvl} (${maxThreads} VU): p95 = ${st.p95} ms ${st.p95 < P95_LIMIT_MS ? "✓" : "✗"}, ` +
      `napake = ${st.errPct.toFixed(2)} % ${st.errPct < ERROR_LIMIT_PCT ? "✓" : "✗"} → ${ok ? "USTREZA" : "NE USTREZA"}`,
  );
}
table("Metrike v ustaljenem stanju (vse niti nivoja aktivne)", steadyRows);

console.log(`\nKriteriji: p95 < ${P95_LIMIT_MS} ms in delež napak < ${ERROR_LIMIT_PCT} % (ustaljeno stanje)`);
for (const v of verdicts) console.log("  " + v);

// Napake po kodi odziva
const failed = load.filter((s) => s.success !== "true");
if (failed.length) {
  const byCode = {};
  for (const f of failed) {
    const k = `${f.label} → ${f.responseCode} ${f.responseMessage}`.trim();
    byCode[k] = (byCode[k] ?? 0) + 1;
  }
  console.log("\nNeuspešni zahtevki:");
  for (const [k, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${k}`);
}

// Viri vsebnikov
const statsFile = join(dir, "docker-stats.csv");
if (existsSync(statsFile)) {
  const rows = parseCsv(readFileSync(statsFile, "utf8"));
  const toMiB = (v) => {
    const m = /([\d.]+)\s*([KMG]i?B)/.exec(v ?? "");
    if (!m) return NaN;
    return Number(m[1]) * ({ KiB: 1 / 1024, KB: 1 / 1024, MiB: 1, MB: 1, GiB: 1024, GB: 1024 }[m[2]] ?? 1);
  };
  console.log("\nViri vsebnikov (docker stats):");
  for (const name of [...new Set(rows.map((r) => r.vsebnik))].sort()) {
    const rs = rows.filter((r) => r.vsebnik === name);
    const cpu = rs.map((r) => parseFloat(r.cpu_odstotek)).filter(Number.isFinite);
    const mem = rs.map((r) => toMiB(r.pomnilnik.split("/")[0])).filter(Number.isFinite);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(
      `  ${name}: CPE povp. ${avg(cpu).toFixed(1)} %, max ${Math.max(...cpu).toFixed(1)} % | ` +
        `RAM začetek ${mem[0]?.toFixed(1)} MiB, max ${Math.max(...mem).toFixed(1)} MiB, konec ${mem.at(-1)?.toFixed(1)} MiB`,
    );
  }
}
