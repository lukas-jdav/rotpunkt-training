# JDAV Aachen Rotpunkt-Trainings-App

Statische Web-App fuer das Rotpunkt-Trainingskonzept der JDAV Aachen.

## Lokal oeffnen

Die App kann direkt im Browser ueber `index.html` geoeffnet werden.

## Projektstruktur

- `index.html` startet die App fuer GitHub Pages und lokal.
- `legacy-redirect.html` ist ein Alt-Link und leitet auf die aktuelle App in `index.html` weiter.
- `tivoli-routes-data.js` enthaelt die Routendaten.
- `data/latest-route-sync.json` und `data/latest-route-sync.js` enthalten die letzte Route-Aenderung als Feed fuer App-Benachrichtigungen.
- `data/snapshots/` enthaelt die datierten CSV-Snapshots der letzten Tivoli-Imports.
- `scripts/sync-tivoli-routes.mjs` synchronisiert die Tivoli-Routen aus der oeffentlichen 8a.nu-Topo-Seite.

## Routen-Sync

Die Routendaten koennen mit Node aktualisiert werden:

`node scripts/sync-tivoli-routes.mjs`

Der Sync liest die oeffentliche 8a.nu-Topo-Seite fuer Tivoli aus, aktualisiert `tivoli-routes-data.js` und schreibt bei Aenderungen einen aktuellen CSV-Snapshot nach `data/snapshots/tivoli-routes-YYYY-MM-DD.csv`.
Zusatzlich erzeugt der Sync einen kleinen Aenderungs-Feed in `data/latest-route-sync.json` und `data/latest-route-sync.js`, damit die App neue, aktualisierte und archivierte Routen als Hinweis anzeigen kann.

Fuer GitHub gibt es ausserdem den Workflow `.github/workflows/sync-tivoli-routes.yml`, der den Sync taeglich ausfuehrt und Aenderungen automatisch nach `main` committed.

## Benachrichtigungen

Die App zeigt die letzten Tivoli-Routen-Aenderungen direkt im Dashboard an.
Optional koennen im Einstellungsdialog Browser-Benachrichtigungen aktiviert werden. Diese melden neue Sync-Ergebnisse, solange die App in einem Browser-Tab geoeffnet ist.

In der App kann der gleiche Workflow zusaetzlich manuell ueber den Einstellungsdialog ausgelost werden. Dafuer wird ein GitHub-Token lokal im Browser gespeichert.

## GitHub

Dieses Projekt ist fuer ein einfaches Hosting ueber GitHub Pages vorbereitet.

Empfohlene Schritte:

1. Neues Repository auf GitHub anlegen.
2. Dieses Verzeichnis als Git-Repository committen.
3. Das GitHub-Repository als `origin` hinterlegen und pushen.
4. In GitHub Pages `Deploy from a branch` aktivieren und die Root des Default-Branches waehlen.

Danach ist die App ueber GitHub direkt im Browser erreichbar.
