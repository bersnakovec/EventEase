// Pomožne funkcije: testni podatki prek API, koledar, dokazila (posnetki zaslona).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dokazi");

export const MONTHS = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December",
];

/** Enolična oznaka zagona, da se podatki različnih zagonov ne mešajo. */
export const RUN = Date.now().toString(36).slice(-5);

/** Dan `day` v naslednjem mesecu (vedno v prihodnosti, ne glede na datum zagona). */
export function nextMonthDay(day) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const iso = `${d.getFullYear()}-${mm}-${String(day).padStart(2, "0")}`;
  return { day, iso, monthLabel: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}

// ── Testni podatki prek API ──────────────────────────────────────────────────
export async function apiCreatePoll(request, { title, organizer_email = "organizator@eventease.test", description = "", slots }) {
  const res = await request.post("/api/polls", {
    data: {
      title,
      description,
      organizer_email,
      time_slots: slots.map(([start, end]) => ({ start_time: start, end_time: end })),
    },
  });
  if (res.status() !== 201) throw new Error(`Priprava podatkov ni uspela: HTTP ${res.status()}`);
  return res.json();
}

export async function apiGetPoll(request, shareToken) {
  return (await request.get(`/api/polls/share/${shareToken}`)).json();
}

export async function apiGetAdminPoll(request, adminToken) {
  return (await request.get(`/api/polls/admin/${adminToken}`)).json();
}

export function apiVote(request, shareToken, { name, email = "", votes }) {
  return request.post(`/api/polls/share/${shareToken}/vote`, {
    data: {
      participant_name: name,
      participant_email: email,
      date_votes: votes.map(([slot_id, status]) => ({ slot_id, status })),
    },
  });
}

export function apiFinalize(request, adminToken, slotId) {
  return request.post(`/api/polls/admin/${adminToken}/finalize`, { data: { final_slot_id: slotId } });
}

export const adminUrl = (poll) => `/admin/${poll.admin_token}?invite=${poll.share_token}`;
export const inviteUrl = (poll) => `/invite/${poll.share_token}`;

// ── Koledar (CalendarPicker) ─────────────────────────────────────────────────
/** Koledar znotraj `scope` (stran, razdelek ali modalno okno). */
export function calendar(scope) {
  return scope.getByRole("button", { name: "→" }).locator("xpath=../..");
}

/** Gumb za dan `day` v prikazanem mesecu. */
export function dayButton(cal, day) {
  return cal.locator(
    `xpath=.//div[contains(@class,"grid-cols-7")]//button[span[1][normalize-space()="${day}"]]`,
  );
}

/** Premakne koledar na mesec, v katerem je `target` (rezultat nextMonthDay). */
export async function showMonth(cal, target) {
  const label = cal.getByText(target.monthLabel, { exact: true });
  for (let i = 0; i < 3 && !(await label.isVisible()); i++) {
    await cal.getByRole("button", { name: "→" }).click();
  }
  await label.waitFor();
}

/** Izbere dan in (po želji) nastavi uro, nato potrdi uro. */
export async function pickDateTime(cal, target, time) {
  await showMonth(cal, target);
  await dayButton(cal, target.day).click();
  if (time) await cal.locator('input[type="time"]').fill(time);
  await cal.getByRole("button", { name: "Potrdi", exact: true }).click();
}

// ── Dokazila ─────────────────────────────────────────────────────────────────
export async function evidence(page, testInfo, name) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

/** Beleži zahteve `method` na `urlPart` (za preverjanje, da zahteve NI bilo). */
export function recordRequests(page, method, urlPart) {
  const seen = [];
  page.on("request", (r) => {
    if (r.method() === method && r.url().includes(urlPart)) seen.push(r.url());
  });
  return seen;
}
