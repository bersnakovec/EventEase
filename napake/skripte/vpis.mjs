// Vpis napak iz napake.json v MantisBT prek REST API (naloga 6).
// Zagon (iz mape napake/):  node skripte/vpis.mjs
// Žeton: skripte/.token (ustvari ga postavitev.php). Idempotentno: napako z enakim [ID] v povzetku preskoči.
// Preslikava ID → številka v Mantisu se zapiše v skripte/ids.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "..", "..");
const BASE = process.env.MANTIS_URL ?? "http://localhost:8989/api/rest";
const TOKEN = fs.readFileSync(path.join(DIR, ".token"), "utf8").trim();
const data = JSON.parse(fs.readFileSync(path.join(DIR, "..", "napake.json"), "utf8"));

async function api(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const project = (await api("GET", "/projects")).projects.find((p) => p.name === "EventEase");
const fields = Object.fromEntries(project.custom_fields.map((f) => [f.name, f.id]));
const existing = (await api("GET", `/issues?project_id=${project.id}&page_size=200`)).issues;
const ids = {};

for (const n of data.napake) {
  const tag = `[${n.id}]`;
  const found = existing.find((i) => i.summary.startsWith(tag));
  if (found) {
    ids[n.id] = found.id;
    console.log(`= ${n.id} že obstaja (#${found.id})`);
    continue;
  }
  const k = data.kriticnost[n.kriticnost];
  const cf = (name, value) => ({ field: { id: fields[name] }, value });
  const issue = {
    project: { id: project.id },
    summary: `${tag} ${n.naslov}`,
    description: n.opis,
    steps_to_reproduce: n.koraki,
    additional_information: n.dodatno,
    category: { name: n.kategorija },
    severity: { name: k.severity },
    priority: { name: k.priority },
    reproducibility: { name: data.privzeto.reproducibility },
    status: { name: "assigned" },
    handler: { name: data.privzeto.handler },
    due_date: `${k.due_date}T23:59:00+01:00`,
    version: { name: data.privzeto.version },
    target_version: { name: data.privzeto.target_version },
    platform: data.privzeto.platform,
    os: data.privzeto.os,
    os_build: data.privzeto.os_build,
    tags: [{ name: n.scenarij }, { name: "naloga3" }],
    custom_fields: [
      cf("Tip napake", n.tip),
      cf("Brskalnik", n.brskalnik),
      cf("Testni primer", n.testni_primer),
      cf("Pričakovani rezultat", n.pricakovano),
      cf("Dejanski rezultat", n.dejansko),
    ],
  };
  if (n.dokaz) {
    issue.files = [{ name: path.basename(n.dokaz), content: fs.readFileSync(path.join(ROOT, n.dokaz)).toString("base64") }];
  }
  const { issue: created } = await api("POST", "/issues", issue);
  ids[n.id] = created.id;
  console.log(`+ ${n.id} → #${created.id} ${created.severity.label} / ${created.status.label}`);
}

for (const n of data.napake) {
  for (const p of n.povezave ?? []) {
    const issue = await api("GET", `/issues/${ids[n.id]}`);
    const already = (issue.issues[0].relationships ?? []).some((r) => r.issue.id === ids[p.z]);
    if (already) continue;
    await api("POST", `/issues/${ids[n.id]}/relationships`, { issue: { id: ids[p.z] }, type: { name: p.tip } });
    console.log(`~ ${n.id} ${p.tip} ${p.z}`);
  }
}

fs.writeFileSync(path.join(DIR, "ids.json"), JSON.stringify(ids, null, 2) + "\n");
console.log("Preslikava:", ids);
