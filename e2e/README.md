# Funkcionalni (E2E) testi – naloga 3

Avtomatizirani testni scenariji TS-L1–TS-L3 (Playwright). Dokumentacija scenarijev, rezultati in poročila o incidentih so v [porocilo_naloga3.md](../porocilo_naloga3.md).

| Datoteka | Scenarij |
|---|---|
| [tests/TS-L1-ustvarjanje-ankete.spec.js](tests/TS-L1-ustvarjanje-ankete.spec.js) | TS-L1 Ustvarjanje ankete |
| [tests/TS-L2-predlog-termina.spec.js](tests/TS-L2-predlog-termina.spec.js) | TS-L2 Predlog termina in sprejem |
| [tests/TS-L3-potrditev-termina.spec.js](tests/TS-L3-potrditev-termina.spec.js) | TS-L3 Potrditev termina in .ics |

## Zagon

```bash
cd e2e
npm ci
npx playwright install chromium
mkdir -p .outbox && chmod 777 .outbox   # Linux/macOS: vsebnik mora imeti pravico pisanja
npm run env:up      # docker compose -p eventease-e2e (ločeno od razvojnega okolja)
npm test            # 18 testnih primerov, HTML poročilo: npm run report
npm run env:down    # ustavi okolje in izbriše testno bazo
```

## Testno okolje ([compose.e2e.yaml](compose.e2e.yaml))

- Ločen projekt `eventease-e2e` z lastno bazo. Razvojnih podatkov ne spreminja.
- **E-pošta ne zapusti vsebnika.** Backend pošilja e-pošto s `curl` na api.resend.com. V testnem okolju `curl` nadomesti testni dvojnik [fake-curl.sh](fake-curl.sh), ki zahtevo zapiše v `e2e/.outbox/*.json`, `api.resend.com` pa je dodatno preusmerjen na `127.0.0.1`. Obe varovalki pred zagonom preveri [global-setup.js](global-setup.js).
- Testi iz odložišča preberejo prejemnike, zadevo in priponko `event.ics` ([helpers/outbox.js](helpers/outbox.js)).

## Pričakovano neuspešni primeri (`test.fail`)

Primeri z oznako `[INC-xx]` preverjajo **pravilno** obnašanje, ki ga aplikacija trenutno ne izpolnjuje. Playwright jih šteje kot uspešne, dokler padajo (v izpisu so označeni z `x`). Ko je napaka odpravljena, test »nepričakovano uspe« in zagon se konča z napako. Takrat oznako `test.fail` odstranimo in incident zapremo.

Posnetki zaslona, ki služijo kot dokazila, se shranijo v [dokazi/](dokazi/).
