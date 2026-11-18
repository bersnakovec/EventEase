# Obremenitveni test (JMeter) – naloga 4

Obremenitveni test EventEase z **Apache JMeter 5.6.3**. Opis načrta, rezultati in vrednotenje so v [porocilo_naloga4.md](../porocilo_naloga4.md).

| Datoteka | Namen |
|---|---|
| [eventease-obremenitev.jmx](eventease-obremenitev.jmx) | testni načrt JMeter (odpreš ga lahko tudi v GUI) |
| [compose.load.yaml](compose.load.yaml) | ločeno testno okolje `eventease-load`, aplikacija na vratih **8090** |
| [run.sh](run.sh) | prenos JMetra, zagon okolja, izvedba testa, `docker stats`, vrednotenje |
| [evaluate.mjs](evaluate.mjs) | metrike po nivojih (ustaljeno stanje) in preverjanje kriterijev |

## Zagon

Potrebni so Docker, Java 17+ (JMeter) in Node.js (za vrednotenje). Ukaze poženeš iz korena repozitorija v Git Bashu.

```bash
SMOKE=1 load/run.sh   # ~1 min: preizkus načrta (2 → 3 → 4 uporabniki)
load/run.sh           # ~13 min: polni test (10 → 50 → 100 uporabnikov)
```

Rezultati gredo v `load/rezultati/<čas>-<oznaka>/`:
- `porocilo/index.html`: HTML nadzorna plošča JMetra (grafi odzivnih časov, prepustnosti, napak);
- `vrednotenje.txt`: tabela metrik po nivojih in izid kriterijev;
- `docker-stats.csv`: poraba CPE in pomnilnika vsebnikov približno vsaki 2 s;
- `stanje-baze.txt`, `app.log`, `jmeter.log`.

Surova datoteka `rezultati.jtl` ni v gitu (velikost).

## Scenarij

1. **Priprava** (setUp, 1 nit): organizator ustvari 100 anket s po 4 termini, `share_token` se shrani v skupni seznam.
2. **Nivoji 1–3** (zaporedno): vsak virtualni uporabnik (VU) v zanki:
   - izbere naključno anketo in jo odpre (`GET /api/polls/share/:token`), nato 0,5–1,5 s razmišlja;
   - izpolni glas z naključnimi odgovori (`yes`/`no`/`if_need_be`), kar traja 1–3 s, in ga odda (`POST /api/polls/share/:token/vote`).

Parametri so nastavljivi z `-J`: `users1`, `users2`, `users3`, `ramp`, `step_duration`, `polls`, `host`, `port`.

GUI za ogled ali urejanje načrta:

```bash
java -jar load/.jmeter/apache-jmeter-5.6.3/bin/ApacheJMeter.jar -t load/eventease-obremenitev.jmx
```
