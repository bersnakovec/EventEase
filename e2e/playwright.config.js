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
  // Rezultati: konzola (list), HTML za ljudi, JSON + JUnit XML za orodja; v CI še opombe GitHub Actions.
  reporter: [
    [process.env.CI ? "github" : "list"],
    ...(process.env.CI ? [["list"]] : []),
    ["html", { open: "never" }],
    ["json", { outputFile: "rezultati/rezultati.json" }],
    ["junit", { outputFile: "rezultati/junit.xml" }],
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
