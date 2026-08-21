/**
 * =============================================================================
 *  Bell IT · Feedback — Google Apps Script Backend (optional)
 * =============================================================================
 *
 *  WICHTIG: Der Fragebogen funktioniert weiterhin mit dem bestehenden Skript.
 *  Dieses File ist ein OPTIONALES Upgrade. Es lohnt sich, wenn zusaetzlich zu
 *  den fuenf urspruenglichen Feldern auch die neuen Angaben (Betreuung,
 *  IT-Interessen, Vorkenntnisse, Weiterempfehlung, Vorgangsnummer …) in der
 *  Tabelle landen sollen.
 *
 *  Eigenschaften
 *  -------------
 *  · Spalten werden aus der Kopfzeile gelesen; unbekannte Felder werden
 *    automatisch als neue Spalte ergaenzt (kein manuelles Nachpflegen).
 *  · Bestehende Kopfzeilen bleiben unveraendert – auch bei abweichender
 *    Schreibweise (Alias-Erkennung, z. B. "Gesamtbewertung" -> gesamt).
 *  · Doppelte Uebermittlungen werden anhand der Vorgangsnummer erkannt und
 *    nicht erneut geschrieben (Idempotenz).
 *  · LockService verhindert, dass parallele Klassen-Uploads Zeilen ueberschreiben.
 *  · Eingaben werden gegen Formel-Injektion entschaerft.
 *
 *  Installation
 *  ------------
 *  1. Google Tabelle oeffnen  ->  Erweiterungen  ->  Apps Script
 *  2. Inhalt dieses Files in "Code.gs" einfuegen und speichern
 *  3. Bereitstellen  ->  Neue Bereitstellung  ->  Typ "Web-App"
 *       Ausfuehren als:  Ich
 *       Zugriff:         Alle (auch anonyme Nutzer)
 *  4. Die /exec-URL in assets/js/config.js als `endpoint` eintragen
 *
 *  Test ohne Formular:  im Editor die Funktion `selbsttest()` ausfuehren.
 * =============================================================================
 */

/** Name des Tabellenblatts. Leer lassen = aktives/erstes Blatt verwenden. */
var SHEET_NAME = '';

/** Spaltenreihenfolge fuer neu angelegte Tabellen. */
var STANDARD_HEADERS = [
  'Zeitstempel',
  'gesamt',
  'workshops',
  'lehre',
  'highlight',
  'verbesserung',
  'betreuung',
  'interessen',
  'vorkenntnisse',
  'weiterempfehlung',
  'einverstaendnis',
  'vorgangsnummer',
  'formularVersion',
  'sprache',
  'dauerSekunden'
];

/**
 * Alias-Tabelle: erkennt bestehende Kopfzeilen, auch wenn sie anders
 * geschrieben sind. Schluessel = Feldname aus dem Formular.
 */
var HEADER_ALIASES = {
  zeitstempel: ['zeitstempel', 'timestamp', 'datum', 'zeit', 'erfasstam', 'eingangam'],
  gesamt: ['gesamt', 'gesamtbewertung', 'gesamteindruck', 'bewertung', 'gesamturteil'],
  workshops: ['workshops', 'workshop', 'workshopbewertung'],
  lehre: ['lehre', 'lehrberuf', 'lehrberufe', 'lehrstelle'],
  highlight: ['highlight', 'highlights', 'gefallen', 'bestes'],
  verbesserung: ['verbesserung', 'verbesserungen', 'besser', 'verbesserungsvorschlag'],
  betreuung: ['betreuung', 'support'],
  interessen: ['interessen', 'themen', 'itthemen'],
  vorkenntnisse: ['vorkenntnisse', 'erfahrung', 'itkenntnisse'],
  weiterempfehlung: ['weiterempfehlung', 'nps', 'empfehlung'],
  einverstaendnis: ['einverstaendnis', 'einverstandnis', 'einwilligung', 'consent'],
  vorgangsnummer: ['vorgangsnummer', 'id', 'submissionid', 'referenz'],
  formularVersion: ['formularversion', 'version'],
  sprache: ['sprache', 'language', 'locale'],
  dauerSekunden: ['dauersekunden', 'dauer', 'duration']
};

/* ========================================================================== */
/*  Einstiegspunkte                                                           */
/* ========================================================================== */

/** Wird vom Fragebogen aufgerufen (POST, multipart/form-data). */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonAntwort({ result: 'error', message: 'Tabelle ist belegt, bitte erneut versuchen.' });
  }

  try {
    var daten = leseParameter(e);
    if (!Object.keys(daten).length) {
      return jsonAntwort({ result: 'error', message: 'Keine Daten empfangen.' });
    }

    var blatt = holeBlatt();
    var kopf = holeKopfzeile(blatt);

    // Idempotenz: bereits geschriebene Vorgangsnummer nicht erneut anhaengen.
    var vorgang = daten.vorgangsnummer;
    if (vorgang && bereitsVorhanden(blatt, kopf, vorgang)) {
      return jsonAntwort({ result: 'duplicate', vorgangsnummer: vorgang });
    }

    kopf = ergaenzeFehlendeSpalten(blatt, kopf, daten);
    var zeile = baueZeile(kopf, daten);
    blatt.appendRow(zeile);

    return jsonAntwort({
      result: 'success',
      row: blatt.getLastRow(),
      vorgangsnummer: vorgang || '',
      columns: kopf.length
    });
  } catch (err) {
    return jsonAntwort({ result: 'error', message: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/** Einfacher Statusabruf im Browser – praktisch fuer die Inbetriebnahme. */
function doGet() {
  var blatt = holeBlatt();
  return jsonAntwort({
    result: 'ok',
    service: 'Bell IT Feedback',
    sheet: blatt.getName(),
    rows: Math.max(0, blatt.getLastRow() - 1),
    columns: holeKopfzeile(blatt)
  });
}

/* ========================================================================== */
/*  Hilfsfunktionen                                                           */
/* ========================================================================== */

/** Liest Formularfelder ODER einen JSON-Body. */
function leseParameter(e) {
  var daten = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (key) {
      daten[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.type === 'application/json' && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      Object.keys(json).forEach(function (key) { daten[key] = json[key]; });
    } catch (err) { /* kein gueltiges JSON – Formularfelder genuegen */ }
  }

  // Mehrfachwerte (gleicher Feldname mehrfach) zusammenfuehren.
  if (e && e.parameters) {
    Object.keys(e.parameters).forEach(function (key) {
      var werte = e.parameters[key];
      if (werte && werte.length > 1) daten[key] = werte.join(', ');
    });
  }

  return daten;
}

function holeBlatt() {
  var mappe = SpreadsheetApp.getActiveSpreadsheet();
  var blatt = SHEET_NAME ? mappe.getSheetByName(SHEET_NAME) : mappe.getSheets()[0];
  if (!blatt) blatt = mappe.insertSheet(SHEET_NAME || 'Feedback');

  if (blatt.getLastRow() === 0) {
    blatt.appendRow(STANDARD_HEADERS);
    blatt.getRange(1, 1, 1, STANDARD_HEADERS.length).setFontWeight('bold');
    blatt.setFrozenRows(1);
  }
  return blatt;
}

function holeKopfzeile(blatt) {
  var breite = Math.max(1, blatt.getLastColumn());
  return blatt.getRange(1, 1, 1, breite).getValues()[0].map(function (wert) {
    return String(wert === null || wert === undefined ? '' : wert).trim();
  });
}

function normalisiere(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

/** Sucht die Spalte, die zu einem Feldnamen passt (inkl. Aliasse). */
function spaltenIndex(kopf, feld) {
  var kandidaten = HEADER_ALIASES[feld] || [normalisiere(feld)];
  kandidaten = kandidaten.concat([normalisiere(feld)]);

  for (var i = 0; i < kopf.length; i++) {
    var spalte = normalisiere(kopf[i]);
    if (!spalte) continue;
    for (var k = 0; k < kandidaten.length; k++) {
      if (spalte === kandidaten[k]) return i;
    }
  }
  return -1;
}

/** Haengt Spalten fuer bisher unbekannte Felder an die Kopfzeile an. */
function ergaenzeFehlendeSpalten(blatt, kopf, daten) {
  var neue = [];

  Object.keys(daten).forEach(function (feld) {
    if (feld === 'zeitstempel') return;              // wird separat gefuehrt
    if (spaltenIndex(kopf, feld) === -1 && neue.indexOf(feld) === -1) neue.push(feld);
  });

  if (!neue.length) return kopf;

  var start = kopf.length + 1;
  blatt.getRange(1, start, 1, neue.length).setValues([neue]).setFontWeight('bold');
  return kopf.concat(neue);
}

/** Baut die Zeile passend zur (ggf. erweiterten) Kopfzeile. */
function baueZeile(kopf, daten) {
  var zeile = new Array(kopf.length).fill('');

  var zeitSpalte = spaltenIndex(kopf, 'zeitstempel');
  if (zeitSpalte >= 0) zeile[zeitSpalte] = new Date();

  Object.keys(daten).forEach(function (feld) {
    if (feld === 'zeitstempel' && zeitSpalte >= 0) return;
    var index = spaltenIndex(kopf, feld);
    if (index >= 0) zeile[index] = entschaerfe(daten[feld]);
  });

  return zeile;
}

/** Verhindert, dass Eingaben in der Tabelle als Formel ausgewertet werden. */
function entschaerfe(wert) {
  var text = String(wert === null || wert === undefined ? '' : wert);
  if (/^[=+@]/.test(text)) text = "'" + text;
  return text.length > 5000 ? text.substring(0, 5000) : text;
}

/** Prueft, ob eine Vorgangsnummer bereits erfasst wurde. */
function bereitsVorhanden(blatt, kopf, vorgang) {
  var spalte = spaltenIndex(kopf, 'vorgangsnummer');
  if (spalte === -1) return false;

  var letzteZeile = blatt.getLastRow();
  if (letzteZeile < 2) return false;

  // Nur die letzten 500 Zeilen pruefen – schnell und fuer diesen Zweck genug.
  var von = Math.max(2, letzteZeile - 499);
  var anzahl = letzteZeile - von + 1;
  var werte = blatt.getRange(von, spalte + 1, anzahl, 1).getValues();

  for (var i = 0; i < werte.length; i++) {
    if (String(werte[i][0]).trim() === String(vorgang).trim()) return true;
  }
  return false;
}

function jsonAntwort(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================== */
/*  Selbsttest (im Apps-Script-Editor ausfuehrbar)                            */
/* ========================================================================== */
function selbsttest() {
  var antwort = doPost({
    parameter: {
      gesamt: 'Sehr gut',
      workshops: 'Top',
      lehre: 'Applikationsentwicklung',
      highlight: 'Testeintrag aus dem Apps-Script-Editor',
      verbesserung: '-',
      betreuung: 'Sehr gut',
      interessen: 'Programmieren, Cybersecurity',
      vorkenntnisse: 'Grundlagen',
      weiterempfehlung: '9',
      einverstaendnis: 'Ja',
      vorgangsnummer: 'selbsttest-' + Date.now(),
      formularVersion: '2.0.0',
      sprache: 'de',
      dauerSekunden: '42'
    }
  });
  Logger.log(antwort.getContent());
}
