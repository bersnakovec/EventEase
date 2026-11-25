# Poročilo – Naloga 5 (ZK): Avtomatizirano funkcionalno testiranje EventEase

**Avtor:** Lenart Beršnak · **Datum:** 25. 11. 2026 · **Različica:** `main`, `ac4a330` · **Orodje:** Playwright 1.56.1 (Chromium)

**Uporaba UI:** Claude Code (VS Code) z modelom Claude Opus 5.5 (naročnina Max) za pregled obstoječe avtomatizacije, dopolnitev poročanja v cevovodu, pripravo in izvedbo namerno vnesenih napak, analizo rezultatov in osnutek poročila.

## 1. Izbira orodja

EventEase je sestavljen iz frontenda v Reactu 19 (Vite), backenda v Zigu (httpz), baze PostgreSQL in strežnika nginx, vse skupaj pa teče v Docker Compose. Funkcionalne teste izvajamo po metodi črne skrinjice prek brskalnika, zato orodje ni vezano na Zig. Pomembno je le, da dobro deluje s spletnim vmesnikom in da ga lahko zaženemo v CI.

| Kriterij | **Playwright** | Cypress | Selenium WebDriver |
|---|---|---|---|
| Brez grafičnega vmesnika | privzeto (headless) | da (`cypress run`) | da, z nastavitvijo brskalnika |
| Kaj potrebuje v cevovodu | Node + `npx playwright install --with-deps chromium` (brskalnik in sistemske knjižnice v enem koraku) | Node + Cypressov binarni paket + Xvfb | jezikovni odjemalec, brskalnik **in** ujemajoč gonilnik (ali Selenium Grid) |
| Več zavihkov/uporabnikov v enem testu | da (`context.newPage()`) | ne (en zavihek) | da, okorneje |
| Klici API v istem testu | da (`request`, za predpogoje in preverjanje stanja) | da (`cy.request`) | ne (ločena knjižnica) |
| Oblika rezultatov | list, HTML, JSON, **JUnit XML**, opombe GitHub, posnetki zaslona, sled (trace) | konzola, posnetki, video, JUnit (vtičnik) | odvisno od testnega ogrodja |

**Izbrali smo Playwright.** Scenariji zahtevajo, da v istem testu nastopata organizator in udeleženec (skrbniški pogled in povezava za glasovanje), predpogoje (ankete z glasovi) pa pripravimo prek API. Playwright podpira oboje brez dodatkov, ne potrebuje ločenega gonilnika in pozna JUnit ter opombe GitHub Actions. Teste pišemo v JavaScriptu, ki ga ekipa že uporablja na frontendu. Orodje je bilo nameščeno že v nalogi 3 (`e2e/`, `npm ci` + `npx playwright install chromium`). V tej nalogi smo dopolnili poročanje v cevovodu (2) in preverili, ali testi zaznajo vnesene napake (4).

## 2. Vključitev v cevovod

Job `e2e` v [ci.yml](.github/workflows/ci.yml) (GitHub Actions) se zažene po uspešnih jobih `frontend` (lint, testi enot s pokritostjo) in `backend` (testi Zig):

1. `npm ci` in `npx playwright install --with-deps chromium` namestita **brskalnik** in sistemske knjižnice. Runner je fiksiran na `ubuntu-24.04`, ker Playwright 1.56 Ubuntuja 26 še ne podpira.
2. `npm run env:up` zgradi in zažene **aplikacijo** z `docker compose` (ločen projekt `eventease-e2e`) skupaj s **svežo testno bazo** PostgreSQL. Testni dvojnik `curl` piše e-pošto v `e2e/.outbox`, `api.resend.com` je preusmerjen na 127.0.0.1. `global-setup.js` testov ne zažene, če API ni pripravljen ali varovalke za e-pošto niso aktivne.
3. `npm test` zažene 18 primerov zaporedno brez grafičnega vmesnika. **Neuspešen primer da neničelno izhodno kodo in ustavi cevovod.** Primeri znanih napak so označeni s `test.fail()` (INC-xx). Če tak primer nepričakovano uspe (napaka je odpravljena), cevovod prav tako pade, da oznako odstranimo.
4. Rezultati (dopolnjeno v tej nalogi):
   - **opombe GitHub** (reporter `github`): neuspeh se prikaže pri vrstici testa,
   - **povzetek zagona** ([povzetek.js](e2e/povzetek.js) → `$GITHUB_STEP_SUMMARY`): tabela vseh primerov z izidom in prvo vrstico napake,
   - **artefakt `e2e-report`**: HTML poročilo, `rezultati.json`, `junit.xml`, posnetki zaslona in sled ob neuspehu.
5. `npm run env:down` (vedno) odstrani vsebnike in bazo.

## 3. Avtomatizirani testni primeri

Avtomatizirani so vsi primeri mojih scenarijev iz naloge 3 ([porocilo_naloga3.md](porocilo_naloga3.md), poglavje 4):

| Scenarij | Primeri | Uspešni | Znane napake (`test.fail`) |
|---|---|---|---|
| TS-L1 Ustvarjanje ankete | TC-L1-01 … 05 | L1-01, L1-02 | INC-01, 02, 03 |
| TS-L2 Predlog termina in sprejem | TC-L2-01 … 05 | L2-01, L2-02 | INC-04, 05, 06 |
| TS-L3 Potrditev termina in .ics | TC-L3-01 … 08 | L3-01, L3-02, L3-04 | INC-07 … 11 |
| **Skupaj** | **18** | **7** | **11** |

Kontrolni zagon na nespremenjeni kodi (lokalno, 25. 11. 2026): **18/18 po pričakovanjih**, ~30 s ([izpis](e2e/mutacije/kontrola-brez-mutacij.txt)). V CI na `main` (`ac4a330`) so vsi jobi uspešni: [zagon 45620042397](https://github.com/bersnakovec/EventEase/actions/runs/45620042397).

## 4. Namerno vnesene napake

Za vsak scenarij smo v en uspešen primer vnesli napako, ki posnema realno regresijo. Vsako smo najprej preizkusili posamično (lokalno, ponovna izgradnja okolja), nato vse tri skupaj na veji `naloga5-mutacije` v CI. Spremembe so shranjene kot `.patch` v [e2e/mutacije/](e2e/mutacije/).

| | Vnesena napaka | Testi enot | E2E (Playwright) | Dokaz |
|---|---|---|---|---|
| **M1** | frontend: `CreateEventPage.jsx` ne preveri več, da je izbran vsaj en termin | 105/105 ✅ (ne zazna) | ❌ **TC-L1-02**, korak 3: sporočilo »Prosimo, izberite vsaj en termin« se ne prikaže, anketa brez termina se ustvari | [izpis](e2e/mutacije/M1-izpis.txt), [posnetek](e2e/dokazi/M1_TC-L1-02_anketa-brez-termina.png) |
| **M2** | backend: `acceptSuggestion` označi predlog kot »accepted«, ne vstavi pa ga med termine | 24/24 ✅ (ne zazna) | ❌ **TC-L2-02**, korak 4: pričakovani 3 termini, prikazana 2 | [izpis](e2e/mutacije/M2-izpis.txt), [posnetek](e2e/dokazi/M2_TC-L2-02_sprejet-predlog-ni-termin.png) |
| **M3** | backend: `finalizePoll` izpusti preverjanje `email.len == 0`, zato se obvestilo pošlje tudi udeležencu brez e-naslova | 24/24 ✅ (ne zazna) | ❌ **TC-L3-02**, korak 5: med prejemniki je prazen naslov (po popravku testa, glej spodaj); ❌ TC-L3-04: 4 e-pošte namesto 3 | [izpis](e2e/mutacije/M3-izpis.txt) |

Vse tri napake je zaznal E2E. Testi enot jih ne zaznajo, ker pokrivajo samo čiste funkcije (štetje glasov, .ics, UUID), te napake pa so v obdelavi obrazca in zahtev HTTP z bazo.

**Stranski učinek M2:** padel je tudi TC-L3-07 (znana napaka INC-10), ker kot predpogoj potrebuje sprejet predlog. Namesto pričakovanega neuspeha je potekel čas (timeout), kar Playwright šteje kot nepričakovan izid. Tudi primer z oznako `test.fail` torej opozori, ko se obnašanje spremeni drugače od znane napake.

**Napaka v testu, odkrita z M3:** v prvem zagonu je TC-L3-02 kljub M3 **uspel** ([izpis](e2e/mutacije/M3-izpis-pred-popravkom-testa.txt)), napako je ujel le TC-L3-04. Vzrok je bil orakelj `expect(prejemniki).toEqual([...])`. Pomožna funkcija za e-pošto s praznim prejemnikom vrne `undefined`, `toEqual` pa elemente `undefined` v tabeli ignorira, zato je `[a, b, c, undefined]` zanj enako `[a, b, c]`. Primer smo popravili na `toStrictEqual` (commit `ac4a330`). S popravkom TC-L3-02 napako zazna, kontrolni zagon brez mutacij pa ostane zelen. Drugih uporab `toEqual` v testih ni.

**CI:** veja `naloga5-mutacije` (`4e736c1`, vse tri mutacije, sprožilec CI dodan samo na tej veji): [zagon 45620042801](https://github.com/bersnakovec/EventEase/actions/runs/45620042801). Joba `frontend` in `backend` (lint, testi enot, pokritost) sta **uspešna**, job `e2e` pa je **neuspešen**: 5 nepričakovanih izidov (TC-L1-02, TC-L2-02, TC-L3-02, TC-L3-04, TC-L3-07), vsak kot opomba pri vrstici testa. To se ujema z lokalnimi zagoni.

## 5. Ugotovitve

- Playwright se v cevovod vključi brez posebnosti: brskalnik namesti en ukaz, aplikacija in testna baza tečeta v Docker Compose, rezultati so na voljo kot izhodna koda, opombe, povzetek in artefakti.
- Vse tri vnesene napake je E2E zaznal pri ciljnem primeru, testi enot pa nobene. Obe vrsti testov se dopolnjujeta.
- Vnašanje napak je preverilo tudi same teste. Orakelj v TC-L3-02 je bil prešibak in je popravljen.
- Omejitev: na scenarij smo vnesli eno napako, kar ne zadošča za oceno deleža zaznanih napak (mutation score). Primerno orodje za sistematično mutacijsko testiranje frontenda bi bil Stryker.

## 6. Datoteke

| Pot | Vsebina |
|---|---|
| [e2e/playwright.config.js](e2e/playwright.config.js) | konfiguracija, reporterji (list/github, HTML, JSON, JUnit) |
| [e2e/povzetek.js](e2e/povzetek.js) | povzetek rezultatov za GitHub Actions |
| [e2e/tests/](e2e/tests/) | testni scenariji TS-L1 … TS-L3 |
| [e2e/mutacije/](e2e/mutacije/) | popravki `.patch` M1–M3, izpisi zagonov, navodila za ponovitev |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | job `e2e` |
