// Popoln izvoz napak (z opombami, povezavami, prilogami in zgodovino) iz MantisBT REST v JSON (naloga 6).
// Dopolnjuje vgrajeni izvoz CSV/Excel, ki opomb in zgodovine ne vsebuje.
// Zagon (iz mape napake/):  node skripte/izvoz-json.mjs   → izvoz/napake_eventease.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MANTIS_URL ?? "http://localhost:8989/api/rest";
const TOKEN = fs.readFileSync(path.join(DIR, ".token"), "utf8").trim();
const get = async (url) => (await fetch(`${BASE}${url}`, { headers: { Authorization: TOKEN } })).json();

const { issues } = await get("/issues?project_id=1&page_size=200");
const out = [];
for (const { id } of issues.sort((a, b) => a.id - b.id)) {
  const i = (await get(`/issues/${id}`)).issues[0];
  const cf = Object.fromEntries(i.custom_fields.map((c) => [c.field.name, c.value]));
  out.push({
    id: i.id,
    oznaka: i.summary.match(/^\[([^\]]+)\]/)?.[1],
    povzetek: i.summary,
    tip: cf["Tip napake"],
    kriticnost: i.severity.label,
    prioriteta: i.priority.label,
    stanje: i.status.label,
    razresitev: i.resolution.label,
    kategorija: i.category.name,
    testni_primer: cf["Testni primer"],
    verzija: i.version?.name ?? null,
    ciljna_verzija: i.target_version?.name ?? null,
    popravljeno_v: i.fixed_in_version?.name ?? null,
    brskalnik: cf["Brskalnik"],
    okolje: { platforma: i.platform, os: i.os, verzija_os: i.os_build },
    ponovljivost: i.reproducibility.label,
    prijavitelj: i.reporter.real_name ?? i.reporter.name,
    dodeljeno: i.handler?.real_name ?? i.handler?.name ?? null,
    rok: i.due_date ?? null,
    ustvarjeno: i.created_at,
    posodobljeno: i.updated_at,
    opis: i.description,
    koraki: i.steps_to_reproduce,
    pricakovani_rezultat: cf["Pričakovani rezultat"],
    dejanski_rezultat: cf["Dejanski rezultat"],
    dodatne_informacije: i.additional_information,
    oznake: (i.tags ?? []).map((t) => t.name),
    povezave: (i.relationships ?? []).map((r) => ({ tip: r.type.label, napaka: r.issue.id })),
    priloge: (i.attachments ?? []).map((a) => a.filename),
    opombe: (i.notes ?? []).map((n) => ({ cas: n.created_at, avtor: n.reporter.name, besedilo: n.text })),
    zgodovina: (i.history ?? []).map((h) => ({ cas: h.created_at, uporabnik: h.user.name, sprememba: h.message, polje: h.field?.label, staro: h.old_value?.label ?? h.old_value, novo: h.new_value?.label ?? h.new_value })),
  });
}
fs.mkdirSync(path.join(DIR, "..", "izvoz"), { recursive: true });
fs.writeFileSync(path.join(DIR, "..", "izvoz", "napake_eventease.json"),
  JSON.stringify({ projekt: "EventEase", izvozeno: new Date().toISOString(), napake: out }, null, 2) + "\n");
console.log(`JSON: ${out.length} napak`);
