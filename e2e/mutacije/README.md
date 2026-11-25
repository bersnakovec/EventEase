# Namerno vnesene napake (naloga 5)

Vsaka datoteka `.patch` vnese eno napako v rešitev, da preverimo, ali jo funkcionalni testi zaznajo.

| Mutacija | Datoteka | Ciljni primer | Izpis zagona |
|---|---|---|---|
| M1 – obrazec ne preveri, da je izbran vsaj en termin | `frontend/.../CreateEventPage.jsx` | TC-L1-02 | `M1-izpis.txt` |
| M2 – sprejet predlog se ne doda med termine ankete | `backend/logic/src/routes.zig` (`acceptSuggestion`) | TC-L2-02 | `M2-izpis.txt` |
| M3 – obvestilo o potrditvi se pošlje tudi udeležencu brez e-naslova | `backend/logic/src/routes.zig` (`finalizePoll`) | TC-L3-02 | `M3-izpis.txt` (`M3-izpis-pred-popravkom-testa.txt` pred popravkom testa) |

`kontrola-brez-mutacij.txt` je kontrolni zagon na nespremenjeni kodi.

Ponovitev (iz korena repozitorija):

```sh
git apply e2e/mutacije/M1-frontend-brez-preverjanja-termina.patch
cd e2e && npm run env:up && npm test     # pričakovano: TC-L1-02 pade
cd .. && git apply -R e2e/mutacije/M1-frontend-brez-preverjanja-termina.patch
```

Vse tri mutacije hkrati so na veji `naloga5-mutacije` (CI na njej mora pasti).
