/* =============================================================================
   i18n.js — Mehrsprachigkeit (de-CH / en)
   -----------------------------------------------------------------------------
   Trennt strikt zwischen ANZEIGE (uebersetzt) und WERT (immer der kanonische
   deutsche String). Dadurch bleibt die Auswertung in Google Sheets stabil,
   egal in welcher Sprache das Formular ausgefuellt wurde.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;

  var DICT = {
    de: {
      'html.lang': 'de-CH',
      'app.title': 'IT-Schnuppermorgen',
      'app.subtitle': 'Feedback-Erhebung',

      'rail.sections': 'Abschnitte',
      'skip.link': 'Direkt zum Fragebogen springen',

      'status.online': 'Online',
      'status.offline': 'Offline',
      'status.autosaveIdle': 'Autosave bereit',
      'status.autosaveSaving': 'Speichert …',
      'status.autosaveSaved': 'Entwurf gesichert',
      'status.autosaveOff': 'Kein Speicher',

      'badge.required': 'Pflichtangaben',
      'badge.optional': 'Freiwillig',
      'badge.review': 'Prüfen & Senden',

      'question.optional': 'freiwillig',
      'question.multi': 'Mehrfachauswahl möglich',

      'nav.back': 'Zurück',
      'nav.next': 'Weiter',
      'nav.review': 'Antworten prüfen',
      'nav.submit': 'Feedback senden',
      'nav.sending': 'Wird gesendet …',
      'nav.retry': 'Erneut senden',

      'hint.step': 'Schritt',
      'hint.enter': 'Enter = weiter · Alle Angaben bleiben lokal gespeichert',
      'hint.review': 'Bitte kurz prüfen – danach wird übermittelt',
      'hint.autosaveOff': 'Lokales Speichern ist in diesem Browser deaktiviert',

      'error.summary': 'Bitte prüfe die markierten Angaben.',
      'error.required': 'Diese Angabe wird benötigt.',
      'error.requiredChoice': 'Bitte wähle eine Option aus.',
      'error.requiredMulti': 'Bitte wähle mindestens eine Option aus.',
      'error.requiredScale': 'Bitte wähle einen Wert von 0 bis 10.',
      'error.consent': 'Ohne diese Bestätigung können wir das Feedback nicht speichern.',
      'error.minLength': 'Bitte schreibe mindestens {min} Zeichen.',
      'error.maxLength': 'Maximal {max} Zeichen.',

      'draft.title': 'Gespeicherter Entwurf gefunden',
      'draft.text': 'Vom {time}. Möchtest du dort weitermachen?',
      'draft.restore': 'Weitermachen',
      'draft.discard': 'Neu beginnen',
      'draft.restored': 'Entwurf wiederhergestellt.',
      'draft.discarded': 'Entwurf verworfen.',

      'offline.title': 'Keine Internetverbindung',
      'offline.text': 'Du kannst den Fragebogen in Ruhe ausfüllen. Das Absenden ist möglich, sobald die Verbindung zurück ist.',

      'queue.title': 'Feedback wartet auf Übermittlung',
      'queue.text': 'Deine Antworten sind lokal gesichert und werden gesendet, sobald die Verbindung steht.',
      'queue.send': 'Jetzt senden',

      'submit.start': 'Übermittlung gestartet',
      'submit.ok': 'Feedback übermittelt',
      'submit.okText': 'Vielen Dank! Deine Antworten sind in der Auswertung angekommen.',
      'submit.failTitle': 'Übermittlung fehlgeschlagen',
      'submit.failText': 'Die Verbindung zur Auswertung war nicht möglich. Deine Antworten sind lokal gesichert – bitte versuche es erneut.',
      'submit.offlineTitle': 'Senden nicht möglich',
      'submit.offlineText': 'Es besteht aktuell keine Internetverbindung. Deine Antworten bleiben gespeichert.',
      'submit.notConfigured': 'Es ist keine gültige Apps-Script-URL konfiguriert.',

      'review.title': 'Deine Antworten',
      'review.edit': 'Bearbeiten',
      'review.empty': 'Keine Angabe',
      'review.payloadShow': 'Übermittelte Daten anzeigen',
      'review.payloadHide': 'Übermittelte Daten ausblenden',
      'review.consentTitle': 'Bestätigung',
      'review.consentText': 'Ich bestätige, dass meine Antworten anonym gespeichert und zur Verbesserung des IT-Schnuppermorgens ausgewertet werden dürfen.',

      'done.title': 'Feedback erfolgreich übermittelt',
      'done.text': 'Danke, dass du dir die Zeit genommen hast. Dein Input fliesst direkt in die Planung des nächsten IT-Schnuppermorgens ein.',
      'done.ref': 'Vorgangsnummer',
      'done.time': 'Zeitpunkt',
      'done.status': 'Status',
      'done.statusOk': 'Übermittelt',
      'done.statusPending': 'Wartet auf Verbindung',
      'done.duration': 'Bearbeitungsdauer',
      'done.pdf': 'Kopie als PDF',
      'done.print': 'Drucken',
      'done.again': 'Weiteres Feedback erfassen',

      'pdf.ready': 'PDF wurde erstellt.',
      'pdf.fallback': 'PDF-Bibliothek nicht verfügbar – der Druckdialog wird geöffnet.',
      'pdf.error': 'Das PDF konnte nicht erstellt werden. Nutze bitte "Drucken".',

      'console.title': 'System-Log',
      'console.empty': 'Noch keine Ereignisse.',

      'foot.legal': 'Bell Schweiz AG · Informatik · Interne Feedback-Erhebung',
      'foot.privacy': 'Anonyme Erfassung · keine personenbezogenen Daten',

      'toast.saved': 'Gespeichert',
      'toast.copyOk': 'In die Zwischenablage kopiert.',
      'unit.chars': 'Zeichen',
      'time.seconds': 'Sek.',
      'time.minutes': 'Min.'
    },

    en: {
      'html.lang': 'en',
      'app.title': 'IT Discovery Morning',
      'app.subtitle': 'Feedback survey',

      'rail.sections': 'Sections',
      'skip.link': 'Skip to the questionnaire',

      'status.online': 'Online',
      'status.offline': 'Offline',
      'status.autosaveIdle': 'Autosave ready',
      'status.autosaveSaving': 'Saving …',
      'status.autosaveSaved': 'Draft saved',
      'status.autosaveOff': 'No local storage',

      'badge.required': 'Required',
      'badge.optional': 'Optional',
      'badge.review': 'Review & submit',

      'question.optional': 'optional',
      'question.multi': 'Multiple answers possible',

      'nav.back': 'Back',
      'nav.next': 'Continue',
      'nav.review': 'Review answers',
      'nav.submit': 'Submit feedback',
      'nav.sending': 'Sending …',
      'nav.retry': 'Try again',

      'hint.step': 'Step',
      'hint.enter': 'Enter = continue · your answers stay on this device',
      'hint.review': 'Please review – then it will be submitted',
      'hint.autosaveOff': 'Local storage is disabled in this browser',

      'error.summary': 'Please check the highlighted answers.',
      'error.required': 'This answer is required.',
      'error.requiredChoice': 'Please select one option.',
      'error.requiredMulti': 'Please select at least one option.',
      'error.requiredScale': 'Please pick a value from 0 to 10.',
      'error.consent': 'Without this confirmation we cannot store your feedback.',
      'error.minLength': 'Please write at least {min} characters.',
      'error.maxLength': 'Maximum {max} characters.',

      'draft.title': 'Saved draft found',
      'draft.text': 'From {time}. Would you like to continue?',
      'draft.restore': 'Continue',
      'draft.discard': 'Start over',
      'draft.restored': 'Draft restored.',
      'draft.discarded': 'Draft discarded.',

      'offline.title': 'No internet connection',
      'offline.text': 'Feel free to fill in the questionnaire. Submitting works as soon as you are back online.',

      'queue.title': 'Feedback waiting to be sent',
      'queue.text': 'Your answers are stored locally and will be submitted once the connection is back.',
      'queue.send': 'Send now',

      'submit.start': 'Submission started',
      'submit.ok': 'Feedback submitted',
      'submit.okText': 'Thank you! Your answers reached the evaluation sheet.',
      'submit.failTitle': 'Submission failed',
      'submit.failText': 'We could not reach the evaluation service. Your answers are stored locally – please try again.',
      'submit.offlineTitle': 'Cannot submit',
      'submit.offlineText': 'There is currently no internet connection. Your answers stay saved.',
      'submit.notConfigured': 'No valid Apps Script URL is configured.',

      'review.title': 'Your answers',
      'review.edit': 'Edit',
      'review.empty': 'No answer',
      'review.payloadShow': 'Show submitted data',
      'review.payloadHide': 'Hide submitted data',
      'review.consentTitle': 'Confirmation',
      'review.consentText': 'I confirm that my answers may be stored anonymously and evaluated to improve the IT discovery morning.',

      'done.title': 'Feedback submitted successfully',
      'done.text': 'Thanks for taking the time. Your input goes straight into planning the next IT discovery morning.',
      'done.ref': 'Reference',
      'done.time': 'Timestamp',
      'done.status': 'Status',
      'done.statusOk': 'Submitted',
      'done.statusPending': 'Waiting for connection',
      'done.duration': 'Time spent',
      'done.pdf': 'PDF copy',
      'done.print': 'Print',
      'done.again': 'Submit another response',

      'pdf.ready': 'PDF created.',
      'pdf.fallback': 'PDF library unavailable – opening the print dialog instead.',
      'pdf.error': 'The PDF could not be created. Please use "Print".',

      'console.title': 'System log',
      'console.empty': 'No events yet.',

      'foot.legal': 'Bell Schweiz AG · IT · Internal feedback survey',
      'foot.privacy': 'Anonymous · no personal data collected',

      'toast.saved': 'Saved',
      'toast.copyOk': 'Copied to clipboard.',
      'unit.chars': 'characters',
      'time.seconds': 'sec',
      'time.minutes': 'min'
    }
  };

  var current = Config.defaultLocale;

  function normalise(locale) {
    if (!locale) return Config.defaultLocale;
    var short = String(locale).toLowerCase().slice(0, 2);
    return Config.availableLocales.indexOf(short) >= 0 ? short : Config.defaultLocale;
  }

  /** Uebersetzt einen Schluessel; unbekannte Schluessel fallen auf DE zurueck. */
  function t(key, params) {
    var table = DICT[current] || DICT[Config.defaultLocale];
    var value = table[key];
    if (value === undefined) value = DICT[Config.defaultLocale][key];
    if (value === undefined) return key;
    if (params) {
      Object.keys(params).forEach(function (name) {
        value = value.replace(new RegExp('\\{' + name + '\\}', 'g'), params[name]);
      });
    }
    return value;
  }

  /**
   * Loest ein mehrsprachiges Label auf ({de: '…', en: '…'} oder String).
   */
  function label(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return value[current] || value[Config.defaultLocale] || '';
  }

  function setLocale(locale, options) {
    var next = normalise(locale);
    var changed = next !== current;
    current = next;
    document.documentElement.setAttribute('lang', t('html.lang'));
    if (!options || options.persist !== false) Core.storage.setRaw(Config.storageKeys.locale, current);
    applyStatic();
    if (changed) Core.bus.emit('locale:changed', current);
    return current;
  }

  function getLocale() { return current; }

  /** Aktualisiert alle Elemente mit data-i18n im statischen Grundgeruest. */
  function applyStatic(root) {
    Core.dom.qsa('[data-i18n]', root || document).forEach(function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    Core.dom.qsa('[data-i18n-attr]', root || document).forEach(function (node) {
      /* Format: data-i18n-attr="aria-label:key,title:key" */
      node.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length === 2) node.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });
  }

  /** Startsprache: gespeicherte Wahl > (optional) Browsersprache > Standard. */
  function detect() {
    var stored = Core.storage.getRaw(Config.storageKeys.locale);
    if (stored && Config.availableLocales.indexOf(stored) >= 0) return stored;
    if (!Config.autoDetectLocale) return Config.defaultLocale;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language;
    return normalise(nav);
  }

  App.I18n = {
    t: t,
    label: label,
    setLocale: setLocale,
    getLocale: getLocale,
    applyStatic: applyStatic,
    detect: detect,
    dictionary: DICT
  };
})(window.BellFeedback);
