# IT-Schnuppermorgen · Feedback

Digitaler Feedback-Fragebogen für den IT-Schnuppermorgen der Bell Schweiz AG.
Eine statische Web-Applikation ohne Build-Werkzeuge, ohne Framework und ohne
Server — die Antworten gehen unverändert per `POST` an dieselbe Google-Apps-Script-
Web-App wie bisher.

```
┌──────────────┐   FormData (POST)   ┌────────────────┐   appendRow   ┌───────────────┐
│  Fragebogen  │ ──────────────────► │  Apps Script   │ ────────────► │ Google Sheets │
│  (Browser)   │   multipart/form    │   /exec        │               │  Auswertung   │
└──────────────┘                     └────────────────┘               └───────────────┘
```

---

## Inhalt

- [Schnellstart](#schnellstart)
- [Datenvertrag mit Google Sheets](#datenvertrag-mit-google-sheets)
- [Projektstruktur](#projektstruktur)
- [Konfiguration](#konfiguration)
- [Fragen ändern oder ergänzen](#fragen-ändern-oder-ergänzen)
- [Apps Script (optional)](#apps-script-optional)
- [Tests](#tests)
- [Design-System](#design-system)
- [Barrierefreiheit](#barrierefreiheit)
- [Datenschutz](#datenschutz)
- [Betrieb & Fehlerbilder](#betrieb--fehlerbilder)

---

## Schnellstart

**Variante A — direkt öffnen**

```bash
# index.html im Browser öffnen (Doppelklick genügt)
```

**Variante B — lokaler Server (empfohlen)**

```bash
python3 -m http.server 8000
# http://localhost:8000 aufrufen
```

Warum empfohlen? Über `file://` behandelt der Browser jede Datei als eigene
Herkunft. Das Formular funktioniert trotzdem vollständig, aber das echte Logo
lässt sich nicht in die PDF-Kopie einbetten (dann wird eine vektorbasierte
Ersatzmarke gezeichnet) und `localStorage` ist je nach Browser gesperrt.

Für den produktiven Einsatz genügt jeder Static-Host (GitHub Pages,
SharePoint, interner Webserver) — es gibt keinen Build-Schritt.

---

## Datenvertrag mit Google Sheets

> **Die wichtigste Regel des Projekts.**

Fünf Felder bilden den bestehenden Vertrag mit der Auswertungstabelle ab. Ihre
Namen **und** ihre Antwortwerte sind exakt dieselben wie vor dem Umbau:

| Feld (POST-Name) | Typ            | Übermittelte Werte                                                       | Ersatzwert     |
| ---------------- | -------------- | ------------------------------------------------------------------------ | -------------- |
| `gesamt`         | Einfachauswahl | `Äusserst gut` · `Sehr gut` · `Einigermassen gut` · `Eher nicht gut`      | `-`            |
| `workshops`      | Einfachauswahl | `Top` · `Gut` · `Okay` · `Nicht so`                                       | `-`            |
| `lehre`          | Mehrfachauswahl| `Plattformentwicklung` · `Applikationsentwicklung` · `ICT-Fachmann/-frau` · `Noch unentschieden` — verbunden mit `, ` | `Keine Angabe` |
| `highlight`      | Freitext       | max. 600 Zeichen                                                          | `-`            |
| `verbesserung`   | Freitext       | max. 600 Zeichen                                                          | `-`            |

Auch die Übertragung selbst ist unverändert: `fetch` mit `method: 'POST'` und
einem `FormData`-Body auf dieselbe `/exec`-URL, **ohne** zusätzliche
Request-Header. Dadurch bleibt der Aufruf ein *simple request* und löst keinen
CORS-Preflight aus, den Apps Script nicht beantworten würde.

### Zusätzliche Felder

Neu übermittelt werden ausserdem:

| Feld               | Inhalt                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `betreuung`        | Bewertung der Betreuung durch das Team                            |
| `interessen`       | IT-Themen (Mehrfachauswahl, verbunden mit `, `)                   |
| `vorkenntnisse`    | Selbsteinschätzung der IT-Erfahrung                               |
| `weiterempfehlung` | Weiterempfehlung 0–10 (NPS-Logik)                                 |
| `einverstaendnis`  | `Ja`, sobald die Einwilligung bestätigt wurde                     |
| `vorgangsnummer`   | Eindeutige ID der Übermittlung (Idempotenz, Beleg für die Person) |
| `zeitstempel`      | ISO-Zeitstempel des Clients                                       |
| `formularVersion`  | Version des Formulars                                             |
| `sprache`          | `de` oder `en` — nur die Anzeige, nie die Werte                   |
| `dauerSekunden`    | Bearbeitungsdauer                                                 |

Ein bestehendes Apps Script, das nur die fünf bekannten Spalten liest,
**ignoriert diese Felder folgenlos** — es ändert sich nichts an der Tabelle.
Damit sie tatsächlich in der Tabelle landen, kann das mitgelieferte
[Apps Script](#apps-script-optional) eingespielt werden.

Sollen ausschliesslich die fünf Ursprungsfelder gesendet werden:

```js
// assets/js/config.js
sendExtendedFields: false,
sendDiagnostics: false,
```

---

## Projektstruktur

```
index.html                 App-Shell (Rail, Topbar, Karte, Log-Konsole)
apps-script/Code.gs        Optionales Backend für Google Sheets
tests/index.html           Selbsttests, im Browser ausführbar

assets/
  css/
    fonts.css              Lokal gehostete Schriften (@font-face)
    tokens.css             Design-Tokens: Farben, Typografie, Abstände, Motion
    base.css               Reset, Grundtypografie, Hintergrund-Szene
    layout.css             App-Shell, Rail, Stepper, Arbeitsfläche
    components.css         Buttons, Pills, Banner, Toasts, Log-Konsole
    questionnaire.css      Fragen, Auswahlkacheln, Skala, Zusammenfassung
    print.css              Druckansicht / „Als PDF speichern“
  fonts/                   Inter + JetBrains Mono (woff2, SIL OFL)
  img/                     Bell-Logo, Markenfoto
  js/
    core.js                DOM-Helfer, Icons, Storage, Event-Bus, Logger
    config.js              Endpunkt und Betriebsparameter
    i18n.js                Deutsch / Englisch
    schema.js              ► Definition des gesamten Fragebogens
    validation.js          Regelwerk (reine Funktionen)
    state.js               Antworten, Entwurfsspeicher, Payload-Aufbau
    ui.js                  Theme, Sprache, Status, Banner, Toasts, Log
    render.js              Erzeugt die Oberfläche aus dem Schema
    transport.js           Übermittlung, Timeout, Offline-Warteschlange
    export.js              PDF-Kopie und Druckbeleg
    wizard.js              Schritte, Validierung, Fortschritt, Absenden
    app.js                 Bootstrap und Fehlerbehandlung
```

Die Skripte werden als klassische `<script>`-Tags in Abhängigkeitsreihenfolge
geladen — bewusst keine ES-Module, damit `index.html` auch über `file://`
funktioniert.

---

## Konfiguration

Alles Einstellbare steht in **`assets/js/config.js`**:

| Schlüssel                  | Standard  | Bedeutung                                                       |
| -------------------------- | --------- | --------------------------------------------------------------- |
| `endpoint`                 | `…/exec`  | URL der Apps-Script-Web-App                                     |
| `requestTimeoutMs`         | `25000`   | Abbruch nach dieser Zeit                                        |
| `sendExtendedFields`       | `true`    | Neue Fragen mitsenden                                           |
| `sendDiagnostics`          | `true`    | Vorgangsnummer, Zeitstempel, Version, Sprache, Dauer mitsenden  |
| `autoRetry`                | `false`   | Automatischer zweiter Sendeversuch (siehe unten)                |
| `defaultLocale`            | `'de'`    | Startsprache                                                    |
| `autoDetectLocale`         | `false`   | Browsersprache übernehmen                                       |
| `draftTtlHours`            | `24`      | Lebensdauer eines lokalen Entwurfs                              |
| `showConsole`              | `true`    | System-Log unter der Karte anzeigen                             |
| `pdfEnabled`               | `true`    | PDF-Export anbieten                                             |

Ohne Änderung am Repository lässt sich alles überschreiben:

```html
<script>window.BELL_FEEDBACK_CONFIG = { endpoint: 'https://…/exec' };</script>
```

### Warum `autoRetry` standardmässig aus ist

Bricht die Antwort ab, **nachdem** Apps Script die Zeile bereits geschrieben
hat, würde ein automatischer zweiter Versuch einen Doppeleintrag erzeugen.
Deshalb gilt „höchstens einmal senden“: Bei einem Fehler bleiben die Antworten
lokal erhalten und die Person entscheidet per Klick über einen erneuten
Versuch. Mit dem mitgelieferten `Code.gs` erkennt der Server Duplikate anhand
der Vorgangsnummer — erst dann ist `autoRetry: true` gefahrlos.

Im Offline-Fall wird gar nicht erst gesendet: Der Datensatz wandert in eine
lokale Warteschlange und geht automatisch raus, sobald die Verbindung
zurückkehrt.

---

## Fragen ändern oder ergänzen

Der komplette Fragebogen steht in **`assets/js/schema.js`**. Rendering,
Validierung, Fortschritt, Zusammenfassung, PDF und Payload leiten sich daraus
ab — mehr als dieser eine Eintrag ist nicht nötig:

```js
{
  id: 'anreise',                 // = Feldname im POST
  type: 'choice',                // choice | multi | scale | text | consent
  required: true,
  layout: 'rows dense',          // tiles | rows | rows dense
  emptyValue: '-',               // was ohne Antwort gesendet wird
  label: { de: 'Wie bist du angereist?', en: 'How did you get here?' },
  help:  { de: 'Nur für die Planung.',   en: 'For planning only.' },
  options: [
    { value: 'ÖV',      icon: 'network', label: { de: 'Öffentlicher Verkehr', en: 'Public transport' } },
    { value: 'Velo',    icon: 'gitBranch', label: { de: 'Velo', en: 'Bicycle' } },
    { value: 'Zu Fuss', icon: 'gauge',   label: { de: 'Zu Fuss', en: 'On foot' } }
  ]
}
```

Regeln:

- **`id` ist der Feldname im POST.** Bestehende IDs niemals umbenennen.
- **`value` ist der Wert in der Tabelle** und bleibt immer deutsch — auch wenn
  die Oberfläche auf Englisch steht. Nur `label` wird übersetzt.
- Fragen mit `core: true` gehören zum unveränderlichen Vertrag oben.
- `exclusive: true` an einer Option einer Mehrfachauswahl schliesst alle
  anderen aus (z. B. „Noch unentschieden“).
- Verfügbare Icon-Namen stehen in `assets/js/core.js` (`ICON_PATHS`).

Nach jeder Änderung `tests/index.html` öffnen — die Suite prüft unter anderem,
ob der Datenvertrag noch stimmt.

---

## Apps Script (optional)

`apps-script/Code.gs` ersetzt das bestehende Skript, wenn auch die neuen Felder
in der Tabelle landen sollen. Es ist bewusst rückwärtskompatibel:

- Spalten werden aus der Kopfzeile gelesen; unbekannte Felder werden
  **automatisch als neue Spalte** angehängt.
- Bestehende Kopfzeilen bleiben erhalten, auch bei abweichender Schreibweise
  (`Gesamtbewertung` wird als `gesamt` erkannt).
- Doppelte Übermittlungen werden über die Vorgangsnummer abgefangen.
- `LockService` verhindert Kollisionen, wenn eine ganze Klasse gleichzeitig
  absendet.
- Eingaben werden gegen Formel-Auswertung entschärft.

**Installation:** Tabelle → *Erweiterungen* → *Apps Script* → Inhalt einfügen →
*Bereitstellen* → *Neue Bereitstellung* → Typ **Web-App**, Ausführen als **Ich**,
Zugriff **Alle** → die `/exec`-URL in `config.js` eintragen.

Ein Aufruf der `/exec`-URL im Browser (GET) liefert einen Statusbericht mit
Zeilenzahl und erkannten Spalten — praktisch für die Inbetriebnahme.

---

## Tests

```bash
python3 -m http.server 8000
# http://localhost:8000/tests/
```

42 Tests laufen ohne Build-Werkzeuge direkt im Browser und prüfen:

- den **Datenvertrag** (Feldnamen, Optionswerte, Ersatzwerte, Reihenfolge),
- Validierung inklusive Grenzfällen,
- Zustandslogik, exklusive Optionen, Fortschrittsberechnung,
- Entwurfsspeicher — auch mit absichtlich manipulierten Daten,
- Textbereinigung und Schutz vor Formel-Injektion,
- Vollständigkeit der Übersetzungen.

Die Ergebnisse liegen zusätzlich unter `window.__TEST_RESULTS__` und lassen
sich so in einer CI mit einem Headless-Browser auswerten.

---

## Design-System

Alle Farben, Abstände, Radien, Schatten und Zeiten sind Tokens in
`assets/css/tokens.css`; Komponenten greifen ausschliesslich darauf zu.

**Herkunft der Farben:** direkt aus dem Logo abgetastet — `#FE0000` (Rot) und
`#51B401` (Grün). Für Text und Bedienelemente werden abgedunkelte Varianten
verwendet, damit die Kontraste WCAG 2.1 AA erreichen. Rot bleibt die
Markenfarbe, Grün steht für „erledigt“ — das zieht sich vom Stepper über die
Fortschrittsleiste (Rot → Grün) bis zur Bestätigung durch.

**Informatik-Anmutung** ohne Bruch mit der Marke: monospace Metadaten
(JetBrains Mono), Schritte als Pipeline-Knoten, eine Leiterbahn-Textur im
Hintergrund, eine Vorschau der zu sendenden Daten und ein System-Log.

Helles und dunkles Theme sind gleichwertig gepflegt (`Hell` / `Dunkel` /
`Auto`); die Wahl bleibt lokal gespeichert und wird vor dem ersten Rendern
gesetzt, damit nichts aufblitzt.

---

## Barrierefreiheit

- Bedienung vollständig per Tastatur; Auswahlkacheln sind echte
  `input`-Elemente, die Pfeiltasten funktionieren wie erwartet.
- Sichtbare Fokusringe, Sprunglink, `fieldset`/`legend` je Frage.
- Fehler werden per `role="alert"` und `aria-invalid` gemeldet und erhalten den
  Fokus.
- Statuswechsel laufen über Live-Regionen.
- `prefers-reduced-motion` schaltet Animationen ab.
- Kontraste nach WCAG 2.1 AA in beiden Themes.
- Tastenkürzel: `Enter` weiter · `Strg`/`Cmd`+`Enter` senden · `Alt`+`←`/`→`
  blättern.

---

## Datenschutz

- Die Erhebung ist **anonym**: keine Namen, keine E-Mail-Adressen, keine
  Kontaktdaten, keine Cookies, kein Tracking.
- Schriften liegen lokal im Repository — es gehen keine Anfragen an Google
  Fonts oder andere Dritte.
- Entwürfe bleiben ausschliesslich im `localStorage` des Geräts und werden nach
  erfolgreichem Absenden gelöscht (spätestens nach 24 Stunden).
- Vor dem Absenden ist eine ausdrückliche Bestätigung nötig; die zu sendenden
  Daten lassen sich vorher vollständig einsehen.
- Einzige externe Anfrage zur Laufzeit: die PDF-Bibliothek von cdnjs. Ist sie
  blockiert, greift automatisch der Druckdialog.

Im Repository liegen **keine privaten oder produktiven Daten**. Beispieldaten
bitte nur anonymisiert ergänzen.

---

## Betrieb & Fehlerbilder

| Symptom                                     | Ursache & Lösung                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Banner „Konfiguration unvollständig“        | `endpoint` in `config.js` ist keine gültige `/exec`-URL.                                              |
| „Übermittlung fehlgeschlagen“               | Apps-Script-Bereitstellung prüfen: Zugriff muss **Alle** sein. Details stehen im System-Log.          |
| Feedback erscheint nicht in der Tabelle     | Nach jeder Skriptänderung eine **neue Bereitstellung** erzeugen — die alte `/exec`-URL zeigt sonst auf den alten Stand. |
| Neue Felder fehlen in der Tabelle           | Bestehendes Skript liest nur die alten Spalten → `apps-script/Code.gs` einspielen.                     |
| PDF-Button öffnet den Druckdialog           | cdnjs ist im Netz gesperrt; der Ausdruck ist der vorgesehene Ersatzweg.                                |
| Logo fehlt im PDF                           | Seite über `http(s)` statt `file://` öffnen.                                                          |
| „Kein Speicher“ in der Statusleiste         | `localStorage` ist gesperrt (Privatmodus/Richtlinie). Das Formular funktioniert, nur ohne Entwurf.     |

Das **System-Log** unter der Karte protokolliert Schrittwechsel, Validierungen
und jede Netzwerkaktion mit Statuscode und Dauer — für Support-Fälle meist der
schnellste Weg zur Ursache.

Unterstützt werden alle aktuellen Browser (Chrome, Edge, Firefox, Safari,
inklusive iOS und Android).

---

## Mitmachen

Issues und Pull Requests sind willkommen. Bitte vor dem Absenden
`tests/index.html` ausführen und den Datenvertrag oben respektieren.
