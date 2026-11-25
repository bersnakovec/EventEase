# Upravljanje napak – MantisBT (naloga 6)

MantisBT 2.29.0 na PHP 8.3 + Apache + MySQL 8.4 v Dockerju, http://localhost:8989.

## Namestitev od začetka

1. Prenesi `mantisbt-2.29.0.zip` (https://mantisbt.org) in vsebino notranje mape `mantisbt-2.29.0/` razširi v `napake/mantisbt/` (ni v repozitoriju).
2. `docker compose up -d --build` (iz mape `napake/`).
3. Namestitev baze: odpri http://localhost:8989/admin/install.php (tip `mysqli`, gostitelj `db`, uporabnik/geslo `mantis`/`mantis`, baza `bugtracker`, časovni pas `Europe/Ljubljana`).
   Namestitev ustvari `mantisbt/config/config_inc.php`; vrstico `$g_crypto_master_salt` prepiši v `config/salt_inc.php` (`<?php` + ta vrstica).
4. `MSYS_NO_PATHCONV=1 docker compose exec mantis php /skripte/postavitev.php` ustvari uporabnika `lenart`, projekt, kategorije, verzije, lastna polja in žeton API (`skripte/.token`).
5. `node skripte/vpis.mjs` vpiše napake iz [napake.json](napake.json) prek REST API.
6. `node skripte/odprava.mjs` izvede potek odprave za INC-02 in INC-06.
7. `sh skripte/izvoz.sh` izvozi CSV, Excel (SpreadsheetML) in JSON v `izvoz/`.

Prijava: `lenart` / `lenart` (vodja projekta), `administrator` / `root`. Lokalna namestitev, e-pošta je izklopljena.

## Datoteke

| Pot | Vsebina |
|---|---|
| `compose.yaml`, `Dockerfile` | okolje (mod_rewrite za REST API) |
| `config/config_inc.php` | 4 nivoji kritičnosti, slovenščina, polja na obrazcih, stolpci izvoza |
| `config/custom_strings_inc.php` | oznake kritičnosti: nizka, srednja, visoka, kritična |
| `napake.json` | vir podatkov o napakah (iz porocilo_naloga3.md) |
| `skripte/` | postavitev, vpis, odprava, izvoz, posnetki zaslona |
| `izvoz/` | **oddaja**: `napake_eventease.csv`, `.xml` (Excel), `.json` (z opombami in zgodovino) |
| `dokazi/` | posnetki zaslona Mantisa in popravljenih napak |
