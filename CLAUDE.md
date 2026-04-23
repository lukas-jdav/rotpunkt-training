# JDAV Rotpunkt-Training — Projektregeln für Claude

## Git-Workflow

- Für normale manuelle Entwicklungsarbeit gilt: **1 Branch = 1 Thema = 1 Pull Request**.
- Branch-Namen möglichst thematisch und knapp halten, z. B. `feat/...`, `fix/...`, `ui/...`, `refactor/...`, `chore/...`.
- **`main` bleibt der stabile Stand** für die App.
- Keine gemischten Sammel-Änderungen in einem Thema-Branch.

### Ausnahme: automatischer Tivoli-Sync

- Der tägliche Tivoli-Routenabgleich läuft über GitHub Actions.
- Dieser Workflow darf Änderungen an `tivoli-routes-data.js` und den CSV-Snapshots **direkt nach `main` committen**, wenn sich die öffentliche Quelle geändert hat.
- Die App darf diesen GitHub-Workflow zusätzlich manuell auslösen.
- Diese Ausnahme gilt nur für den automatisierten Routendaten-Sync, nicht für normale Feature-, UI- oder Refactor-Arbeit.

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

## CI / Deployment

- GitHub Pages deployed **automatisch von `main`** — kein separater `deploy.yml`-Workflow nötig oder erwünscht.
- **Kein PR-Preview-Workflow** hinzufügen: Die `rossjrw/pr-preview-action` und ähnliche Actions setzen einen `gh-pages`-Branch als Deployment-Quelle voraus, was mit dem aktuellen Setup (Deployment direkt von `main`) inkompatibel ist.
- Die einzige erlaubte Workflow-Datei in `.github/workflows/` ist `sync-tivoli-routes.yml`.

## Versionierung

- Version und Datum in `config.js` (`APP_VERSION`, `APP_BUILD_DATE`) pflegen
- Footer in `index.html` (`footer-version`-Span) manuell anpassen
- Changelog-Eintrag in der "Version & Verlauf"-Karte im Settings-Modal (`index.html`)
