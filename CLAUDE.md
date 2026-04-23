# JDAV Rotpunkt-Training — Projektregeln für Claude

## Git-Workflow

**1 Branch = 1 Thema = 1 Pull Request**

Jede Änderung beginnt so:

```bash
git checkout main
git pull
git checkout -b <typ>/<thema>
```

Branch-Namensschema:

| Präfix | Verwendung |
|---|---|
| `feat/` | Neue Funktion |
| `fix/` | Fehlerbehebung |
| `ui/` | Reine UI/Styling-Änderungen |
| `refactor/` | Strukturänderungen ohne neue Funktion |
| `chore/` | Version, Doku, Meta |

Commits: **ein Commit = ein Thema**

```
feat: add archive logic for removed routes
ui: new-route badge in training list
chore: bump version to v2.3
```

Niemals gemischte Sammel-Commits wie "update app" oder "fix and feature".

**Pull Requests:**

- Genau ein Thema pro PR
- Klarer Titel, kurze Beschreibung (was + warum)
- Nie Feature + UI + Refactor in einer PR
- Nie Version + Feature in einer PR

**`main` bleibt stabil:**

- Kein direktes Arbeiten oder Pushen auf `main`
- Änderungen nur per PR
- Kein Force-Push auf `main`

---

## Technischer Stack

- Vanilla JS, keine Build-Tools, keine Module — klassische `<script>`-Tags
- Globaler Scope: Reihenfolge der Script-Tags in `index.html` ist funktional relevant
- Firebase Auth + Firestore für Cloud-Sync (optional, funktioniert auch rein lokal)
- GitHub Pages deployed automatisch von `main`

---

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

---

## Versionierung

- Version und Datum in `config.js` (`APP_VERSION`, `APP_BUILD_DATE`) pflegen
- Footer in `index.html` (`footer-version`-Span) manuell anpassen
- Changelog-Eintrag in der "Version & Verlauf"-Karte im Settings-Modal (`index.html`)
