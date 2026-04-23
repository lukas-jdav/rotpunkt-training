# JDAV Rotpunkt-Training — Projektregeln für Claude

## Git-Workflow

**Immer direkt auf `main` committen und pushen. Niemals einen Branch erstellen, niemals einen PR erstellen — es sei denn, der User fordert das ausdrücklich in der Nachricht.**

## Technischer Stack

- Vanilla JS, keine Build-Tools, keine Module — klassische `<script>`-Tags
- Globaler Scope: Reihenfolge der Script-Tags in `index.html` ist funktional relevant
- Firebase Auth + Firestore für Cloud-Sync (optional, funktioniert auch rein lokal)
- GitHub Pages deployed automatisch von `main`

## Dateistruktur

```
index.html          App-Einstiegspunkt
styles.css          Gesamtes CSS
config.js           APP_CONFIG, APP_VERSION, APP_BUILD_DATE, Icons
utils.js            Pure Hilfsfunktionen
routes.js           Routen-Parsing, Business-Logik, getComputedState()
state.js            appState, FIREBASE_STATE, ui DOM-Cache
storage.js          localStorage + Firestore-Sync
auth.js             Firebase Auth
stats.js            Statistik-Berechnung + Render
ui.js               Alle render*-Funktionen, appendEntryRow()
app.js              init(), bindEvents(), Event-Handler
tivoli-routes-data.js   Rohdaten der Hallenkletterrouten (CSV als JS-Konstante)
```

## Versionierung

- Version und Datum in `config.js` (`APP_VERSION`, `APP_BUILD_DATE`) pflegen
- Footer in `index.html` (`footer-version`-Span) manuell anpassen
- Changelog-Eintrag in der "Version & Verlauf"-Karte im Settings-Modal (`index.html`)
