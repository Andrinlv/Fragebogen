/* =============================================================================
   validation.js — Regelwerk (frei von DOM und Seiteneffekten)
   -----------------------------------------------------------------------------
   Bewusst als reine Funktionen gehalten: identisch nutzbar im Browser und in
   der Testsuite (tests/index.html).
============================================================================= */
(function (App) {
  'use strict';

  var I18n = App.I18n;

  /** Ist auf eine Frage ueberhaupt geantwortet worden? */
  function isAnswered(question, value) {
    if (!question) return false;
    switch (question.type) {
      case 'multi':
        return Array.isArray(value) && value.length > 0;
      case 'scale':
        return typeof value === 'number' && isFinite(value);
      case 'consent':
        return value === true;
      case 'text':
        return typeof value === 'string' && value.trim().length > 0;
      default:
        return typeof value === 'string' && value.length > 0;
    }
  }

  /**
   * Prueft eine einzelne Frage.
   * @returns {{valid: boolean, code?: string, params?: Object}}
   */
  function validate(question, value) {
    if (!question) return { valid: true };

    var answered = isAnswered(question, value);

    if (question.required && !answered) {
      return { valid: false, code: requiredCode(question) };
    }

    if (question.type === 'text' && typeof value === 'string') {
      var text = value.trim();
      if (question.maxLength && text.length > question.maxLength) {
        return { valid: false, code: 'maxLength', params: { max: question.maxLength } };
      }
      if (answered && question.minLength && text.length < question.minLength) {
        return { valid: false, code: 'minLength', params: { min: question.minLength } };
      }
    }

    if (question.type === 'scale' && answered) {
      var min = typeof question.min === 'number' ? question.min : 0;
      var max = typeof question.max === 'number' ? question.max : 10;
      if (value < min || value > max) {
        return { valid: false, code: 'requiredScale' };
      }
    }

    if (question.type === 'multi' && answered && question.maxSelect && value.length > question.maxSelect) {
      return { valid: false, code: 'maxSelect', params: { max: question.maxSelect } };
    }

    return { valid: true };
  }

  function requiredCode(question) {
    switch (question.type) {
      case 'multi': return 'requiredMulti';
      case 'scale': return 'requiredScale';
      case 'consent': return 'consent';
      case 'choice': return 'requiredChoice';
      default: return 'required';
    }
  }

  /** Prueft alle Fragen eines Schrittes und liefert die Fehlerliste. */
  function validateStep(step, answers) {
    var errors = [];
    (step && step.questions ? step.questions : []).forEach(function (question) {
      var result = validate(question, answers[question.id]);
      if (!result.valid) {
        errors.push({ id: question.id, code: result.code, params: result.params || {} });
      }
    });
    return errors;
  }

  /** Prueft den gesamten Fragebogen. */
  function validateAll(steps, answers) {
    return steps.reduce(function (acc, step) {
      return acc.concat(validateStep(step, answers));
    }, []);
  }

  /** Uebersetzt einen Fehlercode in eine anzeigbare Meldung. */
  function message(error) {
    if (!error) return '';
    return I18n.t('error.' + error.code, error.params);
  }

  App.Validation = {
    isAnswered: isAnswered,
    validate: validate,
    validateStep: validateStep,
    validateAll: validateAll,
    message: message
  };
})(window.BellFeedback);
