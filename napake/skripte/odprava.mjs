// Potek odprave napak v MantisBT (naloga 6): dodeljeno → rešeno → zaprto, z opombami.
// Zagon (iz mape napake/):  node skripte/odprava.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MANTIS_URL ?? "http://localhost:8989/api/rest";
const TOKEN = fs.readFileSync(path.join(DIR, ".token"), "utf8").trim();
const ids = JSON.parse(fs.readFileSync(path.join(DIR, "ids.json"), "utf8"));

async function api(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method, headers: { Authorization: TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
const note = (id, text) => api("POST", `/issues/${id}/notes`, { text, view_state: { name: "public" } });

const COMMIT = "4278cae";
const odprava = {
  "INC-02": {
    popravek: "Popravljeno v commitu 4278cae: CreateEventPage.jsx preverja formData.title.trim(), zato naslov iz samih presledkov ni sprejet.",
    preverjanje: "Preverjeno z E2E: TC-L1-04 je uspešen brez oznake test.fail (Playwright 1.56.1, Chromium 141). Celoten nabor 18/18 po pričakovanjih, lint in testi enot (105/105) uspešni. Dokaz: napake/dokazi/INC-02_po-popravku_TC-L1-04.png",
  },
  "INC-06": {
    popravek: "Popravljeno v commitu 4278cae: AdminFinalizeView.jsx v seznam predlogov za koledar doda start_time, podrobnosti prikažejo »<datum> ob <ura>«.",
    preverjanje: "Preverjeno z E2E: TC-L2-05 (okrepljen, preverja tudi uro) je uspešen brez oznake test.fail. Prikaz: »Predlog od Ana: 2026-12-12 ob 17:00«. Celoten nabor 18/18. Dokaz: napake/dokazi/INC-06_po-popravku_TC-L2-05.png",
  },
};

for (const [inc, o] of Object.entries(odprava)) {
  const id = ids[inc];
  await note(id, o.popravek);
  await api("PATCH", `/issues/${id}`, {
    status: { name: "resolved" }, resolution: { name: "fixed" }, fixed_in_version: { name: "1.1" },
  });
  console.log(`${inc} (#${id}) → rešeno (popravljeno, 1.1, ${COMMIT})`);
  await note(id, o.preverjanje);
  await api("PATCH", `/issues/${id}`, { status: { name: "closed" } });
  console.log(`${inc} (#${id}) → zaprto`);
}
