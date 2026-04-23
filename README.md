# JDAV Aachen Rotpunkt-Trainings-App

Statische Web-App fuer das Rotpunkt-Trainingskonzept der JDAV Aachen.

## Lokal oeffnen

Die App kann direkt im Browser ueber `index.html` geoeffnet werden.

## Projektstruktur

- `index.html` startet die App fuer GitHub Pages und lokal.
- `legacy-redirect.html` ist ein Alt-Link und leitet auf die aktuelle App in `index.html` weiter.
- `tivoli-routes-data.js` enthaelt die Routendaten.
- `Tivoli Sports Klettern-routes-current-2026-04-13.csv` ist die Quell-CSV.
- `scripts/sync-tivoli-routes.mjs` synchronisiert die Tivoli-Routen aus der oeffentlichen 8a.nu-Topo-Seite.

## Routen-Sync

Die Routendaten koennen mit Node aktualisiert werden:

`node scripts/sync-tivoli-routes.mjs`

Der Sync liest die oeffentliche 8a.nu-Topo-Seite fuer Tivoli aus, aktualisiert `tivoli-routes-data.js` und schreibt bei Aenderungen einen aktuellen CSV-Snapshot mit Tagesdatum.

Fuer GitHub gibt es ausserdem den Workflow `.github/workflows/sync-tivoli-routes.yml`, der den Sync taeglich ausfuehrt und Aenderungen automatisch nach `main` committed.

## GitHub

Dieses Projekt ist fuer ein einfaches Hosting ueber GitHub Pages vorbereitet.

Empfohlene Schritte:

1. Neues Repository auf GitHub anlegen.
2. Dieses Verzeichnis als Git-Repository committen.
3. Das GitHub-Repository als `origin` hinterlegen und pushen.
4. In GitHub Pages `Deploy from a branch` aktivieren und die Root des Default-Branches waehlen.

Danach ist die App ueber GitHub direkt im Browser erreichbar.
