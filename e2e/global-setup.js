// Pred zagonom preveri pripravljenost testnega okolja (ISO/IEC/IEEE 29119-3: Test Environment Readiness).
// Če varovalke za e-pošto niso aktivne, se testi NE izvedejo – nobena e-pošta ne sme zapustiti vsebnika.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { clearOutbox, OUTBOX_DIR } from "./helpers/outbox.js";

const CONTAINER = process.env.E2E_APP_CONTAINER ?? "eventease-e2e-app-1";

function inContainer(...cmd) {
  return execFileSync("docker", ["exec", CONTAINER, ...cmd], { encoding: "utf8" }).trim();
}

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;

  // nginx se zažene takoj, backend (migracija baze) nekoliko kasneje – počakamo na odgovor API.
  // Neobstoječa anketa mora vrniti 404 (502 = backend še ne teče).
  const probe = `${baseURL}/api/polls/share/00000000-0000-4000-8000-000000000000`;
  let status = null;
  for (let i = 0; i < 30 && status !== 404; i++) {
    status = (await fetch(probe).catch(() => null))?.status ?? null;
    if (status !== 404) await new Promise((r) => setTimeout(r, 1000));
  }
  if (status !== 404) {
    throw new Error(`API ni pripravljen na ${baseURL} (zadnji odgovor: ${status}). Zaženi: npm run env:up`);
  }

  const curlPath = inContainer("sh", "-c", "command -v curl");
  if (curlPath !== "/usr/local/bin/curl") {
    throw new Error(`curl v vsebniku ni testni dvojnik (${curlPath}). Uporabi compose.e2e.yaml.`);
  }
  const resend = inContainer("getent", "hosts", "api.resend.com");
  if (!resend.startsWith("127.0.0.1")) {
    throw new Error(`api.resend.com ni preusmerjen na 127.0.0.1 (${resend}).`);
  }

  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  clearOutbox();
}
