# Kostenlos auf dem Handy spielen

WEITRAUM besteht ausschließlich aus statischen HTML-, CSS-, SVG- und JavaScript-Dateien. Es benötigt keinen kostenpflichtigen Server, keine Datenbank und keine API. Der GitHub-Pages-Workflow nutzt die kostenlose Veröffentlichung eines öffentlichen Repositories.

## Einmalige Freischaltung

1. Das Repository `Pawnxy/Space-Rangers` auf **Public** stellen: **Settings → General → Danger Zone → Change repository visibility**. Dadurch wird der Quellcode öffentlich sichtbar. Das Repository enthält ausschließlich Spielcode, Tests und Dokumentation; keine Zugangsdaten oder Spielstände.
2. Unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** wählen.
3. Unter **Actions → Publish WEITRAUM → Run workflow** den Branch `main` starten.

Der Workflow führt die Regeltests aus, baut `dist/` und veröffentlicht den geprüften Build. Solange das Repository privat ist, werden die Runner übersprungen. Bei späteren Änderungen an `main` wird die Veröffentlichung automatisch aktualisiert.

Die veröffentlichte Spieladresse lautet **[https://pawnxy.github.io/Space-Rangers/](https://pawnxy.github.io/Space-Rangers/)**. Die Bereitstellung über GitHub Actions ist abgeschlossen. Die öffentliche HTTPS-Seite wurde in Chromium bei 390 × 844 Pixeln geprüft: neue Reise, Landung, Markteinkauf und Wiederherstellung des Spielstands funktionieren ohne Browserfehler oder fehlgeschlagene Asset-Anfragen.

## Auf dem Handy

Die veröffentlichte HTTPS-Adresse in Chrome oder Safari öffnen, Rufname wählen und **Reise beginnen** antippen. Es ist kein ChatGPT-Konto zum Spielen erforderlich.

- **Android / Chrome:** Menü **⋮ → Zum Startbildschirm hinzufügen**.
- **iPhone / Safari:** Teilen-Menü **→ Zum Home-Bildschirm**.

Die Reise wird im Browser auf diesem Gerät gespeichert. Für einen Gerätewechsel oder vor dem Löschen von Browserdaten unter **Menü → Spielstand exportieren** eine Sicherung anlegen. Danach auf dem anderen Gerät über **Spielstand importieren** fortsetzen.

## Diagnose und Kosten

- Für API-Verwaltung aus der Cloud-Umgebung muss `api.github.com`, für die Prüfung der Website `pawnxy.github.io` im Netzwerkprofil erreichbar sein. Git-Zugriff auf das Repository allein gewährt noch keine API- oder Administratorrechte.
- Zur automatischen Freischaltung braucht die vorhandene GitHub-Verbindung Verwaltungsrechte am Repository und Schreibrechte für Pages. Die Einstellungen können alternativ über die oben beschriebenen GitHub-Seiten vorgenommen werden; ein zusätzlicher geheimer Schlüssel für das Spiel ist nicht nötig.
- Öffentliche GitHub-Pages-Websites unterliegen GitHubs Nutzungs- und Größenlimits. Dieser kleine statische Build benötigt weder eine kostenpflichtige Hosting-Buchung noch eine eigene Domain. Es werden keine kostenpflichtigen Dienste provisioniert.
