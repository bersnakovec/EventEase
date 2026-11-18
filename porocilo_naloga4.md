# Poročilo – Naloga 4 (ZK): Sistemsko testiranje EventEase – obremenitveni test

**Ekipa:** Jure Antolič, Lenart Beršnak
**Ta del poročila:** Lenart Beršnak (obremenitveni test, Apache JMeter)
**Projekt:** EventEase – React 19 + Vite (frontend), Zig 0.16 + httpz (backend), PostgreSQL 16, nginx
**Testirana različica:** `main`, commit `f0a62ce`
**Datum izvedbe:** 18. 11. 2026

| Član | Tip sistemskega testa | Orodje |
|---|---|---|
| Lenart Beršnak | obremenitveni test (load test) | Apache JMeter 5.6.3 |
| Jure Antolič | *(izpolni Jure)* | *(izpolni Jure)* |

## 0. Uporabljena orodja generativne umetne inteligence

| Orodje | Namen |
|---|---|
| **Claude Code** (razširitev za VS Code, agentni način) z modelom **Claude Opus 5.5** (naročnina Max) | razlaga navodil, pregled API-ja in kode backenda, priprava testnega načrta JMeter (`.jmx`), testnega okolja in skript, izvedba testa, analiza rezultatov, osnutek tega poročila |

Drugih orodij UI nismo uporabili. Pred začetkom je agent zastavil vprašanja o scenariju, profilu obremenitve, namestitvi orodja in kriterijih. Izbrali smo scenarij *udeleženec glasuje*, stopničast profil 10 → 50 → 100 uporabnikov, JMeter iz uradnega ZIP-a in kriterija p95 < 500 ms ter napake < 1 %.

---

## 1. Izbira tipa testa in orodja

**Tip testa: obremenitveni test.** Preverjamo, ali sistem pri pričakovani in povečani realni obremenitvi (do 100 sočasnih uporabnikov) ohranja sprejemljive odzivne čase brez napak. Sistema ne potiskamo do zloma, ker to ni stresni test.

**Orodje: Apache JMeter 5.6.3.**
- Odprtokodno in razširjeno orodje za obremenitvene teste HTTP/REST, ki deluje na obstoječi Javi 21.
- Omogoča realističen scenarij: korelacijo (`share_token` in ID-ji terminov iz odgovora), čase razmisleka, zaporedne nivoje obremenitve in preverjanje odgovorov (assertions).
- Ne-GUI način (`-n`) je primeren za ponovljiv zagon, HTML nadzorna plošča (`-e -o`) pa da grafe brez dodatnih vtičnikov.
- Vtičnikov ne uporabljamo. Stopničast profil je sestavljen iz treh standardnih skupin niti (Thread Group), ki se izvedejo zaporedno, scenarij pa je en sam Test Fragment, ki ga kličejo prek Module Controllerja.

## 2. Načrt testa (pred izvedbo)

### 2.1 Scenarij

Najpogostejša uporaba sistema je, da udeleženec po povezavi odpre anketo in odda glas. Organizator anketo ustvari samo enkrat, glasuje pa veliko ljudi.

| Korak | Zahtevek | Preverjanje |
|---|---|---|
| Priprava (setUp, 1 nit, enkrat) | 100 × `POST /api/polls` (anketa s 4 termini), `share_token` v skupni seznam | status 201 |
| 1. Odpri anketo | `GET /api/polls/share/{token}` naključne ankete, iz odgovora se izluščijo ID-ji terminov | status 200 |
| Čas razmisleka | 0,5–1,5 s (enakomerno naključno) | – |
| Čas izpolnjevanja | 1–3 s (enakomerno naključno) | – |
| 2. Oddaj glas | `POST /api/polls/share/{token}/vote`: unikatno ime in e-naslov, za vsak termin naključno `yes`/`no`/`if_need_be` | status 201 |

Vsak virtualni uporabnik (VU) korak 1 → 2 ponavlja v zanki. En VU tako ustvari približno 0,6 zahtevka/s. Vsak glas je nov zapis, zato se baza med testom polni kot v resnici.

### 2.2 Pogoji izvajanja (profil obremenitve)

| Nivo | Sočasni uporabniki | Ramp-up | Trajanje nivoja | Pričakovana prepustnost |
|---|---|---|---|---|
| 1 | 10 | 60 s | 240 s (60 s ramp-up + 180 s konstantno) | ~6 zahtevkov/s |
| 2 | 50 | 60 s | 240 s | ~30 zahtevkov/s |
| 3 | 100 | 60 s | 240 s | ~60 zahtevkov/s |

- Skupno trajanje je ~12 min, nivoji si sledijo zaporedno.
- Vsak zagon začne s svežim okoljem in prazno bazo (`docker compose down -v`).
- E-pošta je izklopljena (`DISABLE_EMAILS=true`), da merimo samo aplikacijo in bazo, ne zunanjega API-ja.
- Časovne omejitve odjemalca: vzpostavitev povezave 5 s, odgovor 30 s. Kar je počasnejše, šteje kot napaka.

### 2.3 Merjene metrike

| Metrika | Vir |
|---|---|
| Odzivni čas: povprečje, p50, p90, **p95**, p99, maksimum | JMeter (`rezultati.jtl`) |
| Prepustnost (zahtevki/s) | JMeter |
| **Delež napak** (napačna koda HTTP ali prekoračen čas) | JMeter, preverjanja odgovorov |
| CPE in pomnilnik vsebnikov `app` in `db` | `docker stats` vsaki ~2 s (`docker-stats.csv`) |
| Napake v dnevniku aplikacije | `docker compose logs app` |
| Število zapisov v bazi po testu (kontrola, da so se glasovi res zapisali) | `psql` |

Metrike vrednotimo v **ustaljenem stanju** vsakega nivoja, torej na vzorcih, ko so bile aktivne vse niti nivoja. Ramp-up je izključen.

### 2.4 Kriteriji sprejemljivosti

Sistem **ustreza**, če na **vsakem** nivoju v ustaljenem stanju velja:

1. **p95 odzivnega časa < 500 ms** (vsi zahtevki skupaj),
2. **delež napak < 1 %**,
3. poraba virov je stabilna: pomnilnik aplikacije med testom ne narašča neomejeno in v dnevniku ni napak.

## 3. Testno okolje

| Element | Vrednost |
|---|---|
| Strojna oprema | AMD Ryzen 7 5800XT (8 jeder / 16 niti), 16 GB RAM |
| Docker | Docker Desktop 29.5.2 (WSL2), na voljo 16 vCPU, 7,7 GiB |
| Sistem pod testom | `docker compose` (`compose.yaml` + [load/compose.load.yaml](load/compose.load.yaml)), projekt `eventease-load`, aplikacija na `localhost:8090` (nginx → Zig backend → PostgreSQL 16), bazen povezav z bazo: 5 |
| Generator obremenitve | JMeter 5.6.3 na istem računalniku (Java 21, `-Xmx1g`, ne-GUI način) |

Generator in sistem pod testom tečeta na istem računalniku, kar je omejitev in je opisana v razdelku 6. Ker so vrednosti daleč pod mejami, na izid to ne vpliva.

Datoteke: [load/eventease-obremenitev.jmx](load/eventease-obremenitev.jmx) (načrt), [load/run.sh](load/run.sh) (zagon), [load/evaluate.mjs](load/evaluate.mjs) (vrednotenje), [load/README.md](load/README.md) (navodila).

## 4. Izvedba

1. Kratek preizkus načrta (`SMOKE=1 load/run.sh`, 2 → 3 → 4 VU, 3 × 20 s): 116 zahtevkov, 0 napak. V bazi je bilo 50 glasov in 200 izbir, kar se ujema s 50 uspešnimi POST-i po 4 termine. Korelacija in zapis v bazo torej delujeta.
2. Polni test (`load/run.sh`): 18. 11. 2026, od 02:21:46 do 02:33:49 (12 min 3 s).

Rezultati polnega testa so v [load/rezultati/20261118-022140-polni/](load/rezultati/20261118-022140-polni/):
- [HTML nadzorna plošča JMetra](load/rezultati/20261118-022140-polni/porocilo/index.html),
- [vrednotenje.txt](load/rezultati/20261118-022140-polni/vrednotenje.txt),
- [docker-stats.csv](load/rezultati/20261118-022140-polni/docker-stats.csv),
- [app.log](load/rezultati/20261118-022140-polni/app.log), [jmeter.log](load/rezultati/20261118-022140-polni/jmeter.log).

## 5. Rezultati

Skupaj je bilo **22.270 zahtevkov** (100 v pripravi in 22.170 v nivojih) z **0 napakami**. Po testu je bilo v bazi 100 anket, 11.028 glasov in 44.112 izbir.

### 5.1 Ustaljeno stanje po nivojih (osnova za kriterije)

| Nivo | Vzorci | Napake | Povp. | p50 | p90 | **p95** | p99 | Max | Prepustnost |
|---|---|---|---|---|---|---|---|---|---|
| 1 (10 VU) | 1.212 | 0,00 % | 8 ms | 6 ms | 22 ms | **23 ms** | 25 ms | 37 ms | 6,6 /s |
| 2 (50 VU) | 5.924 | 0,00 % | 9 ms | 8 ms | 13 ms | **14 ms** | 17 ms | 58 ms | 33,1 /s |
| 3 (100 VU) | 11.683 | 0,00 % | 17 ms | 15 ms | 32 ms | **35 ms** | 40 ms | 85 ms | 65,6 /s |

### 5.2 Po zahtevkih (celoten nivo, z ramp-up)

| Nivo | Zahtevek | Vzorci | Povp. | p95 | Max |
|---|---|---|---|---|---|
| 1 | GET odpri anketo | 705 | 4 ms | 5 ms | 7 ms |
| 1 | POST oddaj glas | 698 | 12 ms | 23 ms | 37 ms |
| 2 | GET odpri anketo | 3.508 | 9 ms | 15 ms | 20 ms |
| 2 | POST oddaj glas | 3.470 | 8 ms | 9 ms | 58 ms |
| 3 | GET odpri anketo | 6.929 | 25 ms | 36 ms | 74 ms |
| 3 | POST oddaj glas | 6.860 | 8 ms | 9 ms | 85 ms |

### 5.3 Viri vsebnikov

| Vsebnik | CPE povp. | CPE max | RAM začetek → max → konec |
|---|---|---|---|
| `app` (nginx + Zig) | 11,7 % | 45,4 % | 5,0 → 10,8 → 9,6 MiB |
| `db` (PostgreSQL) | 21,9 % | 95,7 % | 40,1 → 49,5 → 49,3 MiB |

100 % pomeni eno jedro, Docker jih ima na voljo 16. V dnevniku aplikacije ni nobene napake.

### 5.4 Ovrednotenje kriterijev

| Kriterij | Nivo 1 | Nivo 2 | Nivo 3 |
|---|---|---|---|
| p95 < 500 ms | ✓ (23 ms) | ✓ (14 ms) | ✓ (35 ms) |
| Napake < 1 % | ✓ (0 %) | ✓ (0 %) | ✓ (0 %) |
| Stabilni viri, brez napak v dnevniku | ✓ | ✓ | ✓ |
| **Izid** | **USTREZA** | **USTREZA** | **USTREZA** |

## 6. Analiza in ugotovitve

**Sistem pri obremenitvi do 100 sočasnih uporabnikov (~66 zahtevkov/s) ustreza vsem kriterijem z veliko rezervo**: p95 je pri najvišjem nivoju 35 ms, kar je ~14-krat manj od meje. Zig backend porabi malo virov (RAM aplikacije pod 11 MiB, brez naraščanja, ki bi kazalo na puščanje pomnilnika).

**Ugotovitev 1 – odpiranje ankete se upočasnjuje s številom glasov (N+1 poizvedbe).** Odzivni čas `GET /api/polls/share/{token}` je med testom rasel, `POST` pa je ostal konstanten (~8 ms):

| Minuta testa | Glasov na anketo (povp.) | GET povp. | GET p95 | POST povp. |
|---|---|---|---|---|
| 1 | ~3 | 3,2 ms | 4 ms | 12,3 ms |
| 5 | ~21 | 7,0 ms | 10 ms | 7,5 ms |
| 6 | ~31 | 9,9 ms | 13 ms | 8,0 ms |
| 8 | ~50 | 15,6 ms | 19 ms | 7,2 ms |
| 10 | ~90 | 25,3 ms | 31 ms | 7,2 ms |
| 11 | ~110 | 32,5 ms | 39 ms | 8,9 ms |

V minutah 5–8 je bila obremenitev enaka (nivo 2, ~33 zahtevkov/s), GET pa se je kljub temu podaljšal s 7 na 16 ms. Vzrok torej ni obremenitev, ampak količina podatkov. V `routes.zig` (`getPoll`) se izbire za vsak glas naložijo z ločeno poizvedbo (`SELECT ... FROM vote_options WHERE vote_id = $1`). Za anketo s 110 glasovi je to 110 dodatnih poizvedb na en zahtevek, na stolpcu `vote_options.vote_id` pa ni indeksa ([podatkovna_shema.sql](backend/logic/src/podatkovna_shema.sql)). Čas raste približno linearno, ~0,3 ms na glas. Posledično je ob koncu testa baza občasno porabila skoraj celo jedro (max 95,7 %).

- *Vpliv:* pri realnih anketah z nekaj deset udeleženci je zanemarljiv. Groba linearna ekstrapolacija pa kaže, da bi anketa z ~1.500 glasovi že presegla mejo 500 ms.
- *Predlog:* izbire naložiti z eno poizvedbo za vse glasove (`WHERE vote_id = ANY($1)` ali `JOIN`) in dodati indeks `CREATE INDEX ON vote_options(vote_id)`.

**Ugotovitev 2 – bazen povezav (5) ni bil ozko grlo.** Kljub 100 sočasnim uporabnikom ni bilo čakanja ali napak, ker so zahtevki kratki (< 40 ms) in uporabniki med njimi razmišljajo 1,5–4,5 s.

**Omejitve testa:**
- JMeter in sistem tečeta na istem računalniku (lokalni Docker, brez omrežne zakasnitve), zato so absolutni časi boljši kot v produkciji.
- Testiran je en scenarij. Ustvarjanje ankete, predlogi terminov, potrditev in pošiljanje e-pošte niso bili pod obremenitvijo.
- Maksimalne zmogljivosti sistema nismo iskali. To bi bil predmet stresnega testa.

## 7. Zaključek

Obremenitveni test z JMetrom je pokazal, da EventEase pri pričakovani in povečani obremenitvi (10, 50 in 100 sočasnih uporabnikov, ki odpirajo ankete in glasujejo) **ustreza kriterijem**: p95 ≤ 35 ms, 0 % napak, stabilna poraba virov. Edino tveganje za zmogljivost je linearno upočasnjevanje odpiranja ankete z naraščanjem števila glasov zaradi N+1 poizvedb brez indeksa. Pri sedanji uporabi ni kritično, pri velikih anketah pa bi postalo.

## 8. Zagon

```bash
SMOKE=1 load/run.sh   # ~1 min, preizkus načrta
load/run.sh           # ~13 min, polni test (10 → 50 → 100 VU)
```

Skripta ob prvem zagonu prenese JMeter (s preverjanjem SHA-512), postavi sveže okolje, izvede test, zbere `docker stats`, ustvari HTML poročilo in izpiše izid kriterijev. Podrobnosti so v [load/README.md](load/README.md).
