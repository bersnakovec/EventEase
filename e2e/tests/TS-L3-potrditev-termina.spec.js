// TS-L3 – Potrditev končnega termina, obveščanje udeležencev in datoteka .ics (odgovoren: Lenart Beršnak)
// Specifikacija testnih primerov: porocilo_naloga3.md, poglavje 4.3.
// E-pošta se v testnem okolju ne pošlje, ampak se zapiše v odložišče (e2e/.outbox, glej compose.e2e.yaml).
import { test, expect } from "@playwright/test";
import {
  RUN, nextMonthDay, evidence, recordRequests, apiCreatePoll, apiGetPoll, apiVote, apiFinalize,
  adminUrl, inviteUrl,
} from "../helpers/app.js";
import { mailsWithSubject, icsProperty } from "../helpers/outbox.js";

const d10 = nextMonthDay(10);
const d11 = nextMonthDay(11);
const d12 = nextMonthDay(12);
const ORGANIZER = "organizator@eventease.test";
const ANA = `ana.${RUN}@eventease.test`;
const CENE = `cene.${RUN}@eventease.test`;

/** Datum in ura v Europe/Ljubljana → UTC v obliki iCalendar (YYYYMMDDTHHMMSSZ). */
function ljubljanaToIcsUtc(iso, hhmm) {
  const asUtc = new Date(`${iso}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(asUtc);
  const p = (t) => Number(parts.find((x) => x.type === t).value);
  const offset = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour"), p("minute")) - asUtc.getTime();
  return new Date(asUtc.getTime() - offset).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

/**
 * Predpogoj: anketa z dvema terminoma in tremi glasovi.
 *  - Ana (z e-pošto):  termin 1 = da
 *  - Bor (brez e-pošte): termin 1 = če bo potrebno
 *  - Cene (z e-pošto): termin 1 = ne, termin 2 = da
 * Naslov vsebuje vejico, da preverimo ubežanje v .ics (SUMMARY).
 */
async function pollWithVotes(request, label) {
  const title = `Sestanek ekipe, ${label} ${RUN}`;
  const poll = await apiCreatePoll(request, {
    title,
    organizer_email: ORGANIZER,
    slots: [
      [`${d10.iso}T14:00:00`, `${d10.iso}T15:00:00`],
      [`${d11.iso}T18:30:00`, `${d11.iso}T19:30:00`],
    ],
  });
  const [s1, s2] = (await apiGetPoll(request, poll.share_token)).time_slots;
  await apiVote(request, poll.share_token, { name: "Ana", email: ANA, votes: [[s1.id, "yes"], [s2.id, "no"]] });
  await apiVote(request, poll.share_token, { name: "Bor", votes: [[s1.id, "if_need_be"], [s2.id, "no"]] });
  await apiVote(request, poll.share_token, { name: "Cene", email: CENE, votes: [[s1.id, "no"], [s2.id, "yes"]] });
  return { ...poll, title, s1, s2 };
}

const finalizedMails = (title) => mailsWithSubject(`Poll finalized: ${title}`);

test.describe("TS-L3 Potrditev termina in .ics", () => {
  test("TC-L3-01: termina ni mogoče potrditi brez izbire; rezultati glasovanja so prikazani", async ({ page, request }, testInfo) => {
    const poll = await pollWithVotes(request, "brez izbire");
    const posts = recordRequests(page, "POST", "/finalize");
    await page.goto(adminUrl(poll));

    await test.step("1. Preveri prikaz rezultatov glasovanja", async () => {
      const cards = page.locator("form div.cursor-pointer");
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0)).toContainText("Ustreza: Ana");
      await expect(cards.nth(0)).toContainText("Če bo potrebno: Bor");
      await expect(cards.nth(0)).toContainText("1 glas");
      await expect(cards.nth(1)).toContainText("Ustreza: Cene");
    });

    await test.step("2. Brez izbire termina klikni »Potrdi izbran termin in obvesti vse«", async () => {
      await page.getByRole("button", { name: "Potrdi izbran termin in obvesti vse" }).click();
      await expect(page.getByText("Prosimo, izberite končni termin za zaklep dogodka.")).toBeVisible();
      await evidence(page, testInfo, "TC-L3-01_brez-izbire");
    });

    await test.step("3. Zahteva ni bila poslana, anketa ni zaključena", async () => {
      expect(posts).toHaveLength(0);
      expect((await apiGetPoll(request, poll.share_token)).is_finalized).toBe(false);
    });
  });

  test("TC-L3-02: organizator potrdi termin, udeleženci z e-pošto prejmejo .ics", async ({ page, request, context }, testInfo) => {
    const poll = await pollWithVotes(request, "potrditev");

    await test.step(`1. Izberi termin ${d10.iso} 14:00 in ga potrdi`, async () => {
      await page.goto(adminUrl(poll));
      await page.locator("form div.cursor-pointer").filter({ hasText: "14:00" }).click();
      await evidence(page, testInfo, "TC-L3-02_1_izbran-termin");
      await page.getByRole("button", { name: "Potrdi izbran termin in obvesti vse" }).click();
    });

    await test.step("2. Prikaže se zaključen pogled z izbranim terminom", async () => {
      await expect(page.getByText("Glasovanje zaključeno")).toBeVisible();
      await expect(page.getByRole("heading", { name: poll.title })).toBeVisible();
      await expect(page.getByText(new RegExp(`${d10.day}\\. \\p{L}+ \\d{4}.*14:00`, "u"))).toBeVisible();
      await expect(page.getByText("do 15:00")).toBeVisible();
      await evidence(page, testInfo, "TC-L3-02_2_zakljuceno-skrbnik");
    });

    await test.step("3. Stanje je trajno (ponovno nalaganje, API)", async () => {
      await page.reload();
      await expect(page.getByText("Glasovanje zaključeno")).toBeVisible();
      await expect(page.getByRole("button", { name: "Potrdi izbran termin in obvesti vse" })).toHaveCount(0);
      const data = await apiGetPoll(request, poll.share_token);
      expect(data.is_finalized).toBe(true);
      expect(data.final_slot_id).toBe(poll.s1.id);
    });

    await test.step("4. Udeleženec na povezavi za glasovanje vidi potrjen termin", async () => {
      const guest = await context.newPage();
      await guest.goto(inviteUrl(poll));
      await expect(guest.getByText("Termin potrjen")).toBeVisible();
      await expect(guest.getByText("do 15:00")).toBeVisible();
      await expect(guest.getByRole("button", { name: "Potrdi udeležbo" })).toHaveCount(0);
      await evidence(guest, testInfo, "TC-L3-02_3_zakljuceno-udelezenec");
    });

    await test.step("5. E-pošta: organizator + udeleženci z e-naslovom (ne Bor)", async () => {
      const mails = finalizedMails(poll.title);
      expect(mails.map((m) => m.to).sort()).toEqual([ANA, CENE, ORGANIZER].sort());
      const org = mails.find((m) => m.to === ORGANIZER);
      for (const name of ["Ana", "Bor", "Cene"]) expect(org.raw).toContain(`- ${name}`);
    });

    await test.step("6. Priponka event.ics je veljaven iCalendar z izbranim terminom", async () => {
      for (const to of [ANA, CENE]) {
        const mail = finalizedMails(poll.title).find((m) => m.to === to);
        expect(mail.attachmentName).toBe("event.ics");
        const ics = mail.ics;
        expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
        expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
        expect(ics).not.toMatch(/[^\r]\n/); // vse vrstice s CRLF
        expect(icsProperty(ics, "SUMMARY")).toBe(poll.title.replace(",", "\\,"));
        const start = icsProperty(ics, "DTSTART");
        const end = icsProperty(ics, "DTEND");
        expect(start).toMatch(new RegExp(`^${d10.iso.replaceAll("-", "")}T\\d{6}Z$`));
        // trajanje = 1 h (kot izbrani termin)
        const toDate = (v) => new Date(v.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
        expect(toDate(end) - toDate(start)).toBe(60 * 60 * 1000);
      }
    });
  });

  test("TC-L3-03: obvestilo udeležencu je veljavna zahteva za ponudnika e-pošte [INC-07]", async ({ request }) => {
    test.fail(true, "INC-07: telo e-pošte z .ics je neveljaven JSON (neubežani \" in nove vrstice)");
    const poll = await pollWithVotes(request, "json");
    expect((await apiFinalize(request, poll.admin_token, poll.s1.id)).status()).toBe(200);
    const mails = finalizedMails(poll.title);
    expect(mails).toHaveLength(3);
    for (const m of mails) {
      test.info().annotations.push({ type: "dejanski rezultat", description: `${m.to}: veljaven JSON = ${m.validJson}` });
      expect.soft(m.validJson, `JSON za ${m.to}`).toBe(true);
    }
  });

  test("TC-L3-04: zaključene ankete ni mogoče ponovno potrditi", async ({ page, request }, testInfo) => {
    const poll = await pollWithVotes(request, "ponovna potrditev");
    expect((await apiFinalize(request, poll.admin_token, poll.s1.id)).status()).toBe(200);

    const again = await apiFinalize(request, poll.admin_token, poll.s2.id);
    expect(again.status()).toBe(409);
    expect(await again.text()).toContain("already been finalized");
    expect((await apiGetPoll(request, poll.share_token)).final_slot_id).toBe(poll.s1.id);
    expect(finalizedMails(poll.title)).toHaveLength(3); // ni dodatnih obvestil

    await page.goto(adminUrl(poll));
    await expect(page.getByText("Glasovanje zaključeno")).toBeVisible();
    await expect(page.getByRole("button", { name: "Potrdi izbran termin in obvesti vse" })).toHaveCount(0);
    await evidence(page, testInfo, "TC-L3-04_ze-zakljuceno");
  });

  test("TC-L3-05: po potrditvi glasovanje ni več mogoče [INC-08]", async ({ request }) => {
    test.fail(true, "INC-08: POST /vote sprejme glas tudi za zaključeno anketo");
    const poll = await pollWithVotes(request, "glas po potrditvi");
    await apiFinalize(request, poll.admin_token, poll.s1.id);

    const res = await apiVote(request, poll.share_token, { name: "Darja", votes: [[poll.s2.id, "yes"]] });
    test.info().annotations.push({ type: "dejanski rezultat", description: `HTTP ${res.status()}` });
    expect.soft(res.status()).toBe(409);
    expect((await apiGetPoll(request, poll.share_token)).votes).toHaveLength(3);
  });

  test("TC-L3-06: potrditev s terminom, ki ne pripada anketi, je zavrnjena [INC-09]", async ({ request }) => {
    test.fail(true, "INC-09: finalize ne preveri, da termin pripada anketi; neobstoječ termin vrne 500");
    // Vsak primer na svoji anketi: če bi prvi primer anketo zaključil, bi drugi vrnil 409.
    const a = await pollWithVotes(request, "anketa A");
    const b = await pollWithVotes(request, "anketa B");
    const c = await pollWithVotes(request, "anketa C");

    const foreign = await apiFinalize(request, b.admin_token, a.s1.id);
    const missing = await apiFinalize(request, c.admin_token, "00000000-0000-4000-8000-000000000000");
    test.info().annotations.push({
      type: "dejanski rezultat",
      description: `termin iz druge ankete: HTTP ${foreign.status()}; neobstoječ termin: HTTP ${missing.status()}`,
    });
    expect.soft(foreign.status(), "termin iz druge ankete").toBe(400);
    expect.soft((await apiGetPoll(request, b.share_token)).is_finalized, "B ostane odprta").toBe(false);
    expect.soft(missing.status(), "neobstoječ termin").toBe(400);
    expect((await apiGetPoll(request, c.share_token)).is_finalized, "C ostane odprta").toBe(false);
  });

  test("TC-L3-07: potrditev sprejetega predloga obvesti udeležence z .ics [INC-10]", async ({ page, request }, testInfo) => {
    test.fail(true, "INC-10: termin iz predloga ima end = start, .ics se ne zgradi, e-pošta se ne pošlje");
    const poll = await pollWithVotes(request, "iz predloga");
    await request.post(`/api/polls/share/${poll.share_token}/suggest`, {
      data: { suggested_by: "Ana", dates: [`${d12.iso}T17:00:00`] },
    });
    const sugg = (await (await request.get(`/api/polls/admin/${poll.admin_token}`)).json()).suggestions[0];
    const { slot_id } = await (await request.post(`/api/polls/admin/${poll.admin_token}/accept-suggestion`, {
      data: { suggestion_id: sugg.id },
    })).json();
    await apiVote(request, poll.share_token, { name: "Ana", email: ANA, votes: [[slot_id, "yes"]] });

    await page.goto(adminUrl(poll));
    await page.locator("form div.cursor-pointer").filter({ hasText: "17:00" }).click();
    await page.getByRole("button", { name: "Potrdi izbran termin in obvesti vse" }).click();
    await expect(page.getByText("Vsi udeleženci so bili obveščeni")).toBeVisible();
    await evidence(page, testInfo, "TC-L3-07_trdi-da-so-obvesceni");

    const toAna = finalizedMails(poll.title).filter((m) => m.to === ANA);
    test.info().annotations.push({ type: "dejanski rezultat", description: `e-pošt za Ano: ${toAna.length}` });
    expect(toAna).toHaveLength(1);
    expect(toAna[0].attachmentName).toBe("event.ics");
  });

  test("TC-L3-08: čas v .ics ustreza izbranemu lokalnemu terminu [INC-11]", async ({ request }) => {
    test.fail(true, "INC-11: termin 14:00 (Europe/Ljubljana) je v .ics zapisan kot 14:00 UTC");
    const poll = await pollWithVotes(request, "casovni pas");
    await apiFinalize(request, poll.admin_token, poll.s1.id);
    const ics = finalizedMails(poll.title).find((m) => m.to === ANA).ics;
    const expected = ljubljanaToIcsUtc(d10.iso, "14:00");
    test.info().annotations.push({
      type: "dejanski rezultat",
      description: `DTSTART=${icsProperty(ics, "DTSTART")}, pričakovano ${expected}`,
    });
    expect(icsProperty(ics, "DTSTART")).toBe(expected);
  });
});
