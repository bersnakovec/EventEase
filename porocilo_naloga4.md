# Poročilo – Naloga 4 (ZK): Obremenitveni test EventEase

**Ekipa:** Jure Antolič, Lenart Beršnak · **Ta del:** Lenart Beršnak · **Datum:** 18. 11. 2026 · **Različica:** `main`, `f0a62ce`

| Član | Tip testa | Orodje |
|---|---|---|
| Lenart Beršnak | obremenitveni test | Apache JMeter 5.6.3 |


**Uporaba UI:** Claude Code (VS Code) z modelom Claude Opus 5.5 (naročnina Max) za pripravo testnega načrta, skript in okolja, izvedbo, analizo in osnutek poročila.

## 1. Orodje

JMeter je odprtokoden in razširjen za obremenitvene teste REST API-jev. Omogoča korelacijo podatkov iz odgovorov, čase razmisleka, zaporedne nivoje obremenitve in HTML poročilo z grafi. Test teče v ne-GUI načinu, brez vtičnikov.

## 2. Načrt testa

**Scenarij:** udeleženec odpre anketo in odda glas, kar je najpogostejša uporaba sistema. V pripravi se ustvari 100 anket s po 4 termini. Nato vsak virtualni uporabnik (VU) v zanki:
1. odpre naključno anketo (`GET /api/polls/share/{token}`),
2. po 1,5–4,5 s razmisleka odda glas z naključnimi odgovori (`POST /api/polls/share/{token}/vote`).

**Pogoji:**
- Profil: trije zaporedni nivoji z **10, 50 in 100 VU**; vsak nivo ima 60 s ramp-up in 180 s konstantne obremenitve, skupaj ~12 min.
- Okolje: lokalni Docker (Ryzen 7 5800XT, 16 GB RAM). Vsak zagon začne s prazno bazo, e-pošta je izklopljena.

**Metrike:**
- odzivni čas (povprečje, p95, maksimum),
- prepustnost,
- delež napak (koda HTTP ≠ 200/201 ali odgovor po več kot 30 s),
- CPE in RAM vsebnikov (`docker stats`).

**Kriteriji** (v ustaljenem stanju vsakega nivoja):
- **p95 < 500 ms**,
- **napake < 1 %**,
- stabilna poraba pomnilnika in brez napak v dnevniku.

## 3. Rezultati

Skupaj je bilo 22.270 zahtevkov in nobene napake. Po testu je bilo v bazi 11.028 glasov.

| Nivo | Zahtevkov | Povp. | **p95** | Max | Prepustnost | Napake | Izid |
|---|---|---|---|---|---|---|---|
| 10 VU | 1.212 | 8 ms | **23 ms** | 37 ms | 6,6 /s | 0 % | ✓ ustreza |
| 50 VU | 5.924 | 9 ms | **14 ms** | 58 ms | 33,1 /s | 0 % | ✓ ustreza |
| 100 VU | 11.683 | 17 ms | **35 ms** | 85 ms | 65,6 /s | 0 % | ✓ ustreza |

Viri:
- **Aplikacija:** CPE povprečno 12 %, RAM 5 → 11 MiB brez naraščanja.
- **Baza:** CPE povprečno 22 % (vrh 96 % enega jedra), RAM ~49 MiB.
- V dnevniku aplikacije ni napak.

## 4. Ugotovitve

**Sistem ustreza vsem kriterijem**, pri 100 VU je p95 ~14-krat pod mejo.

**Odpiranje ankete se upočasnjuje s številom glasov.**
- GET ankete se je podaljšal s 3 ms (~3 glasovi na anketo) na 33 ms (~110 glasov na anketo). Rasel je tudi pri nespremenjeni obremenitvi.
- Oddaja glasu je ves čas ostala pri ~8 ms.
- **Vzrok:** `getPoll` za vsak glas pošlje ločeno poizvedbo (N+1), na `vote_options.vote_id` pa ni indeksa.
- **Vpliv:** pri običajnih anketah ga ni, anketa z več kot ~1.500 glasovi pa bi presegla 500 ms.
- **Predlog:** eno poizvedbo za vse glasove in indeks na `vote_options(vote_id)`.

**Omejitve:**
- JMeter in sistem tečeta na istem računalniku, brez omrežne zakasnitve.
- Testiran je le en scenarij.
- Meje zmogljivosti nismo iskali, saj to spada v stresni test.

## 5. Datoteke

- Testni načrt in skripte: [load/](load/). Zagon z `load/run.sh`, navodila v [load/README.md](load/README.md).
- Rezultati in HTML poročilo JMetra: [load/rezultati/20261118-022140-polni/](load/rezultati/20261118-022140-polni/).
