# WEITRAUM · Freie Horizonte

Ein spielbares Weltraum-RPG nach den Anforderungen aus dem Projektchat **„Spielentwurf nach Space Rangers“**. Die Spielwelt bewegt sich in Runden; Flüge, Planetenbahnen und Sprünge werden weich animiert. Die Oberfläche ist auf Deutsch und unterstützt Desktop und Smartphone.

**[Jetzt kostenlos im Browser spielen](https://pawnxy.github.io/Space-Rangers/)** — auch auf Android und iPhone. Ein Konto ist zum Spielen nicht erforderlich. Über das Browsermenü lässt sich die Seite zum Startbildschirm hinzufügen.

## Starten

Node.js ab Version 22 genügt. In der vorbereiteten Cloud-Umgebung liegt das Projekt unter `/workspace/Space-Rangers`.

```sh
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run dev
```

Der Entwicklungsserver verwendet Port **4173**. Ein anderer Port lässt sich mit `PORT=8080 npm run dev` wählen. Das Spiel benötigt keine API-Schlüssel, Datenbank oder externen Dienste. Alle Grafiken entstehen lokal aus Canvas und SVG.

Für eine statische Veröffentlichung:

```sh
npm run build
npm start
```

`dist/` enthält die vollständige Website. Der Inhalt kann auch auf einem statischen Webhost bereitgestellt werden. `npm start` dient zum lokalen Prüfen dieses Builds. Der enthaltene Dateiserver ist ein Entwicklungswerkzeug.

## Die erste Reise

1. Rufname und Galaxie-Seed eingeben, **Reise beginnen** wählen.
2. **Haven → Landeanflug**, dann **+1 Tag** wählen.
3. Im Hafen unter **Aufträge** die Depesche nach Meridian annehmen.
4. Startfreigabe anfordern, im Auftragsbuch das Ziel markieren und den Landeanflug beginnen.
5. Mit **Weiterfliegen** automatisch Spieltage ausführen lassen. Bei der Landung pausiert das Spiel.
6. Im Auftragsbüro die Prämie ausdrücklich abholen. Eine Quittung dokumentiert die einmalige Auszahlung.

Die ausführliche Anleitung ist über **?** erreichbar. Die Systemkarte lässt sich ziehen und zoomen. Kontakte stehen zusätzlich in Listen; auf dem Smartphone öffnet **Signale** diese Liste. **Leertaste** führt einen Spieltag aus oder pausiert laufende Flüge, **G** wechselt die Karte.

## Was spielbar ist

- 18 miteinander verbundene Sternensysteme, 54 Planeten, fünf Völker und vier Wirtschaftstypen.
- 18 Schiffe mit 1–6 unabhängigen Waffenplätzen, sechs Waffen, Inventar und vier ausbaubaren Bordsystemen.
- Zielaufschaltung, Annähern, Abstand halten, Umkreisen und Flucht. Treffer hängen von Entfernung und Nachführung ab. Vier Schadensarten treffen Schild, Panzerung und Hülle unterschiedlich. Aktive Schutzsysteme und Waffen teilen einen Kondensator.
- Mehr als 130 NPC-Schiffe zu Spielbeginn. Händler fliegen zwischen Welten und Systemen, Bergungspiloten leeren Wracks, Techniker reparieren Schiffe, Piraten jagen Frachter und Ranger verfolgen Feinde. Dominatoren benutzen ausschließlich ihre eigenen drei Klassen und dringen in benachbarte Systeme vor.
- Funkgeschäfte, Treibstoffhilfe, Feldreparaturen, Konvoischutz, Jagdaufträge, bezahlte Waffenruhen, Bluffs mit Erfolg und Fehlschlag sowie tatsächlich verfolgte Patrouillenmeldungen.
- Kurier- und Versorgungsaufträge mit Fristen und getrennter Prämienabholung. Bestätigte Leistungen verfallen nicht mit der ursprünglichen Lieferfrist.
- Hafenvertreter mit Erinnerungen, Vertrauen, dreistufigen Projekten und neuen Anliegen nach einer Wartezeit. Ausbildung in Handel, Technik und Diplomatie hat konkrete Auswirkungen.
- Randanflug, Abflug, Hyperraum und Wiedereintritt am gegenüberliegenden Systemrand. Verbrauchter Treibstoff und erreichbare Pannenhilfe werden berücksichtigt.
- Automatische lokale Speicherung, validierter JSON-Import und Export. Auch ein laufender Sprung kann gespeichert und fortgesetzt werden.

## Prüfen

```sh
npm test
npm run test:browser
```

Die Regeltests verwenden den eingebauten Node-Testläufer. Die Browserprüfungen verwenden Playwright und in dieser Cloud-Umgebung `/usr/bin/chromium`. Auf anderen Rechnern kann `CHROMIUM_PATH` auf eine vorhandene Chromium-Installation zeigen. Playwright ist ausschließlich eine Entwicklungsabhängigkeit.

Die Tests prüfen echte Spielabläufe: eine vollständige Kurierreise samt Handel und einmaliger Auszahlung, Funkentscheidungen, Ausrüstung, Gefechtsbefehle, Sprung und Wiederherstellung im Hyperraum sowie mehrere Bildschirmgrößen. Zwei Simulationen über jeweils 150 Spieltage prüfen autonome Flotten, Handel, Kämpfe, Systemwechsel und wiederholtes Laden der Spielstände.

## Aufbau

| Datei            | Aufgabe                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `src/data.mjs`   | Völker, Waren, Schiffe, Waffen und Weltdefinitionen                     |
| `src/engine.mjs` | Deterministische Simulation, Handel, Kampf, Aufträge und Speicherformat |
| `src/app.mjs`    | Bedienoberfläche, Dialoge, Autopilot und lokale Speicherung             |
| `src/render.mjs` | Animierte System- und Galaxiekarten                                     |
| `src/art.mjs`    | Eigenständige Völkerporträts, Schiffsgrafiken und Hafenpanoramen        |
| `src/style.css`  | Desktop- und Smartphone-Layout                                          |

## Stand und Grenzen

Das ist eine eigenständige Umsetzung der im Chat beschriebenen Spielidee. Der vorhandene Sites-Quellstand war aus dieser Umgebung nicht abrufbar. Spielstände der bisherigen Sites-Version sind deshalb **nicht kompatibel**; bestehende Reisen dieser neuen Fassung werden im Browser unter `weitraum:v1` gespeichert. Eine geplante Route über mehrere Systeme wird nach einem Neuladen neu gewählt; der bereits laufende Sprung selbst bleibt erhalten.

Das Spiel ist ein Einzelspielerspiel ohne Konto oder Cloud-Synchronisierung. Exportiere Sicherungen, bevor du Browserdaten löschst oder das Gerät wechselst. Die Browserprüfungen laufen in echtem Desktop-Chromium mit schmalen und breiten Ansichten; eine Prüfung auf einem physischen Android-Gerät und langfristiges Balancing stehen noch aus.

Die kostenlose Veröffentlichung für den Handy-Browser ist über den Workflow **Publish WEITRAUM** vorbereitet. Die einmalige Freischaltung und Bedienung auf Android/iPhone sind in [docs/PUBLISHING.md](docs/PUBLISHING.md) beschrieben. Ein erfolgreicher Deployment-Status und die Prüfung der Website bestätigen die tatsächliche Veröffentlichung.
