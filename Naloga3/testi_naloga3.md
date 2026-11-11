# Funkcionalni testi – Naloga 3

Izvorna koda avtomatiziranih testnih scenarijev (Playwright) in testnega okolja. Odgovorna oseba: Lenart Beršnak.
Specifikacija scenarijev, dnevnik izvajanja, poročila o incidentih in zaključno poročilo so v [porocilo_naloga3.md](../porocilo_naloga3.md).

| ID | Scenarij | Datoteka | Primerov |
|---|---|---|---|
| TS-L1 | Ustvarjanje ankete | [TS-L1-ustvarjanje-ankete.spec.js](../e2e/tests/TS-L1-ustvarjanje-ankete.spec.js) | 5 |
| TS-L2 | Predlog termina in sprejem | [TS-L2-predlog-termina.spec.js](../e2e/tests/TS-L2-predlog-termina.spec.js) | 5 |
| TS-L3 | Potrditev termina in .ics | [TS-L3-potrditev-termina.spec.js](../e2e/tests/TS-L3-potrditev-termina.spec.js) | 8 |

Primeri z oznako `[INC-xx]` so označeni s `test.fail()`: preverjajo pravilno obnašanje, ki ga aplikacija trenutno ne izpolnjuje (glej poročilo, pogl. 6).

Zagon:

```bash
cd e2e
npm ci && npx playwright install chromium
npm run env:up
npm test
npm run env:down
```

Rezultat izvedbe 11. 11. 2026: [e2e/rezultati-zagon.txt](../e2e/rezultati-zagon.txt), dokazila: [e2e/dokazi/](../e2e/dokazi/).

## 1. TS-L1 – Ustvarjanje ankete

Vir: [e2e/tests/TS-L1-ustvarjanje-ankete.spec.js](../e2e/tests/TS-L1-ustvarjanje-ankete.spec.js) · testnih primerov: 5

```js
// TS-L1 – Ustvarjanje ankete (odgovoren: Lenart Beršnak)
// Specifikacija testnih primerov: porocilo_naloga3.md, poglavje 4.1.
// Primeri z oznako test.fail() preverjajo PRIČAKOVANO obnašanje, ki ga sistem trenutno ne izpolnjuje
// (incident INC-xx). Ko je napaka odpravljena, Playwright javi »unexpected pass« in oznako odstranimo.
import { test, expect } from "@playwright/test";
import {
  RUN, nextMonthDay, calendar, dayButton, pickDateTime, evidence, recordRequests, apiGetPoll,
} from "../helpers/app.js";

const d1 = nextMonthDay(10);
const d2 = nextMonthDay(11);

async function openCreateForm(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustvari dogodek" }).click();
  await expect(page.getByRole("heading", { name: "Ustvari nov dogodek" })).toBeVisible();
}

test.describe("TS-L1 Ustvarjanje ankete", () => {
  test("TC-L1-01: organizator ustvari anketo z dvema terminoma in prejme obe povezavi", async ({ page, request, context }, testInfo) => {
    const title = `Izlet na Pohorje ${RUN}`;
    const email = "lenart.organizator@eventease.test";

    await test.step("1. Na začetni strani klikni »Ustvari dogodek«", () => openCreateForm(page));

    await test.step("2. Vnesi naslov, e-pošto organizatorja in opis", async () => {
      await page.getByLabel("Naslov dogodka *").fill(title);
      await page.getByLabel("E-pošta organizatorja *").fill(email);
      await page.getByLabel("Opis dogodka").fill("Zbor ob 8.00 na parkirišču.");
    });

    await test.step(`3. V koledarju izberi ${d1.iso} ob 18:30 in ${d2.iso} ob 09:00`, async () => {
      const cal = calendar(page);
      await pickDateTime(cal, d1, "18:30");
      await pickDateTime(cal, d2, "09:00");
      await expect(dayButton(cal, d1.day)).toContainText("18:30");
      await expect(dayButton(cal, d2.day)).toContainText("09:00");
      await evidence(page, testInfo, "TC-L1-01_1_izpolnjen-obrazec");
    });

    let adminLink, shareLink;
    await test.step("4. Klikni »Ustvari in deli«", async () => {
      await page.getByRole("button", { name: "Ustvari in deli" }).click();
      await expect(page.getByRole("heading", { name: "Dogodek je ustvarjen" })).toBeVisible();
      const links = page.locator("input[readonly]");
      adminLink = await links.nth(0).inputValue();
      shareLink = await links.nth(1).inputValue();
      const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
      expect(adminLink).toMatch(new RegExp(`/admin/${uuid}\\?invite=${uuid}$`));
      expect(shareLink).toMatch(new RegExp(`/invite/${uuid}$`));
      await evidence(page, testInfo, "TC-L1-01_2_povezavi");
    });

    await test.step("5. Preveri shranjene podatke (API)", async () => {
      const poll = await apiGetPoll(request, shareLink.split("/invite/")[1]);
      expect(poll.title).toBe(title);
      expect(poll.organizer_email).toBe(email);
      expect(poll.is_finalized).toBe(false);
      expect(poll.time_slots).toHaveLength(2);
      expect(poll.time_slots[0].start_time).toMatch(new RegExp(`^${d1.iso} 18:30`));
      expect(poll.time_slots[0].end_time).toMatch(new RegExp(`^${d1.iso} 19:30`));
      expect(poll.time_slots[1].start_time).toMatch(new RegExp(`^${d2.iso} 09:00`));
      expect(poll.time_slots[1].end_time).toMatch(new RegExp(`^${d2.iso} 10:00`));
    });

    await test.step("6. Odpri povezavo za udeležence", async () => {
      const guest = await context.newPage();
      await guest.goto(shareLink);
      await expect(guest.getByRole("heading", { name: title })).toBeVisible();
      await expect(guest.getByText("lenart.organizator vas vabi")).toBeVisible();
      await expect(guest.getByText("Zbor ob 8.00 na parkirišču.")).toBeVisible();
      await evidence(guest, testInfo, "TC-L1-01_3_povabilo");
    });

    await test.step("7. Odpri povezavo za organizatorja", async () => {
      const admin = await context.newPage();
      await admin.goto(adminLink);
      await expect(admin.getByText("Skrbniški pogled")).toBeVisible();
      await expect(admin.getByRole("heading", { name: title })).toBeVisible();
      const cards = admin.locator("form div.cursor-pointer");
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0)).toContainText("18:30");
      await expect(cards.nth(1)).toContainText("09:00");
    });
  });

  test("TC-L1-02: brez obveznih podatkov anketa ni ustvarjena", async ({ page }, testInfo) => {
    const posts = recordRequests(page, "POST", "/api/polls");
    await openCreateForm(page);
    const submit = page.getByRole("button", { name: "Ustvari in deli" });

    await test.step("1. Oddaj prazen obrazec", async () => {
      await submit.click();
      await expect(page.getByText("Prosimo, vnesite naslov dogodka.")).toBeVisible();
    });
    await test.step("2. Vnesi samo naslov", async () => {
      await page.getByLabel("Naslov dogodka *").fill(`Brez termina ${RUN}`);
      await submit.click();
      await expect(page.getByText("Prosimo, vnesite e-poštni naslov organizatorja.")).toBeVisible();
    });
    await test.step("3. Vnesi še e-pošto, termina ne izberi", async () => {
      await page.getByLabel("E-pošta organizatorja *").fill("organizator@eventease.test");
      await submit.click();
      await expect(page.getByText("Prosimo, izberite vsaj en termin na koledarju.")).toBeVisible();
    });
    await test.step("4. Izberi termin in ga ponovno odznači", async () => {
      const cal = calendar(page);
      await pickDateTime(cal, d1);
      await dayButton(cal, d1.day).click();
      await submit.click();
      await expect(page.getByText("Prosimo, izberite vsaj en termin na koledarju.")).toBeVisible();
      await evidence(page, testInfo, "TC-L1-02_ni-termina");
    });
    await test.step("5. Strežniku ni bila poslana nobena zahteva", () => {
      expect(posts).toHaveLength(0);
    });
  });

  test("TC-L1-03: neveljaven e-naslov organizatorja je zavrnjen [INC-01]", async ({ page }, testInfo) => {
    test.fail(true, "INC-01: obrazec sprejme e-naslov brez @");
    const posts = recordRequests(page, "POST", "/api/polls");
    await openCreateForm(page);
    await page.getByLabel("Naslov dogodka *").fill(`Neveljaven e-naslov ${RUN}`);
    await page.getByLabel("E-pošta organizatorja *").fill("organizator.eventease.test");
    await pickDateTime(calendar(page), d1);
    await page.getByRole("button", { name: "Ustvari in deli" }).click();
    await page.waitForLoadState("networkidle");
    await evidence(page, testInfo, "TC-L1-03_neveljaven-email");
    await expect(page.getByText(/veljaven e-poštni naslov/i)).toBeVisible({ timeout: 3000 });
    expect(posts).toHaveLength(0);
  });

  test("TC-L1-04: naslov iz samih presledkov je zavrnjen [INC-02]", async ({ page }, testInfo) => {
    test.fail(true, "INC-02: naslov »   « se šteje kot vnesen");
    const posts = recordRequests(page, "POST", "/api/polls");
    await openCreateForm(page);
    await page.getByLabel("Naslov dogodka *").fill("   ");
    await page.getByLabel("E-pošta organizatorja *").fill("organizator@eventease.test");
    await pickDateTime(calendar(page), d1);
    await page.getByRole("button", { name: "Ustvari in deli" }).click();
    await page.waitForLoadState("networkidle");
    await evidence(page, testInfo, "TC-L1-04_prazen-naslov");
    await expect(page.getByText("Prosimo, vnesite naslov dogodka.")).toBeVisible({ timeout: 3000 });
    expect(posts).toHaveLength(0);
  });

  test("TC-L1-05: strežnik (API) zavrne neveljavno anketo [INC-03]", async ({ request }) => {
    test.fail(true, "INC-03: POST /api/polls ne validira vhoda");
    const valid = {
      title: `API validacija ${RUN}`,
      organizer_email: "organizator@eventease.test",
      time_slots: [{ start_time: `${d1.iso}T14:00:00`, end_time: `${d1.iso}T15:00:00` }],
    };
    const cases = {
      "prazen naslov": { ...valid, title: "   " },
      "neveljaven e-naslov": { ...valid, organizer_email: "ni-email" },
      "brez terminov": { ...valid, time_slots: [] },
      "konec pred začetkom": {
        ...valid,
        time_slots: [{ start_time: `${d1.iso}T15:00:00`, end_time: `${d1.iso}T14:00:00` }],
      },
    };
    for (const [name, body] of Object.entries(cases)) {
      const res = await request.post("/api/polls", { data: body });
      test.info().annotations.push({ type: "dejanski rezultat", description: `${name}: HTTP ${res.status()}` });
      expect.soft(res.status(), name).toBe(400);
    }
  });
});
```

## 2. TS-L2 – Predlog termina in sprejem

Vir: [e2e/tests/TS-L2-predlog-termina.spec.js](../e2e/tests/TS-L2-predlog-termina.spec.js) · testnih primerov: 5

```js
// TS-L2 – Predlog novega termina in sprejem s strani organizatorja (odgovoren: Lenart Beršnak)
// Specifikacija testnih primerov: porocilo_naloga3.md, poglavje 4.2.
import { test, expect } from "@playwright/test";
import {
  RUN, nextMonthDay, calendar, dayButton, showMonth, pickDateTime, evidence, recordRequests,
  apiCreatePoll, apiGetPoll, apiGetAdminPoll, adminUrl, inviteUrl,
} from "../helpers/app.js";

const d10 = nextMonthDay(10);
const d11 = nextMonthDay(11);
const d12 = nextMonthDay(12);
const d13 = nextMonthDay(13);

/** Predpogoj: anketa z dvema terminoma (10. in 11. v naslednjem mesecu, 14:00–15:00). */
function createPoll(request, title) {
  return apiCreatePoll(request, {
    title,
    slots: [
      [`${d10.iso}T14:00:00`, `${d10.iso}T15:00:00`],
      [`${d11.iso}T14:00:00`, `${d11.iso}T15:00:00`],
    ],
  });
}

function apiSuggest(request, poll, name, dates) {
  return request.post(`/api/polls/share/${poll.share_token}/suggest`, {
    data: { suggested_by: name, dates },
  });
}

const suggestModal = (page) => page.locator("div.fixed.inset-0", { hasText: "Predlagaj datum" });
const suggestionsSection = (page) =>
  page.getByText("Predlogi udeležencev").locator("xpath=ancestor::div[contains(@class,'mb-8')][1]");

test.describe("TS-L2 Predlog termina in sprejem", () => {
  test("TC-L2-01: predloga ni mogoče poslati brez imena ali brez datuma", async ({ page, request }, testInfo) => {
    const poll = await createPoll(request, `Predlog validacija ${RUN}`);
    const posts = recordRequests(page, "POST", "/suggest");
    await page.goto(inviteUrl(poll));

    await test.step("1. Brez imena odpri »Predlagaj nov datum« in klikni »Pošlji predlog«", async () => {
      await page.getByRole("button", { name: "Predlagaj nov datum" }).click();
      await suggestModal(page).getByRole("button", { name: "Pošlji predlog" }).click();
      await expect(suggestModal(page).getByText("Najprej vpišite svoje ime v obrazec.")).toBeVisible();
      await suggestModal(page).getByRole("button", { name: "Prekliči" }).click();
    });

    await test.step("2. Vpiši ime »Ana«, datuma ne izberi", async () => {
      await page.getByPlaceholder("Vpiši svoje ime...").fill("Ana");
      await page.getByRole("button", { name: "Predlagaj nov datum" }).click();
      await suggestModal(page).getByRole("button", { name: "Pošlji predlog" }).click();
      await expect(suggestModal(page).getByText("Izberite vsaj en datum.")).toBeVisible();
      await evidence(page, testInfo, "TC-L2-01_brez-datuma");
    });

    await test.step("3. Strežniku ni bila poslana nobena zahteva, predlogov ni", async () => {
      expect(posts).toHaveLength(0);
      expect((await apiGetAdminPoll(request, poll.admin_token)).suggestions).toHaveLength(0);
    });
  });

  test("TC-L2-02: udeleženec predlaga termin, organizator ga sprejme, termin je na voljo za glasovanje", async ({ page, request, context }, testInfo) => {
    const title = `Predlog in sprejem ${RUN}`;
    const poll = await createPoll(request, title);

    await test.step(`1. Udeleženka Ana predlaga ${d12.iso} ob 17:00`, async () => {
      await page.goto(inviteUrl(poll));
      await page.getByPlaceholder("Vpiši svoje ime...").fill("Ana");
      await page.getByRole("button", { name: "Predlagaj nov datum" }).click();
      await pickDateTime(calendar(suggestModal(page)), d12, "17:00");
      await evidence(page, testInfo, "TC-L2-02_1_predlog");
      await suggestModal(page).getByRole("button", { name: "Pošlji predlog" }).click();
      await expect(page.getByText("Predlogi uspešno poslani organizatorju.")).toBeVisible();
      await expect(suggestModal(page)).toBeHidden();
    });

    await test.step("2. Predlog je shranjen s statusom »pending« (API)", async () => {
      const { suggestions } = await apiGetAdminPoll(request, poll.admin_token);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toMatchObject({ suggested_by: "Ana", status: "pending" });
      expect(suggestions[0].start_time).toMatch(new RegExp(`^${d12.iso} 17:00`));
    });

    const admin = await context.newPage();
    await test.step("3. Organizator v skrbniškem pogledu vidi predlog in ga izbere", async () => {
      await admin.goto(adminUrl(poll));
      const section = suggestionsSection(admin);
      await expect(section).toContainText("Predlogi udeležencev(1)");
      const cal = calendar(section);
      await showMonth(cal, d12);
      await dayButton(cal, d12.day).click();
      // Datum v podrobnostih predloga manjka (INC-06) – preverja ga TC-L2-05.
      await expect(section.getByText("Predlog od Ana")).toBeVisible();
      await evidence(admin, testInfo, "TC-L2-02_2_skrbnik-predlog");
    });

    await test.step("4. Klikni »Sprejmi → dodaj v poll«", async () => {
      await admin.getByRole("button", { name: "Sprejmi → dodaj v poll" }).click();
      await expect(admin.getByText("Predlogi udeležencev")).toBeHidden();
      const cards = admin.locator("form div.cursor-pointer");
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(2)).toContainText("17:00");
      await evidence(admin, testInfo, "TC-L2-02_3_sprejet");
    });

    await test.step("5. Predlog je »accepted«, anketa ima nov termin (API)", async () => {
      const data = await apiGetAdminPoll(request, poll.admin_token);
      expect(data.suggestions[0].status).toBe("accepted");
      expect(data.time_slots).toHaveLength(3);
      expect(data.time_slots[2].start_time).toMatch(new RegExp(`^${d12.iso} 17:00`));
    });

    await test.step(`6. Udeleženec Bor glasuje »Da« za novi termin ${d12.iso}`, async () => {
      const guest = await context.newPage();
      await guest.goto(inviteUrl(poll));
      await guest.getByPlaceholder("Vpiši svoje ime...").fill("Bor");
      const cal = calendar(guest);
      await showMonth(cal, d12);
      await dayButton(cal, d12.day).click();
      await guest.getByRole("button", { name: "Potrdi udeležbo" }).click();
      await expect(guest.getByRole("heading", { name: "Hvala, Bor!" })).toBeVisible();

      const { votes, time_slots } = await apiGetPoll(request, poll.share_token);
      const bor = votes.find((v) => v.participant_name === "Bor");
      expect(bor.date_votes).toContainEqual({ slot_id: time_slots[2].id, status: "yes" });
    });
  });

  test("TC-L2-03: sprejeti termin ima enako trajanje kot ostali termini [INC-04]", async ({ page, request }, testInfo) => {
    test.fail(true, "INC-04: predlogu in sprejetemu terminu se nastavi end_time = start_time");
    const poll = await createPoll(request, `Trajanje predloga ${RUN}`);
    await apiSuggest(request, poll, "Ana", [`${d12.iso}T17:00:00`]);

    await page.goto(adminUrl(poll));
    const cal = calendar(suggestionsSection(page));
    await showMonth(cal, d12);
    await dayButton(cal, d12.day).click();
    await page.getByRole("button", { name: "Sprejmi → dodaj v poll" }).click();
    await expect(page.locator("form div.cursor-pointer")).toHaveCount(3);

    const slot = (await apiGetPoll(request, poll.share_token)).time_slots[2];
    test.info().annotations.push({ type: "dejanski rezultat", description: `${slot.start_time} – ${slot.end_time}` });
    expect(slot.end_time).toMatch(new RegExp(`^${d12.iso} 18:00`));
  });

  test("TC-L2-04: zavrnjen predlog ostane zavrnjen po ponovnem nalaganju [INC-05]", async ({ page, request }, testInfo) => {
    test.fail(true, "INC-05: »Zavrni« spremeni samo stanje v brskalniku, strežnik ničesar ne shrani");
    const poll = await createPoll(request, `Zavrnitev predloga ${RUN}`);
    await apiSuggest(request, poll, "Ana", [`${d12.iso}T17:00:00`, `${d13.iso}T17:00:00`]);

    await page.goto(adminUrl(poll));
    const section = suggestionsSection(page);
    await expect(section).toContainText("Predlogi udeležencev(2)");
    const cal = calendar(section);
    await showMonth(cal, d13);
    await dayButton(cal, d13.day).click();
    await page.getByRole("button", { name: "Zavrni" }).click();
    await expect(section).toContainText("Predlogi udeležencev(1)");

    await page.reload();
    await evidence(page, testInfo, "TC-L2-04_po-osvezitvi");
    await expect(suggestionsSection(page)).toContainText("Predlogi udeležencev(1)", { timeout: 3000 });
  });

  test("TC-L2-05: podrobnosti predloga prikažejo predlagani datum in uro [INC-06]", async ({ page, request }, testInfo) => {
    test.fail(true, "INC-06: v »Predlog od …:« manjkata datum in ura");
    const poll = await createPoll(request, `Podrobnosti predloga ${RUN}`);
    await apiSuggest(request, poll, "Ana", [`${d12.iso}T17:00:00`]);

    await page.goto(adminUrl(poll));
    const section = suggestionsSection(page);
    const cal = calendar(section);
    await showMonth(cal, d12);
    await dayButton(cal, d12.day).click();
    await expect(section.getByText("Predlog od Ana")).toBeVisible();
    await evidence(page, testInfo, "TC-L2-05_podrobnosti-predloga");
    await expect(section.getByText(`Predlog od Ana: ${d12.iso}`)).toBeVisible({ timeout: 3000 });
  });
});
```

## 3. TS-L3 – Potrditev termina in .ics

Vir: [e2e/tests/TS-L3-potrditev-termina.spec.js](../e2e/tests/TS-L3-potrditev-termina.spec.js) · testnih primerov: 8

```js
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
```

## 4. Pomožne funkcije – testni podatki, koledar, dokazila

Vir: [e2e/helpers/app.js](../e2e/helpers/app.js)

```js
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
```

## 5. Pomožne funkcije – odložišče e-pošte in .ics

Vir: [e2e/helpers/outbox.js](../e2e/helpers/outbox.js)

```js
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
```

## 6. Testno okolje

### 6.1 Docker Compose – testna konfiguracija

Vir: [e2e/compose.e2e.yaml](../e2e/compose.e2e.yaml)

```yaml
# Testno okolje za funkcionalne (E2E) teste – naloga 3.
# Zagon (iz mape e2e/):  npm run env:up      Ustavitev:  npm run env:down
#
# E-pošta: backend pošilja prek `curl` na api.resend.com. V testnem okolju
#  - je pošiljanje vklopljeno (DISABLE_EMAILS=false), da se e-pošta in .ics dejansko zgradita,
#  - `curl` zamenja testni dvojnik (fake-curl.sh), ki e-pošto zapiše v e2e/.outbox/,
#  - je api.resend.com preusmerjen na 127.0.0.1 (varovalka: nič ne zapusti vsebnika).
services:
  app:
    environment:
      DISABLE_EMAILS: "false"
    extra_hosts:
      - "api.resend.com:127.0.0.1"
    volumes:
      - ./e2e/fake-curl.sh:/usr/local/bin/curl:ro
      - ./e2e/.outbox:/tmp/outbox

  # Baza in Mailpit nista izpostavljena gostitelju (trk z lokalnim PostgreSQL na 5432;
  # Mailpit backend sploh ne uporablja).
  db:
    ports: !reset []
  mailpit:
    ports: !reset []
```

### 6.2 Testni dvojnik za curl (e-pošta ne zapusti vsebnika)

Vir: [e2e/fake-curl.sh](../e2e/fake-curl.sh)

```sh
#!/bin/sh
# Testni dvojnik (test double) za `curl` v testnem okolju naloge 3.
# Backend pošilja e-pošto z `curl ... https://api.resend.com/emails -d <json>`.
# Ta skripta se v vsebniku namesti v /usr/local/bin (pred /usr/bin v PATH),
# vsebino zahteve zapiše v /tmp/outbox/*.json in vrne HTTP 200 – nobena zahteva
# ne zapusti vsebnika. Testi iz odložišča preberejo prejemnike, zadevo in priponko .ics.
out=/tmp/outbox
mkdir -p "$out"
data=""
ofile=""
while [ $# -gt 0 ]; do
  case "$1" in
    -d|--data) shift; data="$1" ;;
    -o) shift; ofile="$1" ;;
    -w|-X|-H) shift ;;
  esac
  shift
done
f="$out/$(date +%s)-$$.json"
case "$data" in
  @*) cat "${data#@}" > "$f" ;;
  *) printf '%s' "$data" > "$f" ;;
esac
[ -n "$ofile" ] && printf '{"id":"e2e-outbox"}' > "$ofile"
printf '200'
```

### 6.3 Preverjanje pripravljenosti okolja

Vir: [e2e/global-setup.js](../e2e/global-setup.js)

```js
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
```

### 6.4 Konfiguracija Playwright

Vir: [e2e/playwright.config.js](../e2e/playwright.config.js)

```js
// Funkcionalni (E2E) testni scenariji – naloga 3 (ZK).
// Predpogoj: teče testno okolje (npm run env:up), glej README.md v tej mapi.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Scenariji preverjajo skupno odložišče e-pošte, zato tečejo zaporedno.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: "./global-setup.js",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "rezultati/rezultati.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    locale: "sl-SI",
    timezoneId: "Europe/Ljubljana",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
```
