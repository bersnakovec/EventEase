// Branje odložišča e-pošte, ki ga v testnem okolju polni fake-curl.sh.
// Vsebina se razčleni z regularnimi izrazi in NE z JSON.parse, ker je del zahtev
// neveljaven JSON (glej INC-07). Veljavnost JSON se zabeleži posebej (validJson).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OUTBOX_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".outbox");

export function clearOutbox() {
  for (const f of fs.readdirSync(OUTBOX_DIR)) fs.rmSync(path.join(OUTBOX_DIR, f));
}

function parseMail(file) {
  const raw = fs.readFileSync(path.join(OUTBOX_DIR, file), "utf8");
  let validJson = true;
  try {
    JSON.parse(raw);
  } catch {
    validJson = false;
  }
  const attachment = raw.match(/"filename":"([^"]+)","content":"([A-Za-z0-9+/=]+)"/);
  return {
    file,
    raw,
    validJson,
    to: raw.match(/"to":\["([^"]+)"\]/)?.[1],
    subject: raw.match(/"subject":"([^"]*)"/)?.[1],
    attachmentName: attachment?.[1] ?? null,
    ics: attachment ? Buffer.from(attachment[2], "base64").toString("utf8") : null,
  };
}

/** Vse e-pošte, katerih zadeva vsebuje `subjectPart`. */
export function mailsWithSubject(subjectPart) {
  return fs
    .readdirSync(OUTBOX_DIR)
    .sort()
    .map(parseMail)
    .filter((m) => m.subject?.includes(subjectPart));
}

/** Vrednost lastnosti iz .ics (npr. "DTSTART"). */
export function icsProperty(ics, name) {
  return ics.split("\r\n").find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1);
}
