# Poročilo – Naloga 3 (ZK): Funkcionalno testiranje EventEase

**Ekipa:** Jure Antolič, Lenart Beršnak
**Ta del poročila:** Lenart Beršnak (scenariji TS-L1, TS-L2, TS-L3)
**Projekt:** EventEase – React 19 + Vite (frontend), Zig 0.16 (backend), PostgreSQL 16
**Testirana različica:** `main`, commit `6bad6db`
**Datum izvedbe:** 11. 11. 2026

Dokumentacija sledi strukturi standarda **ISO/IEC/IEEE 29119-3:2021** (Test documentation), prilagojeni velikosti projekta:

| Dokument po 29119-3 | Poglavje |
|---|---|
| Test Plan (testni načrt) | 3 |
| Test Design Specification (pogoji in pokritost) | 4 (uvod vsakega scenarija) |
| Test Case Specification (testni primeri) | 4.1–4.3 |
| Test Procedure Specification (postopki po korakih) | 4.1–4.3 + izvorna koda testov |
| Test Data / Environment Readiness Report | 3.5, 3.6 |
| Test Execution Log (dnevnik izvajanja) | 5 |
| Test Incident Report (poročila o incidentih) | 6 |
| Test Completion Report (zaključno poročilo) | 7 |

## 0. Uporabljena orodja generativne umetne inteligence

| Orodje | Namen |
|---|---|
| **Claude Code** (razširitev za VS Code, agentni način) z modelom **Claude Opus 5.5** (naročnina Max) | pregled dokumentacije in kode, obnova seznama funkcionalnosti, predlog in oblikovanje scenarijev, priprava testnega okolja, avtomatizacija scenarijev s Playwrightom, izvedba, analiza neuspehov, osnutek tega poročila |

Drugih orodij UI nismo uporabili. Pred začetkom dela je agent zastavil vprašanja o obsegu, načinu izvedbe, okolju in izbiri področij. Izbrali smo: samo Lenartove 3 scenarije, Playwright E2E z ročnim preverjanjem, lokalno okolje (docker compose) in področja *ustvarjanje ankete*, *predlog termina in sprejem* ter *potrditev termina in .ics*.

---

## 1. Pregled obstoječe dokumentacije in ključne funkcionalnosti

### 1.1 Pregledani viri

| Vir | Vsebina | Ugotovitev |
|---|---|---|
| [README.md](README.md) | namen, seznam funkcionalnosti, API poti, zagon | Funkcionalnosti so le naštete (7 alinej), **ni pravil validacije, stanj ankete ali pričakovanega obnašanja ob napakah**. |
| [docs/screenshots/](docs/screenshots/), [docs/gifs/](docs/gifs/) | posnetki ustvarjanja, deljenja, glasovanja in potrditve | uporabno za razumevanje toka, ne pa kot specifikacija |
| [porocilo_naloga1.md](porocilo_naloga1.md), [porocilo_naloga2.md](porocilo_naloga2.md) | pregled namestitve, specifikacija enot | Specifikacija enot (štetje glasov, termini, .ics) je uporabna za pričakovane rezultate. |
| izvorna koda (`routes.zig`, `views/*`, `pages/*`) | dejansko obnašanje | vir za obnovo funkcionalnosti (1.2) |

**Neskladje v dokumentaciji (D-01):** README navaja: »Lokalni e-maili so onemogočeni (`DISABLE_EMAILS=true`). Mailpit UI na http://localhost:8025.« Backend Mailpita sploh ne uporablja (pot z `msmtp` je v `routes.zig` zakomentirana) in e-pošto pošilja izključno prek Resend API. Lokalno zato e-pošte ni mogoče videti nikjer. Za testiranje e-pošte smo pripravili lastno rešitev (3.5).

### 1.2 Obnovljene ključne funkcionalnosti

Ker dokumentacija ne opisuje obnašanja, smo funkcionalnosti obnovili iz kode in jih oštevilčili zaradi sledljivosti:

| ID | Funkcionalnost | Akter | Opis pričakovanega obnašanja |
|---|---|---|---|
| F1 | Ustvarjanje ankete | organizator | Naslov in e-pošta sta obvezna, izbran mora biti vsaj en termin (privzeto 12:00, trajanje 60 min, ura nastavljiva). Rezultat sta povezava za organizatorja `/admin/<admin_token>?invite=<share_token>` in povezava za udeležence `/invite/<share_token>`. |
| F2 | Deljenje vabila | organizator | kopiranje povezave, WhatsApp/Telegram/Messenger, e-poštna vabila |
| F3 | Glasovanje | udeleženec | ime (obvezno), e-pošta (izbirno), za vsak termin da / če bo potrebno / ne, prevzem nalog, sprememba odgovora |
| F4 | Predlog novega termina | udeleženec | Ime je obvezno, potreben je vsaj en datum (z uro). Predlog dobi status `pending`. |
| F5 | Pregled predlogov, sprejem ali zavrnitev | organizator | Sprejet predlog postane nov termin ankete (`accepted`), zavrnjen ne. |
| F6 | Pregled rezultatov | organizator, udeleženec | število in imena glasov po terminih, odstotki |
| F7 | Potrditev končnega termina | organizator | Potrditev je mogoča samo z izbranim terminom te ankete in samo enkrat. Po potrditvi je anketa zaključena (prikaz potrjenega termina, glasovanje ni več mogoče). |
| F8 | Obvestila in .ics | sistem | Ob potrditvi organizator prejme povzetek, vsak udeleženec z e-naslovom pa e-pošto s priponko `event.ics` (veljaven iCalendar, čas v UTC, ubežan naslov). |
| F9 | Temni/svetli način | vsi | – |

---

## 2. Razdelitev testnih scenarijev

| ID | Naziv testnega scenarija | Pokrite funkcionalnosti | Odgovorna oseba |
|---|---|---|---|
| **TS-L1** | Ustvarjanje ankete | F1 | Lenart Beršnak |
| **TS-L2** | Predlog novega termina in sprejem s strani organizatorja | F4, F5, F3 | Lenart Beršnak |
| **TS-L3** | Potrditev končnega termina, obveščanje udeležencev in datoteka .ics | F7, F8, F6 | Lenart Beršnak |
| TS-J1 – TS-J3 | *(vpiše Jure Antolič)* | | Jure Antolič |

Ta dokument obsega samo scenarije TS-L1 do TS-L3. Scenarije Jureta Antoliča pripravi in izvede on sam.

---

## 3. Testni načrt (Test Plan)

### 3.1 Predmet in cilj
Predmet testiranja je spletna aplikacija EventEase kot celota (brskalnik → nginx → Zig backend → PostgreSQL), različica `6bad6db`. Cilj je preveriti, ali funkcionalnosti F1, F4, F5, F7 in F8 delujejo po pričakovanjih iz poglavja 1.2, ter dokumentirati odstopanja.

### 3.2 Obseg
- **V obsegu:** uporabniški vmesnik za navedene funkcionalnosti, odzivi API, ki jih uporablja vmesnik, vsebina poslane e-pošte in priponke .ics.
- **Izven obsega:** F2 (deljenje na družbenih omrežjih), F9, zmogljivost, varnostno testiranje, dejanska dostava e-pošte prek Resend, različni brskalniki (samo Chromium).

### 3.3 Pristop
- **Funkcionalno testiranje po metodi črne skrinjice**, primeri so izpeljani iz pričakovanega obnašanja (1.2):
  - *testiranje po primerih uporabe* (glavni tok vsakega scenarija),
  - *razredi ekvivalence in robne vrednosti* (prazen ali neveljaven vnos, naslov iz samih presledkov, konec pred začetkom),
  - *prehodi stanj ankete* (odprta → zaključena: ponovna potrditev, glasovanje po potrditvi),
  - *negativni primeri na ravni API* tam, kjer vmesnik zahteve ne omogoča, uporabnik pa jo lahko pošlje neposredno.
- **Avtomatizacija:** vsak testni primer je izveden s Playwrightom (Chromium, `locale sl-SI`, `timezoneId Europe/Ljubljana`). Postopki v 4.1–4.3 so napisani tako, da jih je mogoče izvesti tudi ročno.
- **Ročno preverjanje:** pred avtomatizacijo smo glavni tok (ustvari → glasuj → predlagaj → sprejmi → potrdi) izvedli ročno prek API (`curl`) in pregledali odložišče e-pošte. Pri tem so bili odkriti INC-03, INC-04 in INC-07 do INC-10. Dokazila avtomatskih izvedb (posnetke zaslona) smo pregledali ročno, da je bil vsak neuspeh potrjen kot pravi (glej 7.3).
- **Neodvisnost primerov:** vsak primer si testne podatke ustvari sam prek API. Naslovi vsebujejo oznako zagona, zato se ponovitve ne mešajo.

### 3.4 Merila
- **Vstopna merila:** okolje je pripravljeno (3.6), `globalSetup` je potrdil varovalke za e-pošto.
- **Merilo uspešnosti primera:** vsi pričakovani rezultati vseh korakov so izpolnjeni.
- **Izstopna merila:** izvedeni so vsi načrtovani primeri, za vsak neuspeh obstaja poročilo o incidentu, vsak neuspeh je potrjen kot neuspeh iz pravega razloga.

### 3.5 Testno okolje

| Element | Vrednost |
|---|---|
| Gostitelj | Windows 11, Docker Desktop 29.5.2, Node.js 24.14.1 |
| Aplikacija | `docker compose -p eventease-e2e -f compose.yaml -f e2e/compose.e2e.yaml`, ločen projekt z lastno bazo |
| Odjemalec | Playwright 1.56.1, Chromium (Desktop Chrome), 1 delavec, zaporedno |
| E-pošta | testni dvojnik (glej spodaj) |

**Testiranje e-pošte brez pošiljanja navzven.** Backend pošilja e-pošto z ukazom `curl … https://api.resend.com/emails`. Ugotovili smo, da `DISABLE_EMAILS=true` pošiljanje popolnoma izklopi, zato F8 ne bi bil preverljiv. Če pa bi ga izklopili, bi backend poklical pravi Resend: ključ je nastavljen, a prazen, ker ukaz `CMD` v Dockerfile posreduje `RESEND_API_KEY=$RESEND_API_KEY`. V [e2e/compose.e2e.yaml](e2e/compose.e2e.yaml) je zato:
1. `DISABLE_EMAILS=false`, da backend e-pošto in .ics dejansko zgradi,
2. `curl` zamenjan s testnim dvojnikom [e2e/fake-curl.sh](e2e/fake-curl.sh), ki telo zahteve zapiše v `e2e/.outbox/*.json` in vrne HTTP 200,
3. `api.resend.com` preusmerjen na `127.0.0.1` kot druga varovalka.

[global-setup.js](e2e/global-setup.js) pred vsakim zagonom preveri točki 2 in 3. Če varovalki nista aktivni, se testi ne izvedejo.

### 3.6 Pripravljenost okolja (Environment Readiness)
11. 11. 2026: okolje zgrajeno iz `6bad6db`, vsi trije vsebniki tečejo, `command -v curl` vrne `/usr/local/bin/curl`, `getent hosts api.resend.com` pa `127.0.0.1`. ✅

### 3.7 Tveganja

| Tveganje | Ukrep |
|---|---|
| nenamerno pošiljanje e-pošte resničnim naslovom | dve varovalki + preverjanje v `globalSetup`, testni naslovi na domeni `eventease.test` |
| odvisnost od datuma (preteklih dni ni mogoče izbrati) | vsi datumi so v naslednjem mesecu glede na dan izvedbe |
| nestabilni (flaky) testi | čakanje na stanje (`expect … toBeVisible`) namesto fiksnih pavz, zaporedno izvajanje |

---

## 4. Specifikacija testnih scenarijev in primerov

Oznake: **P** = prioriteta (1 = najvišja). **Tip:** P = pozitiven, N = negativen. Datumi `D10`, `D11`, `D12`, `D13` pomenijo 10., 11., 12. in 13. dan naslednjega meseca (pri izvedbi december 2026).

Primeri, pri katerih so že ob načrtovanju vedeli, da sistem pričakovanega obnašanja ne izpolnjuje, so v kodi označeni s `test.fail()` in številko incidenta. Preverjajo **pravilno** obnašanje, zato so v dnevniku zabeleženi kot *neuspešni*. Ko je napaka odpravljena, Playwright javi nepričakovan uspeh in oznako odstranimo.

### 4.1 TS-L1 – Ustvarjanje ankete

**Cilj:** preveriti, da organizator ustvari anketo z izbranimi termini in prejme delujoči povezavi ter da sistem zavrne nepopolne ali neveljavne podatke.
**Sledljivost:** F1. **Koda:** [TS-L1-ustvarjanje-ankete.spec.js](e2e/tests/TS-L1-ustvarjanje-ankete.spec.js)
**Testni pogoji:** (a) glavni tok z več termini in spremenjeno uro, (b) obvezna polja, (c) oblika e-naslova, (d) naslov iz samih presledkov, (e) validacija na strežniku.

| ID | P | Tip | Namen | Predpogoj / vhod | Pričakovani rezultat |
|---|---|---|---|---|---|
| TC-L1-01 | 1 | P | uspešno ustvarjanje ankete z dvema terminoma | naslov `Izlet na Pohorje <run>`, e-pošta `lenart.organizator@eventease.test`, opis, D10 18:30, D11 09:00 | prikaz »Dogodek je ustvarjen«, povezavi v pravilni obliki, termini shranjeni s trajanjem 60 min, povabilo in skrbniški pogled prikazujeta pravilne podatke |
| TC-L1-02 | 1 | N | obvezna polja | prazen obrazec, nato postopno dopolnjevanje, termin izbran in odznačen | ustrezno sporočilo za vsak manjkajoči podatek, **nobena** zahteva `POST /api/polls` |
| TC-L1-03 | 2 | N | neveljaven e-naslov organizatorja | e-pošta `organizator.eventease.test` (brez @) | sporočilo o neveljavnem e-naslovu, anketa ni ustvarjena |
| TC-L1-04 | 2 | N | naslov iz samih presledkov | naslov `"   "` | sporočilo »Prosimo, vnesite naslov dogodka.«, anketa ni ustvarjena |
| TC-L1-05 | 2 | N | validacija na strežniku | `POST /api/polls` s praznim naslovom / neveljavnim e-naslovom / brez terminov / koncem pred začetkom | HTTP 400 za vsak primer |

**Postopek TC-L1-01:**

| # | Dejanje | Pričakovani rezultat |
|---|---|---|
| 1 | Odpri `/`, klikni »Ustvari dogodek« | prikaže se obrazec »Ustvari nov dogodek« |
| 2 | Vnesi naslov, e-pošto organizatorja in opis | polja so izpolnjena |
| 3 | V koledarju pojdi na naslednji mesec, klikni D10, nastavi uro 18:30, »Potrdi«. Ponovi za D11 ob 09:00 | dneva sta označena z »18:30« oz. »09:00« |
| 4 | Klikni »Ustvari in deli« | »Dogodek je ustvarjen«, povezavi `/admin/<uuid>?invite=<uuid>` in `/invite/<uuid>` |
| 5 | Preveri anketo prek API (`GET /api/polls/share/<token>`) | naslov, e-pošta, `is_finalized=false`, termina D10 18:30–19:30 in D11 09:00–10:00 |
| 6 | Odpri povezavo za udeležence | naslov, »lenart.organizator vas vabi«, opis |
| 7 | Odpri povezavo za organizatorja | »Skrbniški pogled«, naslov, 2 termina (18:30, 09:00) |

**Postopek TC-L1-02:** (1) oddaj prazen obrazec → »Prosimo, vnesite naslov dogodka.«; (2) vnesi naslov → »Prosimo, vnesite e-poštni naslov organizatorja.«; (3) vnesi e-pošto → »Prosimo, izberite vsaj en termin na koledarju.«; (4) izberi D10 in ga ponovno klikni (odznači) → isto sporočilo; (5) strežnik ni prejel nobene zahteve.

### 4.2 TS-L2 – Predlog novega termina in sprejem

**Cilj:** preveriti, da udeleženec predlaga termin, ki ga organizator vidi, sprejme ali zavrne, ter da sprejet termin postane polnovreden termin ankete, za katerega je mogoče glasovati.
**Sledljivost:** F4, F5, F3. **Koda:** [TS-L2-predlog-termina.spec.js](e2e/tests/TS-L2-predlog-termina.spec.js)
**Predpogoj (vsi primeri):** anketa z dvema terminoma (D10 in D11, 14:00–15:00), ustvarjena prek API.
**Testni pogoji:** (a) obvezni podatki predloga, (b) glavni tok predlog → sprejem → glasovanje, (c) lastnosti sprejetega termina, (d) trajnost zavrnitve, (e) prikaz podrobnosti predloga.

| ID | P | Tip | Namen | Vhod | Pričakovani rezultat |
|---|---|---|---|---|---|
| TC-L2-01 | 2 | N | predlog brez imena / brez datuma | brez imena, nato ime »Ana« brez datuma | »Najprej vpišite svoje ime v obrazec.«, nato »Izberite vsaj en datum.«, nobena zahteva, 0 predlogov |
| TC-L2-02 | 1 | P | predlog → sprejem → glasovanje | Ana predlaga D12 ob 17:00, organizator sprejme, Bor glasuje »Da« za D12 | predlog `pending` → v skrbniškem pogledu »Predlogi udeležencev (1)« → po sprejemu `accepted`, 3 termini → Borov glas »yes« za novi termin |
| TC-L2-03 | 2 | P | trajanje sprejetega termina | predlog D12 17:00, sprejem | novi termin 17:00–18:00 (enako privzeto trajanje kot ostali termini) |
| TC-L2-04 | 2 | P | zavrnitev je trajna | predloga D12 in D13, zavrni D13, osveži stran | po osvežitvi ostane 1 predlog |
| TC-L2-05 | 3 | P | podrobnosti predloga | klik na predlagani dan v skrbniškem pogledu | »Predlog od Ana: <datum>« |

**Postopek TC-L2-02:**

| # | Dejanje | Pričakovani rezultat |
|---|---|---|
| 1 | Na povabilu vpiši ime »Ana«, klikni »Predlagaj nov datum«, v oknu izberi D12, nastavi 17:00, »Potrdi«, »Pošlji predlog« | okno se zapre, »Predlogi uspešno poslani organizatorju.« |
| 2 | API: `GET /api/polls/admin/<token>` | 1 predlog, `suggested_by=Ana`, `status=pending`, začetek D12 17:00 |
| 3 | Odpri skrbniški pogled, v razdelku »Predlogi udeležencev (1)« klikni D12 | »Predlog od Ana« |
| 4 | Klikni »Sprejmi → dodaj v poll« | razdelek s predlogi izgine, seznam ima 3 termine, zadnji ob 17:00 |
| 5 | API | predlog `accepted`, anketa ima 3 termine |
| 6 | Na povabilu vpiši »Bor«, klikni D12, »Potrdi udeležbo« | »Hvala, Bor!«, v API ima Bor `yes` za novi termin |

### 4.3 TS-L3 – Potrditev termina, obveščanje in .ics

**Cilj:** preveriti, da organizator potrdi termin, da je anketa nato trajno zaključena in da so obveščeni točno pravi prejemniki s pravilno datoteko .ics.
**Sledljivost:** F7, F8, F6. **Koda:** [TS-L3-potrditev-termina.spec.js](e2e/tests/TS-L3-potrditev-termina.spec.js)
**Predpogoj (vsi primeri):** anketa `Sestanek ekipe, <oznaka> <run>` (vejica zaradi preverjanja ubežanja v .ics), termina D10 14:00–15:00 in D11 18:30–19:30, glasovi:

| Udeleženec | E-pošta | D10 14:00 | D11 18:30 |
|---|---|---|---|
| Ana | `ana.<run>@eventease.test` | da | ne |
| Bor | – | če bo potrebno | ne |
| Cene | `cene.<run>@eventease.test` | ne | da |

**Testni pogoji:** (a) potrditev brez izbire, (b) glavni tok in vsebina obvestil, (c) tehnična veljavnost obvestila, (d)–(e) zaklenjenost po potrditvi, (f) termin, ki ne pripada anketi, (g) potrditev termina iz predloga, (h) časovni pas v .ics.

| ID | P | Tip | Namen | Vhod | Pričakovani rezultat |
|---|---|---|---|---|---|
| TC-L3-01 | 2 | N | potrditev brez izbire + prikaz rezultatov | klik na »Potrdi izbran termin …« brez izbire | rezultati: D10 »Ustreza: Ana«, »Če bo potrebno: Bor«, »1 glas«; D11 »Ustreza: Cene«; sporočilo »Prosimo, izberite končni termin …«; nobena zahteva |
| TC-L3-02 | 1 | P | potrditev in obvestila | izbira D10 14:00, potrditev | »Glasovanje zaključeno«, termin »… 10. december 2026 ob 14:00 / do 15:00«, stanje trajno, udeleženec vidi »Termin potrjen«, e-pošta točno organizatorju, Ani in Cenetu (ne Boru), organizatorjev povzetek našteje vse 3, priponka `event.ics`: VCALENDAR, CRLF, `SUMMARY:Sestanek ekipe\, …`, DTSTART na D10, trajanje 1 h |
| TC-L3-03 | 1 | P | obvestilo je veljavna zahteva za ponudnika | potrditev | telo vsake e-pošte je veljaven JSON (sicer ga Resend zavrne) |
| TC-L3-04 | 2 | N | ponovna potrditev | 2. `finalize` z drugim terminom | HTTP 409, končni termin nespremenjen, ni dodatnih e-pošt, skrbniški pogled brez gumba za potrditev |
| TC-L3-05 | 2 | N | glasovanje po potrditvi | `POST /vote` po potrditvi | HTTP 409, število glasov nespremenjeno |
| TC-L3-06 | 2 | N | termin, ki ne pripada anketi | `finalize` ankete B s terminom ankete A; `finalize` ankete C z neobstoječim terminom | HTTP 400, anketi B in C ostaneta odprti |
| TC-L3-07 | 1 | P | potrditev termina iz sprejetega predloga | predlog D12 17:00 sprejet, Ana glasuje »da«, potrditev v vmesniku | Ana prejme e-pošto z `event.ics` |
| TC-L3-08 | 2 | P | čas v .ics | potrditev D10 14:00 | `DTSTART` = 14:00 po času Europe/Ljubljana, pretvorjen v UTC (`…T130000Z` pozimi) |

**Postopek TC-L3-02:**

| # | Dejanje | Pričakovani rezultat |
|---|---|---|
| 1 | Odpri skrbniški pogled, klikni kartico termina 14:00, »Potrdi izbran termin in obvesti vse« | – |
| 2 | – | »Glasovanje zaključeno«, naslov, »četrtek, 10. december 2026 ob 14:00«, »do 15:00« |
| 3 | Osveži stran, preveri API | še vedno zaključeno, ni gumba za potrditev, `is_finalized=true`, `final_slot_id` = D10 |
| 4 | Odpri povezavo za udeležence | »Termin potrjen«, »do 15:00«, ni gumba »Potrdi udeležbo« |
| 5 | Preglej odložišče e-pošte (zadeva `Poll finalized: <naslov>`) | prejemniki: organizator, Ana, Cene, organizatorjev povzetek vsebuje »- Ana«, »- Bor«, »- Cene« |
| 6 | Dekodiraj priponko za Ano in Ceneta | `event.ics` z lastnostmi iz tabele zgoraj |

---

## 5. Dnevnik izvajanja (Test Execution Log)

**Izvedba:** 11. 11. 2026 ob 14:37 (Europe/Ljubljana), okolje iz 3.5, SUT `6bad6db`, Playwright 1.56.1/Chromium, trajanje 27 s, 18 primerov.
Celoten izpis: [e2e/rezultati-zagon.txt](e2e/rezultati-zagon.txt). Posnetki zaslona: [e2e/dokazi/](e2e/dokazi/).

| ID | Rezultat | Dejanski rezultat (pri neuspehu) | Incident | Dokaz |
|---|---|---|---|---|
| TC-L1-01 | ✅ Uspešen | – | – | [obrazec](e2e/dokazi/TC-L1-01_1_izpolnjen-obrazec.png), [povezavi](e2e/dokazi/TC-L1-01_2_povezavi.png), [povabilo](e2e/dokazi/TC-L1-01_3_povabilo.png) |
| TC-L1-02 | ✅ Uspešen | – | – | [posnetek](e2e/dokazi/TC-L1-02_ni-termina.png) |
| TC-L1-03 | ❌ Neuspešen | anketa ustvarjena z e-naslovom `organizator.eventease.test` | INC-01 | [posnetek](e2e/dokazi/TC-L1-03_neveljaven-email.png) |
| TC-L1-04 | ❌ Neuspešen | anketa ustvarjena z naslovom `"   "` | INC-02 | [posnetek](e2e/dokazi/TC-L1-04_prazen-naslov.png) |
| TC-L1-05 | ❌ Neuspešen | vsi štirje neveljavni zahtevki: HTTP 201 | INC-03 | – (API) |
| TC-L2-01 | ✅ Uspešen | – | – | [posnetek](e2e/dokazi/TC-L2-01_brez-datuma.png) |
| TC-L2-02 | ✅ Uspešen* | – | (INC-06) | [predlog](e2e/dokazi/TC-L2-02_1_predlog.png), [skrbnik](e2e/dokazi/TC-L2-02_2_skrbnik-predlog.png), [sprejet](e2e/dokazi/TC-L2-02_3_sprejet.png) |
| TC-L2-03 | ❌ Neuspešen | sprejeti termin `17:00:00+00 – 17:00:00+00` (trajanje 0) | INC-04 | – (API) |
| TC-L2-04 | ❌ Neuspešen | po osvežitvi »Predlogi udeležencev (2)«, zavrnjen predlog je spet tam | INC-05 | [posnetek](e2e/dokazi/TC-L2-04_po-osvezitvi.png) |
| TC-L2-05 | ❌ Neuspešen | prikaz »Predlog od Ana:« brez datuma | INC-06 | [posnetek](e2e/dokazi/TC-L2-05_podrobnosti-predloga.png) |
| TC-L3-01 | ✅ Uspešen | – | – | [posnetek](e2e/dokazi/TC-L3-01_brez-izbire.png) |
| TC-L3-02 | ✅ Uspešen | – | – | [izbira](e2e/dokazi/TC-L3-02_1_izbran-termin.png), [skrbnik](e2e/dokazi/TC-L3-02_2_zakljuceno-skrbnik.png), [udeleženec](e2e/dokazi/TC-L3-02_3_zakljuceno-udelezenec.png) |
| TC-L3-03 | ❌ Neuspešen | povzetek organizatorju je veljaven JSON, **obe e-pošti udeležencem pa ne** | INC-07 | – (odložišče) |
| TC-L3-04 | ✅ Uspešen | – | – | [posnetek](e2e/dokazi/TC-L3-04_ze-zakljuceno.png) |
| TC-L3-05 | ❌ Neuspešen | glas po potrditvi: HTTP 201, glasov 4 namesto 3 | INC-08 | – (API) |
| TC-L3-06 | ❌ Neuspešen | termin iz druge ankete: HTTP 200 (anketa B zaključena s tujim terminom), neobstoječ termin: HTTP 500 | INC-09 | – (API) |
| TC-L3-07 | ❌ Neuspešen | vmesnik pravi, da so bili »vsi udeleženci obveščeni«, Ana pa ni prejela nobene e-pošte | INC-10 | [posnetek](e2e/dokazi/TC-L3-07_trdi-da-so-obvesceni.png) |
| TC-L3-08 | ❌ Neuspešen | `DTSTART=20261210T140000Z`, pričakovano `20261210T130000Z` | INC-11 | – (odložišče) |

\* TC-L2-02 je uspešen, ker je pričakovani rezultat koraka 3 omejen na ime predlagatelja. Manjkajoči datum je ločeno pokrit v TC-L2-05.

---

## 6. Poročila o incidentih (Test Incident Reports)

Resnost: **K** kritična (osrednja funkcionalnost ne deluje), **V** visoka, **S** srednja, **N** nizka.

| ID | Resnost | Naslov | Primer |
|---|---|---|---|
| INC-07 | K | E-pošta udeležencem s priponko .ics je neveljavna zahteva | TC-L3-03 |
| INC-10 | V | Potrditev termina iz predloga: udeleženci niso obveščeni, vmesnik trdi nasprotno | TC-L3-07 |
| INC-04 | V | Sprejeti predlog ima trajanje 0 (konec = začetek) | TC-L2-03 |
| INC-11 | V | Čas v .ics je zamaknjen za 1–2 h | TC-L3-08 |
| INC-09 | S | Potrditev s terminom, ki ne pripada anketi | TC-L3-06 |
| INC-08 | S | Glasovanje je mogoče tudi po potrditvi | TC-L3-05 |
| INC-05 | S | Zavrnitev predloga se ne shrani | TC-L2-04 |
| INC-01 | S | Neveljaven e-naslov organizatorja je sprejet | TC-L1-03 |
| INC-03 | S | API za ustvarjanje ankete ne validira vhoda | TC-L1-05 |
| INC-06 | N | Podrobnosti predloga ne prikažejo datuma | TC-L2-05 |
| INC-02 | N | Naslov iz samih presledkov je sprejet | TC-L1-04 |

### INC-01 – Neveljaven e-naslov organizatorja je sprejet
- **Koraki:** obrazec za ustvarjanje → naslov, e-pošta `organizator.eventease.test`, en termin → »Ustvari in deli«.
- **Pričakovano:** sporočilo o neveljavnem e-naslovu. **Dejansko:** anketa je ustvarjena. Organizator ne bo prejel nobenega obvestila (glasovi, potrditev).
- **Vzrok:** [CreateEventPage.jsx:106](frontend/EventEase/src/pages/CreateEventPage.jsx#L106) preveri le, ali polje ni prazno, obrazec ima `noValidate` ([:408](frontend/EventEase/src/pages/CreateEventPage.jsx#L408)), zato brskalnikova kontrola `type="email"` ne deluje. Isti obrazec za vabila (`handleAddEmail`) regularni izraz za e-naslov že uporablja.
- **Predlog:** ponovno uporabiti isti `emailRegex` tudi za e-naslov organizatorja.

### INC-02 – Naslov iz samih presledkov je sprejet
- **Koraki:** naslov `"   "`, veljavna e-pošta, termin → »Ustvari in deli«. **Pričakovano:** »Prosimo, vnesite naslov dogodka.« **Dejansko:** anketa brez vidnega naslova je ustvarjena.
- **Vzrok:** [CreateEventPage.jsx:102](frontend/EventEase/src/pages/CreateEventPage.jsx#L102) `if (!formData.title)` brez `trim()`.

### INC-03 – API za ustvarjanje ankete ne validira vhoda
- **Koraki:** `POST /api/polls` s (a) naslovom `"   "`, (b) `organizer_email: "ni-email"`, (c) `time_slots: []`, (d) koncem termina pred začetkom.
- **Pričakovano:** HTTP 400. **Dejansko:** HTTP 201 v vseh štirih primerih.
- **Vzrok:** [routes.zig `createPoll`](backend/logic/src/routes.zig#L358) vhod le razčleni in vstavi. Validacija obstaja samo v brskalniku in jo je mogoče zaobiti.

### INC-04 – Sprejeti predlog ima trajanje 0
- **Koraki:** udeleženec predlaga D12 ob 17:00, organizator sprejme.
- **Pričakovano:** nov termin 17:00–18:00 (kot vsi termini, ustvarjeni v koledarju). **Dejansko:** `start_time = end_time = 17:00`.
- **Vzrok:** [routes.zig:954](backend/logic/src/routes.zig#L954) `const end_time = start_time; // suggestions don't need a real end time`. `acceptSuggestion` ga nato prepiše v `time_slots`, kjer konec **je** potreben.
- **Posledica:** INC-10.

### INC-05 – Zavrnitev predloga se ne shrani
- **Koraki:** 2 predloga → v skrbniškem pogledu zavrni enega → števec pokaže (1) → osveži stran.
- **Pričakovano:** (1). **Dejansko:** (2), zavrnjen predlog je spet med čakajočimi.
- **Vzrok:** [AdminFinalizeView.jsx:74](frontend/EventEase/src/views/AdminFinalizeView.jsx#L74) `handleSuggestionAction` pri `reject` spremeni le lokalno stanje ([:111](frontend/EventEase/src/views/AdminFinalizeView.jsx#L111)). V backendu ni poti za zavrnitev.

### INC-06 – Podrobnosti predloga ne prikažejo datuma
- **Koraki:** skrbniški pogled → klik na predlagani dan. **Pričakovano:** »Predlog od Ana: 2026-12-12«. **Dejansko:** »Predlog od Ana:«.
- **Vzrok:** v [AdminFinalizeView.jsx:282](frontend/EventEase/src/views/AdminFinalizeView.jsx#L282) seznam `suggestions` za koledar nima polja `start_time`, [:302](frontend/EventEase/src/views/AdminFinalizeView.jsx#L302) pa ga bere.

### INC-07 – E-pošta udeležencem s priponko .ics je neveljavna zahteva (kritično)
- **Koraki:** potrdi anketo, v kateri sta udeleženca z e-naslovom → preglej odložišče.
- **Pričakovano:** telo zahteve za Resend je veljaven JSON. **Dejansko:** e-pošta organizatorju je veljavna, **obe e-pošti udeležencem pa nista** (`Bad control character in string literal`). V polju `text` so dobesedne nove vrstice in neubežani narekovaji (`termin za "Sestanek ekipe, …" je potrjen`).
- **Posledica:** pravi Resend tako zahtevo zavrne, napaka se le zapiše v dnevnik (`Failed to send finalization email to …`). V produkciji udeleženci torej **ne prejmejo .ics**, kar je osrednji namen funkcionalnosti F8. Dostave v produkciji nismo preverjali (izven obsega), vendar sklep izhaja neposredno iz neveljavnega JSON.
- **Vzrok:** [routes.zig:232](backend/logic/src/routes.zig#L232) `sendEmailWithIcs` vstavi besedilo v JSON brez ubežanja (za razliko od `sendEmail`, ki ubeži HTML). Dodatno se JSON v ukaz vstavi v enojnih narekovajih ([:243](backend/logic/src/routes.zig#L243)), zato naslov ali ime z `'` pokvari ukaz lupine.
- **Opomba:** vsebina .ics je pravilna (TC-L3-02), napačna je samo ovojnica.
- **Predlog:** zgraditi JSON s `std.json` in ga podati prek datoteke (`-d @file`), kot to že dela `sendEmail`.

### INC-08 – Glasovanje je mogoče tudi po potrditvi
- **Koraki:** potrdi anketo → `POST /api/polls/share/<token>/vote`. **Pričakovano:** HTTP 409, glas ni shranjen. **Dejansko:** HTTP 201, glas je shranjen (4 namesto 3), organizator prejme obvestilo o novem glasu.
- **Vzrok:** [routes.zig `submitVote`](backend/logic/src/routes.zig#L776) ne preveri `is_finalized`. Vmesnik po potrditvi obrazca ne prikaže, API pa zahtevo sprejme.

### INC-09 – Potrditev s terminom, ki ne pripada anketi
- **Koraki:** (a) `finalize` ankete B z `final_slot_id` termina ankete A, (b) `finalize` ankete C z neobstoječim UUID.
- **Pričakovano:** HTTP 400, anketi ostaneta odprti. **Dejansko:** (a) HTTP 200: anketa B je zaključena (`is_finalized=true`) s terminom ankete A. Iz kode sledi, da obvestila udeležencem B vsebujejo čas termina A, stran B pa prikaže »Podatki o terminu niso na voljo«, ker termina ni med termini ankete B (tega v testu nismo preverjali). (b) HTTP 500 (anketa ostane odprta zaradi tujega ključa).
- **Vzrok:** [routes.zig:1013](backend/logic/src/routes.zig#L1013) najprej zaključi anketo in šele nato ([:1018](backend/logic/src/routes.zig#L1018)) poišče termin, brez pogoja `poll_id`. `submitVote` takšno preverjanje že ima (`WHERE id = $1 AND poll_id = $2`).

### INC-10 – Potrditev termina iz predloga ne obvesti udeležencev
- **Koraki:** predlog D12 17:00 → sprejem → Ana (z e-pošto) glasuje »da« → organizator potrdi ta termin v vmesniku.
- **Pričakovano:** Ana prejme e-pošto z `event.ics`. **Dejansko:** e-pošte ni, v dnevniku je `Failed to send finalization email to Ana: error.InvalidTimeRange`. Vmesnik organizatorju kljub temu pokaže »Vsi udeleženci so bili obveščeni o izbranem terminu z datoteko .ics« ([FinalizedView.jsx:177](frontend/EventEase/src/views/FinalizedView.jsx#L177)).
- **Vzrok:** INC-04 (trajanje 0). [ics.zig:171](backend/logic/src/ics.zig#L171) pravilno zavrne `end <= start`, napaka pa se v `finalizePoll` le zapiše v dnevnik.
- **Predlog:** popraviti INC-04. Vmesnik naj sporoči, koliko obvestil ni bilo poslanih.

### INC-11 – Čas v .ics je zamaknjen
- **Koraki:** potrdi termin D10 14:00 (izbran v Sloveniji). **Pričakovano:** `DTSTART:20261210T130000Z` (14:00 CET). **Dejansko:** `DTSTART:20261210T140000Z`, kar koledar prikaže ob 15:00 (poleti ob 16:00). Spletna stran hkrati prikazuje »ob 14:00« (dokaz TC-L3-02).
- **Vzrok:** frontend pošilja lokalni čas brez zamika (`formatBackendSlot`), PostgreSQL ga shrani kot UTC. Omejitev je bila opisana že v [porocilo_naloga2.md, pogl. 7](porocilo_naloga2.md). Funkcionalni test zdaj potrjuje njeno vidno posledico za uporabnika.

---

## 7. Poročilo o zaključku testiranja (Test Completion Report)

### 7.1 Povzetek
Izvedeni so vsi načrtovani primeri (18/18) treh scenarijev, nobeden ni bil blokiran ali izpuščen.

| Scenarij | Primerov | Uspešnih | Neuspešnih | Incidenti |
|---|---|---|---|---|
| TS-L1 Ustvarjanje ankete | 5 | 2 | 3 | INC-01, 02, 03 |
| TS-L2 Predlog in sprejem | 5 | 2 | 3 | INC-04, 05, 06 |
| TS-L3 Potrditev in .ics | 8 | 3 | 5 | INC-07, 08, 09, 10, 11 |
| **Skupaj** | **18** | **7** | **11** | **11** (1 K, 3 V, 5 S, 2 N) |

### 7.2 Ocena
- **Glavni tokovi delujejo:** ustvarjanje ankete s termini, predlog in sprejem termina, glasovanje za sprejet termin, potrditev, zaklenjen prikaz po potrditvi in zavrnitev ponovne potrditve (409). Vsebina datoteke .ics je strukturno pravilna (CRLF, ubežan naslov, trajanje).
- **Ključna funkcionalnost F8 v trenutni obliki ne doseže udeležencev** (INC-07). Pri terminih iz predlogov ne deluje niti v testnem okolju (INC-04 → INC-10), kadar pa deluje, je čas zamaknjen (INC-11).
- **Validacija in pravila stanj so izvedena samo v brskalniku** (INC-01–03, INC-08, INC-09): kdor pozna API, jih zaobide.

Priporočeni vrstni red popravkov: INC-07 → INC-04 (odpravi tudi INC-10) → INC-11 → INC-09/INC-08 → ostali.

### 7.3 Kakovost samih testov
Kot pri nalogi 2 smo preverili, da vsak neuspešen primer pade **iz pravega razloga** (pregled sporočil o napakah, dejanskih vrednosti v opombah in posnetkov zaslona):
- Pri prvi izvedbi je TC-L3-06 za neobstoječ termin vrnil HTTP **409** namesto dejanskih **500**. Razlog je bil, da sta oba dela uporabljala isto anketo, ki jo je prvi del (napačno) že zaključil. Test je preverjal napačno stvar, zato smo ga popravili, da vsak del uporabi svojo anketo.
- Pri TC-L2-02 je prvotna trditev »Predlog od Ana: <datum>« padla zaradi INC-06, ne zaradi napake v glavnem toku. Trditev smo omejili na ime, datum pa preverja ločen primer TC-L2-05. Tako glavni tok ostane uporaben kot regresijski test.
- Pričakovani rezultati izhajajo iz specifikacije (1.2), ne iz trenutnega obnašanja (primer TC-L3-08 pričakovani UTC izračuna neodvisno prek `Intl` za Europe/Ljubljana).

### 7.4 Odstopanja od načrta
- E-pošta je preverjena prek testnega dvojnika in odložišča, ne prek Mailpita, kot nakazuje README (D-01). Dejanska dostava prek Resend ni preverjena.
- Izvedeno samo v Chromiumu.

### 7.5 Preostala tveganja
F2 (deljenje), F9 in dostava prek Resend niso testirani.

**Opažanje izven obsega (varnost):** `sendEmailWithIcs` vstavi naslov ankete in ime udeleženca v ukaz `sh -c "curl … -d '<json>'"` brez ubežanja ([routes.zig:243](backend/logic/src/routes.zig#L243)). Ime udeleženca z enojnim narekovajem lahko ob potrditvi ankete izvede poljuben ukaz v vsebniku backenda. Tega nismo testirali, ker varnostno testiranje ni del naloge, priporočamo pa takojšen pregled skupaj z INC-07.

---

## 8. Zagon in vključitev v cevovod

```bash
cd e2e
npm ci && npx playwright install chromium
npm run env:up     # testno okolje (ločen projekt eventease-e2e)
npm test           # 18 primerov; HTML poročilo: npm run report
npm run env:down
```

Podrobnosti so v [e2e/README.md](e2e/README.md). V [ci.yml](.github/workflows/ci.yml) je dodan posel **e2e**, ki po uspešnih poslih `frontend` in `backend` postavi testno okolje, požene scenarije in kot artefakt `e2e-report` naloži HTML poročilo, rezultate JSON in dokazila. Cevovod pade ob novi napaki in tudi takrat, ko kateri od znanih incidentov (`test.fail`) nepričakovano izgine, saj je treba oznako takrat odstraniti in incident zapreti.
