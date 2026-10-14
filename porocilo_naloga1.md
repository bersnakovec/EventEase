# Poročilo – Naloga 1 (ZK): EventEase

**Ekipa:** Jure Antolič, Lenart Beršnak
**Projekt:** EventEase (Praktikum II) – React 19 + Vite (frontend), Zig 0.16 (backend), PostgreSQL 16, nginx, Docker Compose
**Datum pregleda:** 14. 10. 2026

> Opomba: opažanja v poglavju 1 so zbrana na podlagi dejanskega preverjanja (branje dokumentacije, ročni zagon `npm ci`, `npm run lint`, `npm test`, `npm run build`, `zig build`, `zig build test`). Celotnega `docker compose up --build` v tem pregledu nismo zagnali, zato je označeno, kaj je preverjeno in kaj je ugotovljeno samo iz branja kode. Opažanja ostalih članov ekipe se dodajo v tabelo 1.2 (stolpec »Vir«).

---

## 1. Preverjanje dokumentacije (README.md) in namestitve

### 1.1 Kaj je bilo preverjeno

| Korak iz dokumentacije | Rezultat |
|---|---|
| `npm ci` v `frontend/EventEase` (Node 24, Windows 11) | ✅ uspe |
| `npm run lint` | ✅ brez napak |
| `npm test` (5 testov) | ✅ 5/5 uspešnih |
| `npm run build` | ✅ uspe (294 kB JS, 40 kB CSS) |
| `zig build` v `backend/logic` (Zig 0.16.0, Windows) | ⚠️ prvi zagon: `error: failed to check cache: 'zig-pkg\...\build.zig' file_hash FileNotFound`; ponovni zagon uspe |
| `zig build test` | ✅ 6/6 testov uspešnih |
| `docker compose up --build` | ⏳ ni zagnano v tem pregledu (le branje `Dockerfile`/`compose.yaml`) |

### 1.2 Neskladja, nejasnosti in pomanjkljivosti

| # | Resnost | Opažanje | Predlog popravka |
|---|---|---|---|
| D1 | Visoka | README pravi `cd Praktikum2`, mapa repozitorija pa se imenuje `EventEase`. Enako je v drevesu »Struktura repozitorija« (`Praktikum2/`). Tudi `git clone <repo>` nima dejanskega URL-ja (v `_PROMOCIJA/EventEase.txt` je naveden `https://github.com/JAntFeri/EventEase`). | Zapisati konkreten URL in `cd EventEase`. |
| D2 | Visoka | Poglavje »Lokalni razvoj« zahteva `psql -U admin -d eventeasedb -f ...`, vendar ne pove, da je treba uporabnika `admin` in bazo `eventeasedb` najprej ustvariti (`CREATE USER`/`CREATE DATABASE`) niti da mora PostgreSQL 16 že teči. Dokumentirano ni niti, da je shema v `backend/database/` zastarela (glej D3). | Dodati ukaze za ustvarjanje uporabnika in baze ali priporočiti `docker compose up db`. |
| D3 | Visoka | **Dve različni shemi:** `backend/database/podatkovna_shema.sql` (naveden v README in v znački) ni enak `backend/logic/src/podatkovna_shema.sql` (vgrajen v binarko z `@embedFile` in izvajan ob zagonu). Razlike: v src-različici je stolpec `votes.participant_email`, uporablja `IF NOT EXISTS` (idempotentno), v database-različici pa manjka `participant_email`, zato ročna uporaba te sheme povzroči napako pri glasovanju. Backend shemo itak izvede sam (`db.migrate`), torej je korak 1 »poženi shemo« nepotreben ali celo zavajajoč. | Obdržati samo eno shemo (vir resnice) ali jo kopirati ob gradnji; v README zapisati, da backend sam migrira bazo. |
| D4 | Visoka | **Pošiljanje e-pošte v lokalnem razvoju:** `emailsEnabled()` vrne `true`, če `DISABLE_EMAILS` ni nastavljena. README v razdelku »Lokalni razvoj« te spremenljivke ne omenja, zato brez nje (in brez `RESEND_API_KEY`) zahteve, ki pošljejo e-pošto, vrnejo napako/zapišejo `RESEND_API_KEY not set`. | V README dodati `export DISABLE_EMAILS=true` ali opisati `RESEND_API_KEY`. |
| D5 | Visoka | **Mailpit je dokumentiran, a ga backend ne uporablja.** README trdi »Mailpit UI na :8025«, v `compose.yaml` je storitev `mailpit`, obstaja `msmtprc`, toda Zig koda pošilja e-pošto prek Resend HTTP API-ja (`sendEmail` → `RESEND_API_KEY`). Stara koda za `msmtp` je bila v `routes.zig` le zakomentirana. Mailpit torej v pošti ne prestreže ničesar; `msmtprc` v korenu je mrtva datoteka. Ob `DISABLE_EMAILS=true` se pošta sploh ne pošlje. | Odstraniti Mailpit/`msmtprc` ali implementirati SMTP pot; popraviti README. |
| D6 | Srednja | `.env` je v `compose.yaml` neobvezen (`required: false`), v dokumentaciji pa ni naveden niti ni `.env.example` (v `.gitignore` je celo izjema `!.env.example`, datoteke pa ni). Spremenljivki `RESEND_API_KEY` in `PORT` nista dokumentirani. | Dodati `.env.example` in tabelo spremenljivk (`DATABASE_URL`, `DISABLE_EMAILS`, `RESEND_API_KEY`, `PORT`). |
| D7 | Srednja | **Operacijski sistemi:** (a) `Dockerfile` prenese `zig-x86_64-linux-0.16.0`, zato gradnja na ARM računalnikih (Apple Silicon, Raspberry Pi, Windows on ARM) brez emulacije ne uspe; (b) ukazi `export ...` v README delujejo samo v bash/zsh, v Windows PowerShellu je treba `$env:DATABASE_URL="..."`, v cmd `set`; (c) README ne navaja zahtevanih predpogojev (Docker Desktop z WSL2 na Windows, Node 24, Zig 0.16, PostgreSQL 16); (d) `scripts/ci-smoke-test.sh` ima v Windows checkoutu CRLF konce vrstic (`core.autocrlf=true`), zato ga bash v Linuxu/WSL ne izvede (`$'\r': command not found`) – manjka `.gitattributes` z `*.sh text eol=lf`; (e) skripta zahteva `jq`, kar README ne omenja. | Dodati razdelek »Predpogoji po OS«, uporabiti `TARGETARCH` v Dockerfile, dodati `.gitattributes`. |
| D8 | Srednja | Zig se pri prvem zagonu na Windows lahko ustavi z napako o predpomnilniku (`failed to check cache ... FileNotFound`), ponovni zagon uspe. Dokumentacija ne omenja potrebe po internetu za prenos odvisnosti (`http.zig`, `pg.zig`) ob prvi gradnji. | Dodati opombo (po potrebi `zig build --fetch` ali brisanje `.zig-cache`/`zig-pkg`). |
| D9 | Srednja | Začetno stanje: README pravi »Baza se inicializira samodejno«, kar velja (`db.migrate`), a ne pove, da je podatkovni nosilec `db-data` obstojen (po spremembi sheme je treba `docker compose down -v`) in da so vrata `5432`, `8080`, `8025`, `1025` morda že zasedena. Izpostavitev PostgreSQL (`5432:5432`) z geslom `admin/admin` je varnostno tveganje, če se compose uporabi zunaj lokalnega računalnika. | Dokumentirati in po možnosti odstraniti objavo vrat 5432. |
| D10 | Srednja | Arhitektura v README (»nginx streže statiko«) ni povsem točna: Zig backend ima lasten `static.zig`, ki streže datoteke iz `/usr/share/nginx/html` (trdo kodirana pot, ki v lokalnem razvoju ne obstaja). API pot `POST /api/polls/share-email` obstaja v `main.zig`, v tabeli API poti v README pa je ni. | Dopolniti tabelo API poti in opis arhitekture. |
| D11 | Nizka | HTML predloga e-pošte vsebuje trdo kodiran URL logotipa `eventease-production-5c24.up.railway.app/logo.png`, drugačen od domače strani iz README (`eventeaseapp.up.railway.app`). | Prestaviti v konfiguracijo. |
| D12 | Nizka | V repozitoriju so odvečne/nedokumentirane datoteke: `frontend/fn.txt` (rezultat grep-a), `frontend/EventEase/i18j.js` (uvaža `i18next` in `./locales/es.json`, ki ne obstajata ter `i18next` ni v `package.json`; je izven uporabe, `si.json` je prazen, `en.json` ima 3 vrstice), `Info_doc.pdf`, mapa `_PROMOCIJA`. Koda ima tudi `console.log` v `CreateEventPage.jsx` in ime `si.json` namesto ISO kode `sl`. | Odstraniti ali dokumentirati. |
| D13 | Nizka | README navaja »Vite 8«, »ESLint« in CI (`ci.yml`), vendar ne dokumentira ukazov `npm run lint`, `npm test`, `zig build test` in smoke-testa. | Dodati razdelek »Testiranje«. |

**Povzetek:** dokumentacija za zagon z Dockerjem je v osnovi pravilna in zadostna (če so vrata prosta in je arhitektura x86_64), medtem ko je razdelek »Lokalni razvoj« nepopoln (D2–D6) in vsebuje neskladja z dejanskim stanjem kode (D3, D5).

---

## 2. Standardi kodiranja

### 2.1 Standardi, ki smo jih (implicitno) uporabljali

| Področje | Zig (backend) | JavaScript/React (frontend) |
|---|---|---|
| Datoteke | `snake_case`/male črke (`routes.zig`, `uuid.zig`, `cleanup.zig`) | Komponente `PascalCase.jsx` (`CalendarPicker.jsx`), pomožne datoteke `camelCase.js` (`eventHelpers.js`), testi `*.test.js` |
| Funkcije | `camelCase` (`createPoll`, `cleanupLoop`) – Zig standard | `camelCase` (`organizerNameFromEmail`, `handleEventCreation`); komponente `PascalCase` |
| Tipi/strukture | `PascalCase` (`App`, `Slot`, `VoteOption`) | – |
| Spremenljivke | `snake_case` (`poll_id_str`, `share_token`) | `camelCase` (`activeEvent`, `suggestedDates`) |
| Konstante | `snake_case`/`PascalCase` za tipe (`MimeMap`) | `camelCase` |
| JSON polja API-ja, SQL | `snake_case` (`share_token`, `time_slots`) | `snake_case` pri uporabi API-ja |
| Oblikovanje | 4 presledki, `zig fmt` | 2 presledka, enojni ali dvojni narekovaji (neenotno), ESLint `recommended` + `react-hooks` + `react-refresh` |
| Komentarji | `//` oddelki z ločilnimi črtami (`// ---- Email helpers ----`) | `{/* ... */}` v JSX, `//` drugje |
| Gnezdenje | Zgodnje vračanje (`orelse return`), `defer` za čiščenje | Pogojno upodabljanje, zgodnje vračanje v komponentah |
| Verzioniranje/CI | Fiksirana različica Zig (0.16.0) v `build.zig.zon` in CI | Zaklenjene odvisnosti (`package-lock.json`, `npm ci`) |

Uradno posebnega dokumenta s standardi nismo imeli; izhajali smo iz konvencij jezikov (Zig style guide, ESLint priporočila).

### 2.2 Ugotovljena odstopanja

1. **Podvojena koda:** `routes.zig` je imel lastno funkcijo `uuidV4Hex`, ki je kopija `uuid.uuidV4` iz `uuid.zig` (kršitev DRY; napaka bi se popravljala na dveh mestih, `uuid.zig` je imel teste, kopija pa ne).
2. **Zakomentirana mrtva koda:** v `routes.zig` ~40 vrstic zakomentirane `msmtp` implementacije skupaj z opombo »Scammani iz strani railwaya…« in komentarjem »--- ADD THIS LINE ---«.
3. **Mešanje jezikov:** komentarji, nizi in opombe so deloma v slovenščini, deloma v angleščini (npr. `App.jsx`: »The page wrapper we created earlier«), poimenovanje datotek pa je ponekod slovensko (`podatkovna_shema.sql`, `EventEaseIkonca.svg`), identifikatorji angleški.
4. **Neenotno oblikovanje JS:** mešani narekovaji (`'…'` v `LandingPage.jsx`, `"…"` v `main.jsx`), manjkajoči končni znak vrstice, odvečne prazne vrstice, nekonsistentna uporaba podpičij.
5. **Neustrezni komentarji:** komentarji, ki opisujejo zgodovino razvoja in ne kode (`// 1. Import Tailwind`, `// <-- This must sit right here`).
6. **Dolge datoteke/funkcije:** `routes.zig` (~1100 vrstic) združuje usmerjanje, poslovno logiko, e-pošto in generiranje ICS; `InviteView.jsx` (637 vrstic) in `CalendarPicker.jsx` (535 vrstic) presegata običajno mejo.
7. **Dolge vrstice:** podpisi funkcij v `routes.zig` (npr. `sendFinalizationEmail`) presegajo 120 znakov.
8. **Neuporabljena/pokvarjena datoteka:** `i18j.js` (neobstoječe uvoze).

### 2.3 Dogovorjeni standardi (ekipni povzetek)

- **Imena:** Zig – tipi `PascalCase`, funkcije `camelCase`, spremenljivke in polja `snake_case`; JS – spremenljivke/funkcije `camelCase`, komponente in njihove datoteke `PascalCase`, konstante `UPPER_SNAKE_CASE` samo za prave konstante; SQL in JSON `snake_case`.
- **Jezik:** koda, identifikatorji in komentarji v angleščini; uporabniško vidna besedila (UI, e-pošta) v slovenščini, vsa besedila naj bodo v lokalizacijskih datotekah.
- **Oblikovanje:** Zig – `zig fmt` (4 presledki); JS – 2 presledka, dvojni narekovaji, podpičja, datoteka se konča z novo vrstico, največ ~100 znakov na vrstico; LF konci vrstic (`.gitattributes`).
- **Komentarji:** komentiramo *zakaj*, ne *kaj*; JSDoc/`///` za javne funkcije; mrtve kode ne komentiramo ven (zgodovina je v Gitu); TODO samo s kontekstom.
- **Gnezdenje:** največ 3 ravni gnezdenja, zgodnji `return`; datoteke > ~500 vrstic razbijemo na module.
- **DRY:** skupne pomožne funkcije le na enem mestu (`uuid.zig`, `utils/`).
- **Preverjanje:** `zig fmt --check`, `npm run lint` in testi morajo preiti v CI pred združitvijo.

### 2.4 Popravljena datoteka

Kot zahteva naloga smo v skladu z zgoraj definiranimi standardi popravili **[backend/logic/src/routes.zig](backend/logic/src/routes.zig)**:

- odstranjena podvojena funkcija `uuidV4Hex` (24 vrstic), vseh 8 klicev zamenjanih z `uuid.uuidV4(...)` iz `uuid.zig` (dodan `const uuid = @import("uuid.zig");`),
- odstranjen ~40-vrstični zakomentirani blok z `msmtp`,
- datoteka se je skrajšala s 1164 na 1094 vrstic.

**Preverjanje popravka:** `zig build` uspe brez napak, `zig build test` – 6/6 testov uspešnih. Funkcionalnost API-ja z docker smoke testom po popravku nismo ponovno zagnali (to opravi CI).

---

## 3. Stanje testiranja in zagotavljanja kakovosti

| # | Aktivnost | Vrsta | Stanje | Pokriti del rešitve | Orodja/ogrodja | Uporaba UI* |
|---|---|---|---|---|---|---|
| Q1 | Enotni testi frontenda | Avtomatsko, enotno testiranje | Prisotno, 5 testov, vsi uspešni (preverjeno) | Samo `src/utils/eventHelpers.js` (3 pomožne funkcije). Komponente, strani in klici API-ja **niso** pokriti. | `node:test` + `node:assert/strict` (vgrajeno v Node 24), `npm test` | Glej opombo |
| Q2 | Enotni testi backenda | Avtomatsko, enotno testiranje | Prisotno, 6 testov, vsi uspešni (preverjeno) | Samo `uuid.zig` (pretvorbe, generiranje, validacija UUID). Poti (`routes.zig`), baza, e-pošta in ICS niso pokriti. | Vgrajeni `zig test` (`zig build test`) | Glej opombo |
| Q3 | API smoke test | Avtomatsko, integracijsko/sistemsko | Prisotno, teče v CI; lokalno ni bil zagnan v tem pregledu | Celoten tok: ustvarjanje ankete → GET → glas → finalizacija → preverjanje `is_finalized`. Ne pokriva: predlogov terminov (`suggest`, `accept-suggestion`), `share-email`, napačnih žetonov, robnih primerov. | `scripts/ci-smoke-test.sh` (bash, `curl`, `jq`), Docker Compose | Glej opombo |
| Q4 | Statična analiza (lint) | Statična analiza | Prisotno, brez opozoril (preverjeno) | Frontend (`*.js`, `*.jsx`) | ESLint 10 (`@eslint/js`, `react-hooks`, `react-refresh`) | – |
| Q5 | Prevajalnik kot preverjanje tipov | Statična analiza | Prisotno | Backend (Zig compile-time preverjanja), frontend gradnja (`vite build`) | `zig build`, Vite | – |
| Q6 | Zvezna integracija (CI) | Avtomatizacija kakovosti | Prisotno, `.github/workflows/ci.yml` | Ob `push`/`pull_request` na `main/master`: frontend (`npm ci`, lint, test, build), backend (`build`, `test`), Docker build + smoke test, `docker compose down -v` | GitHub Actions (`setup-node`, `setup-zig`), Docker Compose | – |
| Q7 | Ročno funkcionalno testiranje | Ročno, sistemsko/sprejemno | Prisotno, neformalno, brez zapisnika | Uporabniški tokovi iz GIF-ov in posnetkov v `docs/` in `_PROMOCIJA/` (ustvarjanje, deljenje, glasovanje, potrditev, temni/svetli način); produkcijska namestitev na Railway | Brskalnik, Mailpit (lokalno) | – |
| Q8 | Pregled kode | Ročno, vzajemni pregled | Delno (GitHub pull requesti, ni formalnega postopka) | Poljubni deli | GitHub | – |
| Q9 | Formatiranje | Statična analiza | **Ni prisotno** (`zig fmt --check` in Prettier se ne izvajata) | – | – | – |

**Manjkajoče aktivnosti (priporočila):** pokritost kode (npr. `c8`/`kcov`), testi React komponent (Vitest + Testing Library), e2e testi (Playwright) za glavne tokove, integracijski testi API-ja z bazo za `suggest`/`accept-suggestion`/napake (4xx), varnostno preverjanje (`npm audit`, Dependabot), preverjanje CRLF/LF v CI, formalen testni načrt s primeri za ročno testiranje, in `zig fmt --check`/Prettier v CI.

\* **Uporaba umetne inteligence:** v repozitoriju ni zapisa o tem, katere testne artefakte je ustvarila UI. Dejstva, ki jih lahko trdimo: (1) pri tem pregledu je bil kot pomoč uporabljen *Claude Code* (Sonnet 5.5) za zagon preverjanj, analizo odstopanj in popravek `routes.zig`; rezultat je bil preverjen z ponovnim zagonom `zig build` in `zig build test` (vse uspešno) ter z ročnim pregledom razlike. (2) Za izvorne teste iz Praktikuma II (Q1–Q3) **vsak član ekipe dopolni**, ali in s katerim orodjem je bila UI uporabljena (npr. ChatGPT/Copilot/Claude) ter kako je bil rezultat preverjen (ročni pregled, zagon testov, pregled v CI). Brez te informacije UI-uporabe pri Q1–Q9 ne navajamo kot dejstva.

---

## 4. Zaključek

- Dokumentacija omogoča uspešen zagon z Dockerjem, vendar ima razdelek za lokalni razvoj več vrzeli in neskladij (dve shemi, nedokumentirane spremenljivke, Mailpit, ki ni povezan z backendom, podpora za OS/arhitekture).
- Standardi kodiranja so bili uporabljani implicitno; v tem poročilu smo jih eksplicitno definirali in v skladu z njimi popravili `routes.zig`.
- Testiranje je zasnovano na treh avtomatskih ravneh (enotni testi, smoke test, lint) in CI, vendar je pokritost izrazito ozka (samo pomožne funkcije in en integracijski tok) – prednostna naloga je razširitev testov na poti API-ja in komponente frontenda.
