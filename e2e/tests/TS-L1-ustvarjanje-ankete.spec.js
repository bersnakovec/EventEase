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
