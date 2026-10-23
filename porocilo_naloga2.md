# Poročilo – Naloga 2 (ZK): Testi enot za EventEase

**Ekipa:** Jure Antolič, Lenart Beršnak, Nikolaj Logar
**Projekt:** EventEase – React 19 + Vite (frontend), Zig 0.16 (backend)
**Datum:** 23. 10. 2026

## 0. Uporabljena orodja generativne umetne inteligence

| Orodje | Namen |
|---|---|
| **Claude Code** (razširitev za VS Code, agentni način) z modelom **Claude Opus 5.5** (naročnina Max) | analiza kode, izbira enot, izvlečenje logike v testabilne module, generiranje testov, vnos namernih napak (mutacij), pregled in popravki testov, integracija v CI, osnutek tega poročila |

Drugih orodij UI nismo uporabili. Celoten ukaz in vprašanja, ki jih je agent zastavil pred začetkom dela, so shranjeni v mapi [Naloga2/](Naloga2/).

---

## 1. Izbrane enote in utemeljitev

V projektu je bila večina netrivialne logike skrita v React komponentah (`VoteResults.jsx`, `CalendarPicker.jsx`) oziroma v `routes.zig`, ki je vezan na HTTP in PostgreSQL. Te logike ni bilo mogoče testirati izolirano, zato smo jo **brez spremembe namena** izvlekli v čiste module. Komponente in poti zdaj uporabljajo te module.

| # | Enota | Datoteka | Zakaj je netrivialna |
|---|---|---|---|
| 1 | **Štetje glasov** – `tallyVotes`, `slovenianVoteLabel` | [voteTally.js](frontend/EventEase/src/utils/voteTally.js) | Združevanje glasov po terminih, dve imeni za isti status (`if_needed`/`if_need_be`), izračun odstotkov z zaokroževanjem, slovenska dvojina in množina po zadnjih dveh števkah. |
| 2 | **Pretvorba in glasovanje za termine** – `formatBackendSlot`, `nextVoteStatus`, `applyVoteStatus`, `cycleVoteStatus`, `getDateStr`, `getTimeStr`, `groupByDate`, `isPastDate` | [slotUtils.js](frontend/EventEase/src/utils/slotUtils.js) | Računanje z datumi (polnoč, konec meseca/leta, prestopni dan, poletni čas), validacija vhodov, stanje glasov kot nespremenljiv objekt, povratni klic (callback). |
| 3 | **Generiranje .ics koledarske datoteke** – `parseTimestamp`, `formatIcsTimestamp`, `escapeText`, `buildIcsContent` | [ics.zig](backend/logic/src/ics.zig) | Razčlenjevanje dveh formatov časa (ISO in `timestamptz::text` iz PostgreSQL), pretvorba časovnih pasov v UTC, koledarska aritmetika, ubežanje besedila po RFC 5545, upravljanje pomnilnika. |

### 1.1 Kako bi morale enote delovati (specifikacija)

**`tallyVotes(slots, votes)`**
- Vrne objekt s ključi = id-ji terminov. Za vsak termin vrne `yesCount`, `yesVoters`, `maybeCount`, `maybeVoters`, `yesPercent`, `maybePercent`.
- Kot »da« se šteje samo `yes`. Kot »če bo potrebno« se štejeta `if_need_be` (backend) in `if_needed` (frontend). Status `no` in neznani statusi se ne štejejo.
- Izbire se berejo iz `choices` ali `date_votes`. Brez imena udeleženca se uporabi `Neznanec`.
- Glasovi za termine, ki niso v anketi, se ignorirajo. Udeleženec šteje največ enkrat na termin (velja njegova zadnja izbira).
- Odstotek = število glasov / število udeležencev, zaokroženo na celo število. Če udeležencev ni, je odstotek 0. V imenovalec štejejo tudi udeleženci brez izbir.
- Vhodnih tabel ne spreminja.

**`slovenianVoteLabel(count)`**: oblika se določi po `count % 100`: 1 → `glas`, 2 → `glasa`, 3–4 → `glasovi`, sicer `glasov` (npr. 101 → `glas`, 111 → `glasov`). Pri negativnem ali necelem vhodu ali vhodu, ki ni število, vrže `RangeError`.

**`formatBackendSlot(date, time, duration = 60)`**
- Iz `YYYY-MM-DD` in `HH:MM` sestavi `{ start_time, end_time }` v obliki `YYYY-MM-DDTHH:MM:00`. Konec je `duration` minut po začetku.
- Prehod čez polnoč, konec meseca, konec leta ali prestopni dan premakne **datum** konca. Na izračun ne vpliva poletni čas lokalnega pasu.
- Neveljaven datum (tudi `2026-02-30`) ali neveljavna ura (`24:00`, `9:00`) vrže `TypeError` s sporočilom o vzroku. Neveljavno trajanje vrže `RangeError`.

**`nextVoteStatus` / `applyVoteStatus` / `cycleVoteStatus`**
- Cikel klikov: `no` → `yes` → `if_needed` → `no`. Status `if_need_be` je enakovreden `if_needed`, neznan status pomeni `no`.
- `applyVoteStatus` vrne **nov** objekt, pri čemer `no` ključ odstrani.
- `cycleVoteStatus` pokliče `onChange` natanko enkrat z novim stanjem. Če `onChange` ni podan ali termin nima ključa (ne id-ja ne datuma), ga ne pokliče in vrne `false`.

**`getDateStr` / `getTimeStr` / `isPastDate`**
- Datum in uro preberejo iz niza ali objekta, ločilo je lahko `T` ali presledek. Če ure ni, se vrne privzeta `12:00`.
- `isPastDate` primerja z **lokalnim** koledarskim dnem, ne z UTC.

**`formatIcsTimestamp(buf, ts)`**
- Sprejme `YYYY-MM-DD[T| ]HH:MM[:SS[.frac]][Z|±HH[[:]MM]]` in vrne UTC obliko `YYYYMMDDTHHMMSSZ`. Pri tem upošteva zamik, tudi kadar se zaradi njega spremeni dan, mesec ali leto.
- Neveljaven ali predolg vhod vrne `error.InvalidTimestamp`, nikoli ne piše čez medpomnilnik.

**`buildIcsContent(alloc, title, start, end, dtstamp)`**
- Vrne veljaven VCALENDAR z enim VEVENT. Vse vrstice se končajo s CRLF. Vsebuje `DTSTAMP`, `DTSTART` in `DTEND` v UTC.
- V `SUMMARY` je naslov ubežan (`\\`, `\;`, `\,`, `\n`), zato naslov ne more vriniti novih lastnosti. `UID` ne vsebuje presledkov, je stabilen in odvisen od naslova ter začetka.
- Če konec ni za začetkom, vrne `error.InvalidTimeRange`. Ob napaki alokacije vrne `error.OutOfMemory` brez puščanja pomnilnika.

---

## 2. Ukaz agentu

Agentu smo dali navodila naloge (glej [Naloga2/](Naloga2/)). Pred začetkom je zastavil vprašanja, mi pa smo izbrali naslednje:

- **Enote:** štetje glasov (VoteResults), termini (CalendarPicker), Zig .ics generiranje
- **Ogrodje:** vgrajeni `node:test` + `node:assert/strict` (frontend), `std.testing` (Zig)
- **Poimenovanje:** angleško, `describe("<enota>")` + `it("should <pričakovano> when <pogoj>")`; v Zigu `test "<enota>: should … when …"`
- **Pokritost primerov:** običajni primeri, robne vrednosti (polnoč, 31. 12., prestopni dan, poletni čas, 0/1/2/3/4/11/101 glasov), neveljavni vhodi in izjeme (`TypeError`, `RangeError`, `error.InvalidTimestamp`, `error.InvalidTimeRange`, `error.OutOfMemory`)
- **Nadomestni objekti (mock):**
  - `mock.fn()` za povratni klic `onDateStatusesChange` (preverjanje števila in argumentov klicev),
  - `mock.timers.enable({ apis: ["Date"] })` za zamrznitev sistemske ure pri `isPastDate()`,
  - `process.env.TZ = "Europe/Ljubljana"`, da so testi časovnih pasov deterministični,
  - v Zigu `std.testing.FailingAllocator` prek `checkAllAllocationFailures`, ki po vrsti odpove vsako alokacijo, in `std.testing.allocator`, ki zazna puščanje pomnilnika,
  - injicirana ura (`dtstamp_unix`) namesto branja sistemskega časa v `buildIcsContent`.
- **Poročilo:** ta datoteka

---

## 3. Testi

| Datoteka | Število testov |
|---|---|
| [voteTally.test.js](frontend/EventEase/src/utils/voteTally.test.js) | 35 |
| [slotUtils.test.js](frontend/EventEase/src/utils/slotUtils.test.js) | 55 |
| [eventHelpers.test.js](frontend/EventEase/src/utils/eventHelpers.test.js) (obstoječi, popravljeni) | 15 |
| [ics.zig](backend/logic/src/ics.zig) (blok `Tests`) | 18 |
| [uuid.zig](backend/logic/src/uuid.zig) (obstoječi, nespremenjeni) | 6 |

Zagon:

```bash
cd frontend/EventEase && npm test              # samo testi
cd frontend/EventEase && npm run test:coverage # testi + pokritost (lcov v coverage/lcov.info)
cd backend/logic && zig build test --summary all
```

**Pokritost (lokalno):**

| Del | Vrstice | Veje | Funkcije | Orodje |
|---|---|---|---|---|
| Frontend `src/utils/**` | 100 % | 100 % | 100 % | `node --test --experimental-test-coverage` |
| Backend `uuid.zig` + `ics.zig` | 98,7 % (295/299) | – | – | `kcov` (Linux) |

---

## 4. Namerno vnesene napake (mutacije)

Mutacije smo vnašali **eno po eno** s skripto. Vsako smo po zagonu testov povrnili. »Zaznana« pomeni, da je vsaj en test padel. Rezultat je iz končnega zagona: **23/23 zaznanih**. V prvem zagonu je bilo zaznanih 19/20 (glej poglavje 5, točka P1).

| ID | Enota | Napaka | Zaznana | Testi, ki so padli (izbor) |
|---|---|---|---|---|
| V1 | voteTally | `Math.floor` namesto `Math.round` pri odstotkih | ✅ | *should compute percentages … and round them* |
| V2 | voteTally | `if_needed` se ne šteje kot »če bo potrebno« | ✅ | *should treat the frontend status 'if_needed' the same as …* |
| V3 | voteTally | sklanjanje po `count % 10` namesto `% 100` | ✅ | *… when count is 11 / 12 / 21 / 111* |
| V4 | voteTally | podvojene izbire se štejejo dvakrat, tuji termini niso izločeni | ✅ | *should count a participant at most once per slot …*, *should ignore votes for slots that are not part of the poll* |
| V5 | voteTally | imenovalec ne šteje udeležencev brez izbir | ✅ | *should count participants without any choices …* |
| V6 | voteTally | odstranjena validacija vhoda za `slovenianVoteLabel` | ✅ | *should throw RangeError when count is 1.5 / NaN / null / "2"* |
| S1 | slotUtils | **prvotna koda:** `(h + 1) % 24`, konec čez polnoč ostane na istem dnevu | ✅ | *should move the end to the next day …*, *should roll over the month and the year …* |
| S2 | slotUtils | cikel vrne `if_need_be` namesto `if_needed` | ✅ | *should cycle no -> yes -> if_needed -> no* |
| S3 | slotUtils | `applyVoteStatus` spreminja vhodni objekt | ✅ | *should not mutate the original statuses object* |
| S4 | slotUtils | **prvotna koda:** današnji datum iz `toISOString()` (UTC) | ✅ | *should use the local calendar day, not the UTC day* |
| S5 | slotUtils | regex ure sprejme `24:00`–`29:59` | ✅ (po popravku P1) | *should throw TypeError when the time is "24:00" / "25:30"* |
| S6 | slotUtils | `cycleVoteStatus` ne preveri `onChange` | ✅ | *should return false without throwing when onChange is not provided* |
| S7 | slotUtils | zamenjana prioriteta `date` ↔ `start_time` | ✅ | *should prefer the 'date' field over 'start_time' …* |
| S8 | slotUtils | konec računan v lokalnem času (poletni čas) | ✅ | *should not depend on daylight saving time changes …* |
| S9 | slotUtils | `if_need_be` v ciklu ni prepoznan | ✅ | *should treat the backend status 'if_need_be' like 'if_needed' …* |
| I0 | ics | **prvotna koda** `formatIcsTimestamp` (le odstrani `-` in `:`) | ✅ | *should treat a timestamp without offset as UTC* (+ `index out of bounds` pri vhodu iz PostgreSQL) |
| I1 | ics | časovni zamik se prišteje namesto odšteje | ✅ | *should convert positive and negative offsets to UTC*, *should move the date when the offset crosses midnight …* |
| I2 | ics | vejica v `SUMMARY` ni ubežana | ✅ | *escapeText: should escape …*, *should escape the title in SUMMARY …* |
| I3 | ics | `end < start` namesto `end <= start` | ✅ | *should return InvalidTimeRange when the end is not after the start* |
| I4 | ics | brez pravila 400 let za prestopna leta | ✅ | *should accept the leap day only in leap years* |
| I5 | ics | ena vrstica z LF namesto CRLF | ✅ | *should use CRLF for every line break* |
| I6 | ics | odstranjen `errdefer` v `escapeText` (puščanje pomnilnika) | ✅ | *should return OutOfMemory and not leak when any allocation fails* |
| I7 | ics | sprejme uro 24 | ✅ | *should return InvalidTimestamp for malformed input* |

### 4.1 Prave napake, ki so jih testi odkrili v obstoječi kodi

| Napaka | Posledica | Popravek |
|---|---|---|
| `formatBackendSlot`: `(hours + 1) % 24` ne spremeni datuma | termin ob 23:30 se »konča« ob 00:30 **istega** dne, torej pred začetkom | aritmetika v UTC z `Date.UTC` |
| `formatIcsTimestamp` je samo odstranil `-` in `:` | iz baze pride `2026-06-15 14:00:00+00`, v .ics je bil zato `DTSTART:20260615 140000+00`, kar ni veljaven iCalendar | razčlenjevanje in pretvorba v UTC |
| .ics brez `DTSTAMP`, z LF in neubežanim naslovom | neskladje z RFC 5545, naslov z vejico ali novo vrstico pokvari dogodek | `DTSTAMP`, CRLF, `escapeText` |
| `todayISO` iz `toISOString()` | med 00:00 in 02:00 po lokalnem času je bil včerajšnji dan še izbirljiv | `toLocalISODate` |

---

## 5. Pomanjkljivi testi in popravki

Prvi nabor testov je ustvaril agent, nato smo ga pregledali po merilih iz navodil:

| # | Vrsta pomanjkljivosti | Test | Problem | Popravek |
|---|---|---|---|---|
| P1 | **Ne preveri dovolj** (lažno pozitiven) | `formatBackendSlot` – *should throw TypeError when the time is "24:00"* | Preveri le **tip** izjeme. Mutacija S5 (regex sprejme `24:00`) je preživela, ker je `24:00` padel šele na preverjanju datuma, torej iz napačnega razloga. | Preverjamo tudi sporočilo (`{ name: "TypeError", message: /Invalid time/ }`) in dodali primer `25:30`. S5 je zdaj zaznana. |
| P2 | **Prepisana trenutna koda** | `nextVoteStatus` – *should treat a missing or unknown status as 'no'* | Pričakovana vrednost je bila prepisana iz nove implementacije. Spregledali smo, da backend uporablja `if_need_be`, ki je enakovreden `if_needed`, ne neznan status. Klik na tak termin bi ga postavil nazaj na »da«. | Popravljena koda in dodan test *should treat the backend status 'if_need_be' like 'if_needed' …* (mutacija S9). |
| P3 | **Napačna trditev v testu** | `ics.zig` – *should escape the title in SUMMARY so it cannot inject properties* | Test je štel podniz `END:VEVENT`, ki ga vsebuje tudi pravilno ubežan naslov `\nEND:VEVENT`. Zato je padel na **pravilni** kodi. | Štejemo cele vrstice `\r\nEND:VEVENT\r\n`. |
| P4 | **Podvajanje** | `cycleVoteStatus` – *should not mutate the statuses passed in* | Preverja isto kot test `applyVoteStatus`. Mutacija S3 je podrla oba, drugih napak ni lovil. | Odstranjen. |
| P5 | **Več primerov v enem testu, nejasno ime** | `tallyVotes` – *should tolerate missing arguments and null vote records* | Dve obnašanji v enem testu. Za `null` je preverjal le `yesCount === 0`, kar velja tudi, če se zapis tiho izpusti iz imenovalca. | Razdeljen na dva testa. Drugi preverja tudi `yesPercent === 50`, kar zazna mutacijo V5. |
| P6 | **Zavajajoče ime** | *should throw RangeError when count is 2* | Vhod je bil niz `"2"`, ime pa je nakazovalo število 2, ki je veljaven vhod. | Ime uporablja `JSON.stringify` (`count is "2"`). |
| P7 | **Morebiti prazen test** | *should not depend on daylight saving time changes* | Na prvi pogled se zdi, da test nič ne preverja, saj pade tudi na stari kodi. | Preverili smo ga z mutacijo S8 (računanje v lokalnem času). Test jo zazna, zato ostane. |
| P8 | **Obstoječi testi** – zavajajoče ime, manjkajoči robni primeri | `eventHelpers.test.js`: *isValidVoteStatus accepts allowed values* | Ime pravi »sprejme«, test pa preverja tudi zavrnitev. Manjkal je ključni primer `if_needed` (frontendna vrednost, ki jo backend zavrne). Pri `organizerNameFromEmail` sta manjkala `@mail.com` in vhod, ki ni niz. | Razdeljeno na parametrizirane teste *should accept …* in *should reject …* ter dodani robni primeri. |
| P9 | **Preveč trivialen ali vezan na implementacijo** | `buildSharePath` | Pričakovana vrednost je enaka predlogi v kodi. | Obdržan kot pogodba z usmerjevalnikom (`/invite/:token` v `App.jsx`), ime to zdaj pove. |

**Vezanost na implementacijo:** testi kličejo samo izvožene funkcije. Zig testi .ics ne primerjajo kot celotnega niza, ampak z `icsProperty()` preberejo posamezne lastnosti, zato jih vrstni red lastnosti ne zlomi. Test za `UID` preverja lastnosti (brez presledkov, stabilen, odvisen od naslova in začetka), ne pa konkretne zgoščene vrednosti.

---

## 6. Integracija v cevovod (GitHub Actions)

V [ci.yml](.github/workflows/ci.yml):

- **Frontend:** `npm run test:coverage` (s `set -o pipefail`) požene teste in preveri pragove pokritosti (90 % vrstic in funkcij, 85 % vej). **Neuspešen test ali prenizka pokritost ustavi cevovod**, nadaljnji koraki (`build`, `docker-smoke`) se ne izvedejo. Povzetek pokritosti se izpiše v *Job Summary*, `lcov.info` pa se naloži kot artefakt `frontend-coverage`.
- **Backend:** `zig build test` ustavi cevovod ob neuspešnem testu. `zig build test-bin` namesti testne binarke, `kcov` (Docker slika `kcov/kcov`) izmeri pokritost, [zig-coverage-summary.py](scripts/zig-coverage-summary.py) pa zapiše povzetek in ob pokritosti pod 90 % konča z napako. HTML poročilo se naloži kot artefakt `backend-coverage`.
- `docker-smoke` je odvisen od obeh poslov (`needs: [frontend, backend]`).

Postopek s kcov smo lokalno preverili v Linux vsebniku (gradnja z Zig 0.16 za Linux, kcov, združevanje, prag). Preverili smo tudi, da `npm run test:coverage` ob padlem testu vrne izhodni kod 1.

---

## 7. Omejitve in odprta vprašanja

- **Časovni pas terminov:** frontend pošilja čas brez zamika (`2026-06-15T14:00:00`), PostgreSQL ga shrani kot UTC. .ics je zdaj veljaven in v UTC, zato ga koledar v Sloveniji prikaže z zamikom +1 h/+2 h. Pravilen popravek je pošiljanje časa z zamikom iz frontenda. To presega obseg te naloge.
- Vrstice .ics niso prelomljene pri 75 oktetih (RFC 5545 §3.1). Pri zelo dolgih naslovih bi bilo to treba dodati.
- Pokritost frontenda meri samo `src/utils/**`. Komponente React nimajo testov enot (za to bi potrebovali DOM okolje, npr. jsdom ali Testing Library).
