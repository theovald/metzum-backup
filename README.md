# metzum-backup

Passordbeskyttet reservekopi av foredraget «Det er på tide å ta ansvar» (The Moment
2026, Metzum), publisert på GitHub Pages. Både decket og presentervisningen virker.

## Bruk

Åpne siden, skriv inn passordet og velg **Presentervisning** eller **Bare slidene**.
Passordet huskes i nettleseren. Notater som redigeres i presentervisningen, lagres
bare lokalt i nettleseren.

## Slik virker det

`bygg.py` krypterer alle filene decket trenger, med AES-GCM og en nøkkel avledet fra
passordet (PBKDF2-SHA256, 600 000 iterasjoner). Også fillisten er kryptert. På
siden avleder `login.js` nøkkelen og lagrer den i IndexedDB, og `sw.js` (en service
worker) dekrypterer filene under `deck/` når nettleseren ber om dem. Repoet
inneholder ingen klartekst fra decket og ikke passordet.

| Sti | Innhold |
| --- | --- |
| `bygg.py` | Krypterer decket fra `presentasjoner/2026-10-27_metzum-the-moment` |
| `statisk/` | Innlogging, service worker og 404-side, kopieres til `docs/` |
| `docs/` | Siden som publiseres. `b/` har de krypterte filene, `m.bin` fillisten |

## Oppdatere

Krever at decket ligger i `../../presentasjoner/2026-10-27_metzum-the-moment`.

```sh
DECK_PASSORD=<passord> uv run --no-project --with cryptography python bygg.py
git add -A && git commit -m "Update deck" && git push
```

Saltet i `docs/salt.json` gjenbrukes, så uendrede filer gir samme krypterte fil.
