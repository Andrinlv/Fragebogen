/* =============================================================================
   tests.js — Selbsttests fuer die Logikschicht
   -----------------------------------------------------------------------------
   Laeuft ohne Build-Werkzeuge direkt im Browser: tests/index.html oeffnen.
   Geprueft wird bewusst das, was still kaputtgehen kann: der Datenvertrag mit
   Google Sheets, Validierung, Zustandslogik und Textbereinigung.
============================================================================= */
(function () {
  'use strict';

  var App = window.BellFeedback;
  var results = [];

  /* ------------------------------------------------------- Mini-Framework */
  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (err) {
      results.push({ name: name, ok: false, message: err && err.message ? err.message : String(err) });
    }
  }

  function fail(message) { throw new Error(message); }

  var assert = {
    ok: function (value, message) {
      if (!value) fail(message || 'Erwartet: wahr, erhalten: ' + JSON.stringify(value));
    },
    equal: function (actual, expected, message) {
      if (actual !== expected) {
        fail((message || 'Ungleich') + ' — erwartet ' + JSON.stringify(expected) + ', erhalten ' + JSON.stringify(actual));
      }
    },
    deepEqual: function (actual, expected, message) {
      var a = JSON.stringify(actual);
      var b = JSON.stringify(expected);
      if (a !== b) fail((message || 'Ungleich') + ' — erwartet ' + b + ', erhalten ' + a);
    },
    throws: function (fn, message) {
      var threw = false;
      try { fn(); } catch (err) { threw = true; }
      if (!threw) fail(message || 'Es wurde kein Fehler geworfen');
    }
  };

  /* ====================================================== Core / Utilities */
  test('Core.escapeHtml maskiert alle kritischen Zeichen', function () {
    assert.equal(App.Core.escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  });

  test('Core.sanitizeText entfernt Steuerzeichen und trimmt', function () {
    var input = '  Hallo\u0000\u0007 Welt  ';
    assert.equal(App.Core.sanitizeText(input), 'Hallo Welt');
  });

  test('Core.sanitizeText behaelt Zeilenumbrueche', function () {
    assert.equal(App.Core.sanitizeText('a\r\nb'), 'a\nb');
  });

  test('Core.sanitizeText kappt auf die Maximallaenge', function () {
    assert.equal(App.Core.sanitizeText('abcdefghij', 4), 'abcd');
  });

  test('Core.neutralizeFormula entschaerft Formeln', function () {
    assert.equal(App.Core.neutralizeFormula('=SUM(A1:A9)'), "'=SUM(A1:A9)");
    assert.equal(App.Core.neutralizeFormula('+1'), "'+1");
    assert.equal(App.Core.neutralizeFormula('@import'), "'@import");
    assert.equal(App.Core.neutralizeFormula('Alles gut'), 'Alles gut');
  });

  test('Aufzaehlungen mit fuehrendem Minus bleiben unveraendert', function () {
    assert.equal(App.Core.neutralizeFormula('- mehr Zeit'), '- mehr Zeit');
    App.State.reset();
    App.State.set('verbesserung', '- mehr Zeit an den Stationen');
    assert.equal(App.State.buildPayload({}).verbesserung, '- mehr Zeit an den Stationen');
  });

  test('Core.submissionRef liefert ein stabiles Format', function () {
    var ref = App.Core.submissionRef('0e2371b6-453e-48c8-b317-3660d5b3a116');
    assert.ok(/^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref), 'Unerwartetes Format: ' + ref);
  });

  test('Core.uuid erzeugt eindeutige Werte', function () {
    var a = App.Core.uuid();
    var b = App.Core.uuid();
    assert.ok(a !== b, 'UUIDs sind identisch');
    assert.ok(a.length >= 16, 'UUID zu kurz');
  });

  test('Core.storage speichert und liest verlustfrei', function () {
    var key = '__test__' + App.Core.uuid();
    App.Core.storage.set(key, { a: 1, b: ['x'] });
    assert.deepEqual(App.Core.storage.get(key), { a: 1, b: ['x'] });
    App.Core.storage.remove(key);
    assert.equal(App.Core.storage.get(key, 'weg'), 'weg');
  });

  /* ================================================ Vertrag mit dem Sheet */
  test('Kernfelder entsprechen exakt dem bisherigen Sheet-Vertrag', function () {
    var ids = App.Schema.coreQuestions().map(function (q) { return q.id; });
    assert.deepEqual(ids, ['gesamt', 'workshops', 'lehre', 'highlight', 'verbesserung']);
  });

  test('Optionswerte der Gesamtbewertung sind unveraendert', function () {
    var werte = App.Schema.getQuestion('gesamt').options.map(function (o) { return o.value; });
    assert.deepEqual(werte, ['Äusserst gut', 'Sehr gut', 'Einigermassen gut', 'Eher nicht gut']);
  });

  test('Optionswerte der Workshop-Frage sind unveraendert', function () {
    var werte = App.Schema.getQuestion('workshops').options.map(function (o) { return o.value; });
    assert.deepEqual(werte, ['Top', 'Gut', 'Okay', 'Nicht so']);
  });

  test('Die drei urspruenglichen Lehrberufe sind unveraendert enthalten', function () {
    var werte = App.Schema.getQuestion('lehre').options.map(function (o) { return o.value; });
    ['Plattformentwicklung', 'Applikationsentwicklung', 'ICT-Fachmann/-frau'].forEach(function (wert) {
      assert.ok(werte.indexOf(wert) >= 0, 'Fehlt: ' + wert);
    });
  });

  test('Leere Kernfelder verwenden die bisherigen Ersatzwerte', function () {
    App.State.reset();
    var payload = App.State.buildPayload({ submissionId: 'test' });
    assert.equal(payload.gesamt, '-');
    assert.equal(payload.workshops, '-');
    assert.equal(payload.lehre, 'Keine Angabe');
    assert.equal(payload.highlight, '-');
    assert.equal(payload.verbesserung, '-');
  });

  test('Die Kernfelder stehen im Payload an erster Stelle', function () {
    App.State.reset();
    var keys = Object.keys(App.State.buildPayload({ submissionId: 'test' }));
    assert.deepEqual(keys.slice(0, 5), ['gesamt', 'workshops', 'lehre', 'highlight', 'verbesserung']);
  });

  test('Alle Frage-IDs sind eindeutig', function () {
    var gesehen = {};
    App.Schema.allQuestions().forEach(function (q) {
      if (gesehen[q.id]) fail('Doppelte ID: ' + q.id);
      gesehen[q.id] = true;
    });
  });

  test('Jede Frage besitzt Labels in beiden Sprachen', function () {
    App.Schema.allQuestions().forEach(function (q) {
      assert.ok(q.label && q.label.de && q.label.en, 'Label unvollstaendig bei ' + q.id);
    });
  });

  test('Jede Option besitzt einen eindeutigen, nicht leeren Wert', function () {
    App.Schema.allQuestions().forEach(function (q) {
      if (!q.options) return;
      var gesehen = {};
      q.options.forEach(function (o) {
        assert.ok(o.value && String(o.value).length > 0, 'Leerer Wert bei ' + q.id);
        if (gesehen[o.value]) fail('Doppelter Wert "' + o.value + '" bei ' + q.id);
        gesehen[o.value] = true;
      });
    });
  });

  /* ============================================================ Validierung */
  test('Pflicht-Einfachauswahl ohne Antwort ist ungueltig', function () {
    var q = App.Schema.getQuestion('gesamt');
    assert.deepEqual(App.Validation.validate(q, null), { valid: false, code: 'requiredChoice' });
  });

  test('Pflicht-Mehrfachauswahl ohne Antwort ist ungueltig', function () {
    var q = App.Schema.getQuestion('lehre');
    assert.deepEqual(App.Validation.validate(q, []), { valid: false, code: 'requiredMulti' });
  });

  test('Zustimmung ist Pflicht', function () {
    var q = App.Schema.getQuestion('einverstaendnis');
    assert.equal(App.Validation.validate(q, false).code, 'consent');
    assert.equal(App.Validation.validate(q, true).valid, true);
  });

  test('Skalenwerte ausserhalb 0-10 werden abgelehnt', function () {
    var q = App.Schema.getQuestion('weiterempfehlung');
    assert.equal(App.Validation.validate(q, 11).valid, false);
    assert.equal(App.Validation.validate(q, -1).valid, false);
    assert.equal(App.Validation.validate(q, 0).valid, true);
    assert.equal(App.Validation.validate(q, 10).valid, true);
  });

  test('Zu langer Freitext wird abgelehnt', function () {
    var q = App.Schema.getQuestion('highlight');
    var lang = new Array(q.maxLength + 20).join('x');
    var result = App.Validation.validate(q, lang);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'maxLength');
  });

  test('Freiwilliger Freitext darf leer bleiben', function () {
    assert.equal(App.Validation.validate(App.Schema.getQuestion('highlight'), '').valid, true);
  });

  test('validateStep meldet alle fehlenden Pflichtfelder eines Schritts', function () {
    App.State.reset();
    var errors = App.Validation.validateStep(App.Schema.steps[0], App.State.getAll());
    assert.equal(errors.length, 3, 'Erwartet 3 Pflichtfehler in Schritt 1');
  });

  test('validateAll ist leer, sobald alles ausgefuellt ist', function () {
    App.State.reset();
    App.State.set('gesamt', 'Sehr gut');
    App.State.set('workshops', 'Gut');
    App.State.set('betreuung', 'Gut');
    App.State.set('lehre', ['Applikationsentwicklung']);
    App.State.set('weiterempfehlung', 9);
    App.State.set('einverstaendnis', true);
    assert.deepEqual(App.Validation.validateAll(App.Schema.steps, App.State.getAll()), []);
  });

  /* ================================================================= State */
  test('toggleMulti fuegt hinzu und entfernt', function () {
    App.State.reset();
    App.State.toggleMulti('interessen', 'Programmieren', true);
    App.State.toggleMulti('interessen', 'Cybersecurity', true);
    assert.deepEqual(App.State.get('interessen'), ['Programmieren', 'Cybersecurity']);
    App.State.toggleMulti('interessen', 'Programmieren', false);
    assert.deepEqual(App.State.get('interessen'), ['Cybersecurity']);
  });

  test('toggleMulti haelt die Reihenfolge des Schemas ein', function () {
    App.State.reset();
    App.State.toggleMulti('interessen', 'Cloud & Betrieb', true);
    App.State.toggleMulti('interessen', 'Programmieren', true);
    assert.deepEqual(App.State.get('interessen'), ['Programmieren', 'Cloud & Betrieb']);
  });

  test('Exklusive Option verdraengt alle anderen und umgekehrt', function () {
    App.State.reset();
    App.State.toggleMulti('lehre', 'Plattformentwicklung', true);
    App.State.toggleMulti('lehre', 'Applikationsentwicklung', true);
    assert.equal(App.State.get('lehre').length, 2);

    App.State.toggleMulti('lehre', 'Noch unentschieden', true);
    assert.deepEqual(App.State.get('lehre'), ['Noch unentschieden']);

    App.State.toggleMulti('lehre', 'Plattformentwicklung', true);
    assert.deepEqual(App.State.get('lehre'), ['Plattformentwicklung']);
  });

  test('Mehrfachauswahl wird als kommaseparierter String uebermittelt', function () {
    App.State.reset();
    App.State.toggleMulti('lehre', 'Plattformentwicklung', true);
    App.State.toggleMulti('lehre', 'Applikationsentwicklung', true);
    assert.equal(App.State.buildPayload({}).lehre, 'Plattformentwicklung, Applikationsentwicklung');
  });

  test('Formeln in Freitexten werden im Payload entschaerft', function () {
    App.State.reset();
    App.State.set('highlight', '=HYPERLINK("http://boese.example")');
    assert.equal(App.State.buildPayload({}).highlight.charAt(0), "'");
  });

  test('Fortschritt steigt mit jeder beantworteten Frage', function () {
    App.State.reset();
    assert.equal(App.State.progress(), 0);
    App.State.set('gesamt', 'Sehr gut');
    assert.ok(App.State.progress() > 0, 'Fortschritt sollte groesser 0 sein');
    App.Schema.allQuestions().forEach(function (q) {
      if (q.type === 'multi') App.State.set(q.id, [q.options[0].value]);
      else if (q.type === 'scale') App.State.set(q.id, 8);
      else if (q.type === 'consent') App.State.set(q.id, true);
      else if (q.type === 'text') App.State.set(q.id, 'Test');
      else App.State.set(q.id, q.options[0].value);
    });
    assert.equal(App.State.progress(), 100);
  });

  test('Entwurf laesst sich sichern, laden und wieder anwenden', function () {
    App.State.reset();
    App.State.set('gesamt', 'Äusserst gut');
    App.State.set('highlight', 'Ein Entwurfstext');
    App.State.toggleMulti('lehre', 'ICT-Fachmann/-frau', true);
    App.State.saveDraft();

    App.State.reset();
    assert.equal(App.State.get('gesamt'), null, 'State wurde nicht zurueckgesetzt');

    var draft = App.State.loadDraft();
    assert.ok(draft, 'Kein Entwurf gefunden');
    App.State.applyDraft(draft);
    assert.equal(App.State.get('gesamt'), 'Äusserst gut');
    assert.equal(App.State.get('highlight'), 'Ein Entwurfstext');
    assert.deepEqual(App.State.get('lehre'), ['ICT-Fachmann/-frau']);
    App.State.clearDraft();
  });

  test('Ein manipulierter Entwurf kippt die Applikation nicht', function () {
    App.State.reset();
    App.State.applyDraft({
      answers: {
        gesamt: 'Existiert nicht',
        lehre: 'kein Array',
        weiterempfehlung: 'keine Zahl',
        einverstaendnis: 'ja bitte'
      }
    });
    assert.equal(App.State.get('gesamt'), null, 'Unbekannter Wert wurde uebernommen');
    assert.deepEqual(App.State.get('lehre'), []);
    assert.equal(App.State.get('weiterempfehlung'), null);
    assert.equal(App.State.get('einverstaendnis'), false);
  });

  test('buildSummary bildet jede Frage ausser der Zustimmung ab', function () {
    App.State.reset();
    var summary = App.State.buildSummary();
    var zeilen = summary.reduce(function (n, g) { return n + g.rows.length; }, 0);
    var erwartet = App.Schema.allQuestions().filter(function (q) { return q.type !== 'consent'; }).length;
    assert.equal(zeilen, erwartet);
  });

  /* ============================================================= Transport */
  test('toFormData uebertraegt alle Felder', function () {
    var form = App.Transport.toFormData({ gesamt: 'Sehr gut', lehre: 'A, B' });
    assert.equal(form.get('gesamt'), 'Sehr gut');
    assert.equal(form.get('lehre'), 'A, B');
  });

  test('Die konfigurierte Endpunkt-URL ist eine gueltige Apps-Script-URL', function () {
    assert.ok(App.Config.isConfigured, 'endpoint in assets/js/config.js pruefen');
  });

  test('Warteschlange nimmt Eintraege auf und gibt sie wieder frei', function () {
    App.Transport.queueClear();
    App.Transport.queueAdd({ id: 'q1', payload: { gesamt: 'Gut' }, createdAt: Date.now() });
    App.Transport.queueAdd({ id: 'q1', payload: { gesamt: 'Gut' }, createdAt: Date.now() });
    assert.equal(App.Transport.queueGet().length, 1, 'Duplikat wurde nicht erkannt');
    App.Transport.queueRemove('q1');
    assert.equal(App.Transport.queueGet().length, 0);
    App.Transport.queueClear();
  });

  /* ============================================================== Export */
  test('pdfSafe entfernt Emoji, behaelt Umlaute und Zeilenumbrueche', function () {
    var out = App.Export.pdfSafe('Grüezi 🤩\nÄpfel');
    assert.ok(out.indexOf('Grüezi') === 0, 'Umlaute verloren: ' + out);
    assert.ok(out.indexOf('🤩') === -1, 'Emoji nicht entfernt');
    assert.ok(out.indexOf('\n') > 0, 'Zeilenumbruch verloren');
  });

  /* ================================================================ i18n */
  test('Sprachumschaltung aendert die Anzeige, nicht die Werte', function () {
    App.State.reset();
    App.State.set('gesamt', 'Äusserst gut');

    App.I18n.setLocale('en', { persist: false });
    assert.equal(App.I18n.label(App.Schema.getQuestion('gesamt').options[0].label), 'Outstanding');
    assert.equal(App.State.buildPayload({}).gesamt, 'Äusserst gut', 'Wert darf sich nie uebersetzen');

    App.I18n.setLocale('de', { persist: false });
    assert.equal(App.I18n.label(App.Schema.getQuestion('gesamt').options[0].label), 'Äusserst gut');
  });

  test('Unbekannte Schluessel fallen auf Deutsch zurueck', function () {
    App.I18n.setLocale('en', { persist: false });
    assert.equal(App.I18n.t('gibt.es.nicht'), 'gibt.es.nicht');
    App.I18n.setLocale('de', { persist: false });
  });

  test('Alle deutschen Schluessel existieren auch auf Englisch', function () {
    var fehlend = Object.keys(App.I18n.dictionary.de).filter(function (key) {
      return App.I18n.dictionary.en[key] === undefined;
    });
    assert.deepEqual(fehlend, [], 'Fehlende englische Uebersetzungen');
  });

  /* ============================================================== Ausgabe */
  App.State.reset();
  App.State.clearDraft();

  var bestanden = results.filter(function (r) { return r.ok; }).length;
  var summary = { total: results.length, passed: bestanden, failed: results.length - bestanden, results: results };
  window.__TEST_RESULTS__ = summary;

  var root = document.getElementById('results');
  var head = document.getElementById('summary');
  head.textContent = bestanden + ' / ' + results.length + ' Tests bestanden';
  head.className = summary.failed ? 'summary summary--fail' : 'summary summary--ok';

  results.forEach(function (result) {
    var row = document.createElement('li');
    row.className = 'result ' + (result.ok ? 'result--ok' : 'result--fail');
    row.innerHTML = '<span class="result__badge">' + (result.ok ? 'PASS' : 'FAIL') + '</span>' +
      '<span class="result__name"></span>' +
      (result.ok ? '' : '<span class="result__msg"></span>');
    row.querySelector('.result__name').textContent = result.name;
    if (!result.ok) row.querySelector('.result__msg').textContent = result.message;
    root.appendChild(row);
  });
})();
