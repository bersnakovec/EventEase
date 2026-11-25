// Posnetki zaslona MantisBT za poročilo naloge 6 (Playwright iz e2e/node_modules). Zagon (iz mape napake/):
//   node skripte/posnetki.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(new URL("../../e2e/package.json", import.meta.url))("@playwright/test");
const MANTIS = "http://localhost:8989";
const OUT = fileURLToPath(new URL("../dokazi", import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, locale: "sl-SI" });
await page.goto(`${MANTIS}/login_page.php`);
await page.fill("#username", "lenart");
await page.click("input[type=submit]");
await page.fill("#password", "lenart");
await page.click("input[type=submit]");
await page.goto(`${MANTIS}/set_project.php?project_id=1`);
await page.goto(`${MANTIS}/view_all_set.php?type=1&hide_status=-2&sort=id&dir=ASC`);
await page.screenshot({ path: `${OUT}/mantis_1_seznam-napak.png`, fullPage: true });
await page.goto(`${MANTIS}/view.php?id=10`);
await page.screenshot({ path: `${OUT}/mantis_2_napaka-INC-10.png`, fullPage: true });
await page.goto(`${MANTIS}/view.php?id=2`);
await page.screenshot({ path: `${OUT}/mantis_3_zaprta-INC-02-zgodovina.png`, fullPage: true });
await page.goto(`${MANTIS}/bug_report_page.php`);
await page.screenshot({ path: `${OUT}/mantis_4_obrazec-za-vpis.png`, fullPage: true });
await page.goto(`${MANTIS}/manage_custom_field_page.php`);
await page.screenshot({ path: `${OUT}/mantis_5_lastna-polja.png`, fullPage: true });
await browser.close();
console.log("posnetki shranjeni v napake/dokazi");
