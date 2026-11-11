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
