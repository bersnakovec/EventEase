// Povzetek rezultatov E2E v Markdown (za $GITHUB_STEP_SUMMARY v CI).
// Vir: rezultati/rezultati.json (Playwright JSON reporter).
import fs from "node:fs";

const file = new URL("./rezultati/rezultati.json", import.meta.url);
if (!fs.existsSync(file)) {
  console.log("### Funkcionalni testi (Playwright)\n\nRezultatov ni (testi se niso izvedli).");
  process.exit(0);
}
const report = JSON.parse(fs.readFileSync(file, "utf8"));

const rows = [];
const walk = (suite) => {
  for (const s of suite.suites ?? []) walk(s);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const r = t.results.at(-1);
      const knownDefect = t.expectedStatus === "failed";
      let verdict;
      if (t.status === "expected") verdict = knownDefect ? "⚠️ znana napaka (test.fail)" : "✅ uspešen";
      else if (t.status === "unexpected") verdict = knownDefect ? "❗ nepričakovan uspeh – odstrani test.fail" : "❌ NEUSPEŠEN";
      else verdict = t.status;
      const msg = t.status === "unexpected" && r?.error?.message
        ? r.error.message.replace(/\x1b\[[0-9;]*m/g, "").split("\n").find((l) => l.trim())?.slice(0, 160) ?? ""
        : "";
      rows.push(`| ${spec.title.replaceAll("|", "\\|")} | ${verdict} | ${msg.replaceAll("|", "\\|")} |`);
    }
  }
};
for (const s of report.suites) walk(s);

const st = report.stats;
console.log(`### Funkcionalni testi (Playwright)

**${st.expected}** po pričakovanjih, **${st.unexpected}** nepričakovanih, ${st.flaky} nestabilnih, ${st.skipped} preskočenih · trajanje ${(st.duration / 1000).toFixed(1)} s

| Testni primer | Rezultat | Napaka |
|---|---|---|
${rows.join("\n")}`);
