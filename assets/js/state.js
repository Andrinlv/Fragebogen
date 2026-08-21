/* =============================================================================
   state.js — Zustandsverwaltung, Entwurfsspeicher und Payload-Aufbau
   -----------------------------------------------------------------------------
   Haelt genau eine Wahrheit ueber die Antworten. Alle Views lesen von hier,
   alle Eingaben schreiben hierher.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;
  var Schema = App.Schema;
  var Validation = App.Validation;

  var answers = {};
  var meta = {
    sessionId: Core.uuid(),
    startedAt: Date.now(),
    lastChangeAt: null,
    submittedAt: null
  };

  /* ------------------------------------------------------- Initialisierung */
  function defaultValue(question) {
    switch (question.type) {
      case 'multi': return [];
      case 'scale': return null;
      case 'consent': return false;
      case 'text': return '';
      default: return null;
    }
  }

  function reset() {
    answers = {};
    Schema.allQuestions().forEach(function (q) { answers[q.id] = defaultValue(q); });
    meta.sessionId = Core.uuid();
    meta.startedAt = Date.now();
    meta.lastChangeAt = null;
    meta.submittedAt = null;
    Core.bus.emit('state:reset');
  }

  /* --------------------------------------------------------------- Zugriff */
  function get(id) { return answers[id]; }

  function getAll() {
    var copy = {};
    Object.keys(answers).forEach(function (key) {
      copy[key] = Array.isArray(answers[key]) ? answers[key].slice() : answers[key];
    });
    return copy;
  }

  function set(id, value) {
    var question = Schema.getQuestion(id);
    if (!question) return;
    answers[id] = value;
    meta.lastChangeAt = Date.now();
    Core.bus.emit('state:change', { id: id, value: value });
  }

  function toggleMulti(id, value, checked) {
    var question = Schema.getQuestion(id);
    if (!question) return [];
    var list = Array.isArray(answers[id]) ? answers[id].slice() : [];
    var option = (question.options || []).filter(function (o) { return o.value === value; })[0];

    if (checked) {
      if (option && option.exclusive) {
        list = [value];                                   /* schliesst alles andere aus */
      } else {
        var exclusives = (question.options || [])
          .filter(function (o) { return o.exclusive; })
          .map(function (o) { return o.value; });
        list = list.filter(function (v) { return exclusives.indexOf(v) < 0; });
        if (list.indexOf(value) < 0) list.push(value);
      }
    } else {
      list = list.filter(function (v) { return v !== value; });
    }

    /* Reihenfolge stabil halten: entlang der Schema-Definition sortieren */
    var order = (question.options || []).map(function (o) { return o.value; });
    list.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });

    set(id, list);
    return list;
  }

  /* -------------------------------------------------------------- Metriken */
  function isAnswered(id) {
    return Validation.isAnswered(Schema.getQuestion(id), answers[id]);
  }

  function progress() {
    var questions = Schema.allQuestions();
    if (!questions.length) return 0;
    var done = questions.filter(function (q) { return Validation.isAnswered(q, answers[q.id]); }).length;
    return Math.round((done / questions.length) * 100);
  }

  function durationSeconds() {
    var end = meta.submittedAt || Date.now();
    return Math.max(0, Math.round((end - meta.startedAt) / 1000));
  }

  /* -------------------------------------------------------- Anzeigewerte */
  /** Rohwert einer Frage als String fuer Zusammenfassung, PDF und Payload. */
  function valueToString(question, value) {
    if (!question) return '';
    switch (question.type) {
      case 'multi':
        return Array.isArray(value) && value.length ? value.join(', ') : '';
      case 'scale':
        return typeof value === 'number' && isFinite(value) ? String(value) : '';
      case 'consent':
        return value === true ? (question.trueValue || 'Ja') : '';
      case 'text':
        return Core.sanitizeText(value, question.maxLength);
      default:
        return value ? String(value) : '';
    }
  }

  /* ---------------------------------------------------------- Payload-Bau */
  /**
   * Baut das Objekt, das an Google Sheets uebermittelt wird.
   * Reihenfolge: erst die fuenf Kernfelder (unveraenderter Vertrag),
   * danach optionale Zusatzfelder, zuletzt technische Metadaten.
   */
  function buildPayload(options) {
    var opts = options || {};
    var payload = {};

    function put(question) {
      var raw = valueToString(question, answers[question.id]);
      /* Ersatzwerte stammen aus dem Schema und bleiben unangetastet – nur
         echte Nutzereingaben werden gegen Formel-Auswertung entschaerft.   */
      payload[question.id] = raw === ''
        ? (question.emptyValue || '-')
        : Core.neutralizeFormula(raw);
    }

    Schema.coreQuestions().forEach(put);

    if (Config.sendExtendedFields) {
      Schema.extendedQuestions().forEach(put);
    }

    if (Config.sendDiagnostics) {
      payload.vorgangsnummer = opts.submissionId || meta.sessionId;
      payload.zeitstempel = new Date().toISOString();
      payload.formularVersion = Config.formVersion;
      payload.sprache = App.I18n.getLocale();
      payload.dauerSekunden = String(durationSeconds());
    }

    return payload;
  }

  /** Strukturierte Zusammenfassung fuer Review-Ansicht und PDF-Export. */
  function buildSummary() {
    return Schema.steps
      .filter(function (step) { return step.kind !== 'review'; })
      .map(function (step) {
        return {
          stepId: step.id,
          title: step.title,
          rows: step.questions.map(function (question) {
            var value = answers[question.id];
            return {
              id: question.id,
              question: question,
              label: question.label,
              raw: value,
              text: valueToString(question, value),
              list: question.type === 'multi' && Array.isArray(value) ? value.slice() : null,
              answered: Validation.isAnswered(question, value)
            };
          })
        };
      });
  }

  /* ------------------------------------------------------- Entwurfsspeicher */
  function draftPayload() {
    return {
      version: Config.formVersion,
      schema: Config.schemaVersion,
      savedAt: Date.now(),
      startedAt: meta.startedAt,
      sessionId: meta.sessionId,
      answers: getAll()
    };
  }

  function saveDraft() {
    if (!hasAnyAnswer()) { clearDraft(); return false; }
    var ok = Core.storage.set(Config.storageKeys.draft, draftPayload());
    Core.bus.emit('draft:saved', ok);
    return ok;
  }

  function loadDraft() {
    var draft = Core.storage.get(Config.storageKeys.draft, null);
    if (!draft || !draft.answers) return null;
    var ageHours = (Date.now() - (draft.savedAt || 0)) / 36e5;
    if (ageHours > Config.draftTtlHours) {
      clearDraft();
      return null;
    }
    if (draft.version !== Config.formVersion) {
      /* Formularversion hat sich geaendert: nur bekannte Felder uebernehmen. */
      Core.log('warn', 'draft.version_mismatch stored=' + draft.version + ' current=' + Config.formVersion);
    }
    return draft;
  }

  function applyDraft(draft) {
    if (!draft || !draft.answers) return false;
    Schema.allQuestions().forEach(function (q) {
      var value = draft.answers[q.id];
      if (value === undefined || value === null) return;
      /* Typen defensiv pruefen – ein alter Entwurf darf die App nicht kippen. */
      if (q.type === 'multi') {
        answers[q.id] = Array.isArray(value)
          ? value.filter(function (v) {
              return (q.options || []).some(function (o) { return o.value === v; });
            })
          : [];
      } else if (q.type === 'scale') {
        answers[q.id] = typeof value === 'number' && isFinite(value) ? value : null;
      } else if (q.type === 'consent') {
        answers[q.id] = value === true;
      } else if (q.type === 'text') {
        answers[q.id] = Core.sanitizeText(value, q.maxLength);
      } else {
        answers[q.id] = (q.options || []).some(function (o) { return o.value === value; }) ? value : null;
      }
    });
    if (draft.startedAt) meta.startedAt = draft.startedAt;
    if (draft.sessionId) meta.sessionId = draft.sessionId;
    Core.bus.emit('draft:applied');
    return true;
  }

  function clearDraft() {
    Core.storage.remove(Config.storageKeys.draft);
    Core.bus.emit('draft:cleared');
  }

  function hasAnyAnswer() {
    return Schema.allQuestions().some(function (q) {
      return Validation.isAnswered(q, answers[q.id]);
    });
  }

  reset();

  App.State = {
    meta: meta,
    reset: reset,
    get: get,
    getAll: getAll,
    set: set,
    toggleMulti: toggleMulti,
    isAnswered: isAnswered,
    hasAnyAnswer: hasAnyAnswer,
    progress: progress,
    durationSeconds: durationSeconds,
    valueToString: valueToString,
    buildPayload: buildPayload,
    buildSummary: buildSummary,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    applyDraft: applyDraft,
    clearDraft: clearDraft,
    defaultValue: defaultValue
  };
})(window.BellFeedback);
