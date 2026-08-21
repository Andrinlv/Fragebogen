/* =============================================================================
   wizard.js — Ablaufsteuerung des Fragebogens
   -----------------------------------------------------------------------------
   Haelt Schritte, Validierung, Fortschritt, Entwurf und Übermittlung
   zusammen. Der einzige Ort, an dem der Ablauf definiert ist.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;
  var I18n = App.I18n;
  var Schema = App.Schema;
  var State = App.State;
  var Validation = App.Validation;
  var Render = App.Render;
  var Transport = App.Transport;
  var Export = App.Export;
  var UI = App.UI;
  var dom = Core.dom;
  var el = dom.el;

  var refs = {};
  var currentStep = 0;
  var direction = 'forward';
  var finished = false;
  var submitting = false;
  var lastReceipt = null;
  var questionNodes = {};

  /* ------------------------------------------------------------ Autosave */
  var scheduleAutosave = Core.debounce(function () {
    if (finished) return;
    if (!Core.storage.available) { UI.setAutosave('off'); return; }
    UI.setAutosave('saving');
    var ok = State.saveDraft();
    UI.setAutosave(ok ? 'saved' : 'off');
  }, Config.autosaveDebounceMs);

  /* -------------------------------------------------------------- Stepper */
  function buildStepper() {
    var list = refs.stepper;
    if (!list) return;
    dom.clear(list);

    Schema.steps.forEach(function (step, index) {
      var button = el('button', {
        type: 'button',
        class: 'stepper__btn',
        dataset: { stepIndex: String(index) },
        on: { click: function () { goTo(index); } }
      }, [
        el('span', { class: 'stepper__node' }, [
          el('span', { text: Core.pad2(index + 1) }),
          Core.iconNode('check')
        ]),
        el('span', {}, [
          el('span', { class: 'stepper__label', text: I18n.label(step.title) }),
          el('span', { class: 'stepper__hint', text: I18n.t('hint.step') + ' ' + Core.pad2(index + 1) })
        ])
      ]);

      list.appendChild(el('li', { class: 'stepper__item', dataset: { state: 'todo' } }, [button]));
    });

    updateStepper();
  }

  function stepState(step, index) {
    if (finished) return 'done';
    if (index === currentStep) return 'current';
    var answers = State.getAll();
    var complete = Validation.validateStep(step, answers).length === 0;
    var touched = (step.questions || []).some(function (q) { return Validation.isAnswered(q, answers[q.id]); });
    return complete && touched ? 'done' : 'todo';
  }

  function updateStepper() {
    if (!refs.stepper) return;
    dom.qsa('.stepper__item', refs.stepper).forEach(function (item, index) {
      var state = stepState(Schema.steps[index], index);
      item.setAttribute('data-state', state);
      var button = dom.qs('.stepper__btn', item);
      if (button) {
        button.setAttribute('aria-current', index === currentStep && !finished ? 'step' : 'false');
        button.disabled = finished;
      }
    });
  }

  function updateProgress() {
    var value = finished ? 100 : State.progress();
    if (refs.progressFill) refs.progressFill.style.width = value + '%';
    if (refs.progressValue) refs.progressValue.textContent = value + ' %';
    if (refs.progressBar) refs.progressBar.setAttribute('aria-valuenow', String(value));
  }

  /* ------------------------------------------------------- Schritt-Render */
  function questionOffset(stepIndex) {
    var offset = 0;
    for (var i = 0; i < stepIndex; i++) offset += (Schema.steps[i].questions || []).length;
    return offset;
  }

  function onAnswerChange(question, value, options) {
    if (question.type !== 'multi') State.set(question.id, value);

    var node = questionNodes[question.id];
    if (node) {
      Render.setAnswered(node, Validation.isAnswered(question, State.get(question.id)));
      var result = Validation.validate(question, State.get(question.id));
      if (result.valid) Render.setError(node, '');
    }

    updateProgress();
    updateStepper();
    scheduleAutosave();

    if (!options || !options.silent) {
      Core.bus.emit('answer:committed', { id: question.id });
    }
  }

  function renderStep() {
    var step = Schema.steps[currentStep];
    if (!step) return;

    questionNodes = {};

    refs.stepIndex.textContent = Core.pad2(currentStep + 1) + ' / ' + Core.pad2(Schema.steps.length);
    refs.stepTitle.textContent = I18n.label(step.title);
    refs.stepLead.textContent = I18n.label(step.lead);

    var hasRequired = (step.questions || []).some(function (q) { return q.required; });
    refs.stepBadge.className = 'pill ' + (step.kind === 'review' ? 'pill--live' : hasRequired ? 'pill--accent' : 'pill--muted');
    refs.stepBadge.textContent = I18n.t(step.kind === 'review' ? 'badge.review' : hasRequired ? 'badge.required' : 'badge.optional');

    var body = dom.clear(refs.stepBody);
    var view = el('div', { class: 'step-view', dataset: { direction: direction } });

    if (step.kind === 'review') {
      view.appendChild(el('h2', { class: 'eyebrow', text: I18n.t('review.title'), style: 'margin-bottom:.75rem' }));
      view.appendChild(Render.summary(State.buildSummary(), function (stepId) {
        goTo(Schema.steps.map(function (s) { return s.id; }).indexOf(stepId));
      }));
      view.appendChild(Render.payloadPreview(State.buildPayload({ submissionId: State.meta.sessionId })));
      view.appendChild(el('hr', { class: 'divider' }));
    }

    var offset = questionOffset(currentStep);
    var container = el('div', { class: 'questions' });
    (step.questions || []).forEach(function (question, index) {
      var node = Render.question(question, offset + index + 1, onAnswerChange);
      questionNodes[question.id] = node;
      container.appendChild(node);
    });
    view.appendChild(container);

    body.appendChild(view);

    /* Fussleiste */
    refs.btnBack.disabled = currentStep === 0;
    refs.btnBack.innerHTML = Core.icon('arrowLeft') + '<span class="btn__label">' + Core.escapeHtml(I18n.t('nav.back')) + '</span>';

    var isReview = step.kind === 'review';
    var nextsLast = currentStep === Schema.steps.length - 2;
    var nextLabel = isReview ? I18n.t('nav.submit') : (nextsLast ? I18n.t('nav.review') : I18n.t('nav.next'));
    var nextIcon = isReview ? 'send' : 'arrowRight';
    refs.btnNext.innerHTML = '<span class="btn__label">' + Core.escapeHtml(nextLabel) + '</span>' + Core.icon(nextIcon);
    refs.btnNext.disabled = false;
    refs.btnNext.removeAttribute('data-loading');

    refs.footHint.textContent = isReview ? I18n.t('hint.review')
      : (Core.storage.available ? I18n.t('hint.enter') : I18n.t('hint.autosaveOff'));

    updateProgress();
    updateStepper();
  }

  /* ------------------------------------------------------------ Navigation */
  function showErrors(errors) {
    Object.keys(questionNodes).forEach(function (id) { Render.setError(questionNodes[id], ''); });

    errors.forEach(function (error) {
      Render.setError(questionNodes[error.id], Validation.message(error));
    });

    if (errors.length) {
      var first = questionNodes[errors[0].id];
      if (first) {
        var focusable = dom.qs('input, textarea, button', first);
        first.scrollIntoView({ behavior: Config.scrollBehaviour, block: 'center' });
        if (focusable) focusable.focus({ preventScroll: true });
      }
      UI.toast({ type: 'error', title: I18n.t('error.summary'), text: Validation.message(errors[0]) });
      Core.log('warn', 'validation.failed step=' + Schema.steps[currentStep].id + ' fields=' + errors.map(function (e) { return e.id; }).join(','));
    }
    return errors.length === 0;
  }

  function validateCurrent() {
    return showErrors(Validation.validateStep(Schema.steps[currentStep], State.getAll()));
  }

  function goTo(index, options) {
    if (finished) return;
    if (index < 0 || index >= Schema.steps.length || index === currentStep) return;

    if (index > currentStep && (!options || options.validate !== false)) {
      /* Vorwaerts nur mit gueltigen dazwischenliegenden Schritten. */
      for (var i = currentStep; i < index; i++) {
        var errors = Validation.validateStep(Schema.steps[i], State.getAll());
        if (errors.length) {
          if (i !== currentStep) {
            currentStep = i;
            direction = 'forward';
            renderStep();
          }
          showErrors(errors);
          return;
        }
      }
    }

    direction = index > currentStep ? 'forward' : 'back';
    currentStep = index;
    renderStep();
    focusStep();
    Core.log('info', 'step.enter ' + Schema.steps[currentStep].id);
  }

  function focusStep() {
    if (refs.panel) refs.panel.scrollIntoView({ behavior: Config.scrollBehaviour, block: 'start' });
    if (refs.stepBody) refs.stepBody.focus({ preventScroll: true });
  }

  function next() {
    if (!validateCurrent()) return;
    if (Schema.steps[currentStep].kind === 'review') { submit(); return; }
    goTo(currentStep + 1, { validate: false });
  }

  function back() { goTo(currentStep - 1); }

  /* ------------------------------------------------------------ Übermittlung */
  function setSubmitting(active) {
    submitting = active;
    refs.btnNext.setAttribute('data-loading', String(active));
    refs.btnNext.disabled = active;
    refs.btnBack.disabled = active || currentStep === 0;
    if (active) {
      refs.btnNext.innerHTML = '<span class="btn__spinner"></span><span class="btn__label">' +
        Core.escapeHtml(I18n.t('nav.sending')) + '</span>';
    }
  }

  function submit() {
    if (submitting) return;

    var allErrors = Validation.validateAll(Schema.steps, State.getAll());
    if (allErrors.length) {
      var targetStep = Schema.getStepIndex(allErrors[0].id);
      if (targetStep >= 0 && targetStep !== currentStep) {
        currentStep = targetStep;
        direction = 'back';
        renderStep();
      }
      showErrors(allErrors.filter(function (error) {
        return Schema.getStepIndex(error.id) === currentStep;
      }));
      return;
    }

    var submissionId = State.meta.sessionId;
    var payload = State.buildPayload({ submissionId: submissionId });
    var receipt = {
      reference: Core.submissionRef(submissionId),
      at: new Date(),
      durationSeconds: State.durationSeconds(),
      pending: false
    };

    setSubmitting(true);
    UI.clearBanners();
    Core.log('info', 'submit.start ref=' + receipt.reference);

    Transport.submit(payload)
      .then(function () {
        finish(receipt);
      })
      .catch(function (error) {
        setSubmitting(false);
        renderStep();

        if (error.code === 'offline') {
          Transport.queueAdd({ id: submissionId, payload: payload, createdAt: Date.now() });
          receipt.pending = true;
          finish(receipt);
          UI.banner({
            id: 'queue',
            type: 'warn',
            title: I18n.t('queue.title'),
            text: I18n.t('queue.text'),
            dismissible: false
          });
          return;
        }

        /* Online, aber fehlgeschlagen: bewusst NICHT automatisch erneut senden.
           Ein zweiter Versuch koennte einen Doppeleintrag erzeugen, falls der
           erste die Tabelle bereits erreicht hat. Der Mensch entscheidet.    */
        UI.banner({
          id: 'submit-error',
          type: 'error',
          title: I18n.t('submit.failTitle'),
          text: I18n.t('submit.failText') + ' (' + error.code + ')',
          actions: [{ label: I18n.t('nav.retry'), variant: 'primary', onClick: submit }]
        });
        UI.toast({ type: 'error', title: I18n.t('submit.failTitle'), text: error.message });
      });
  }

  function finish(receipt) {
    finished = true;
    submitting = false;
    lastReceipt = receipt;
    State.meta.submittedAt = Date.now();
    State.clearDraft();
    UI.setAutosave('idle');

    var groups = State.buildSummary();

    refs.panel.setAttribute('data-state', 'done');
    refs.stepIndex.textContent = Core.pad2(Schema.steps.length) + ' / ' + Core.pad2(Schema.steps.length);
    refs.stepBadge.className = 'pill pill--live';
    refs.stepBadge.textContent = I18n.t(receipt.pending ? 'done.statusPending' : 'done.statusOk');
    refs.stepTitle.textContent = I18n.t('app.title');
    refs.stepLead.textContent = I18n.t('app.subtitle');
    refs.panelFoot.classList.add('is-hidden');

    var body = dom.clear(refs.stepBody);
    body.appendChild(Render.done(receipt, {
      onPdf: function () { downloadPdf(groups, receipt); },
      onPrint: function () { Export.print(); },
      onRestart: restart
    }));
    body.appendChild(Export.buildPrintDocument(groups, receipt));

    updateProgress();
    updateStepper();
    focusStep();

    Core.log(receipt.pending ? 'warn' : 'ok',
      'submit.' + (receipt.pending ? 'queued' : 'complete') + ' ref=' + receipt.reference);

    if (!receipt.pending) {
      UI.toast({ type: 'success', title: I18n.t('submit.ok'), text: I18n.t('submit.okText') });
    }
  }

  function downloadPdf(groups, receipt) {
    var result = Export.downloadPdf(groups, receipt);
    if (result.ok) {
      UI.toast({ type: 'success', title: I18n.t('done.pdf'), text: I18n.t('pdf.ready') });
    } else if (result.reason === 'unavailable') {
      UI.toast({ type: 'info', title: I18n.t('done.pdf'), text: I18n.t('pdf.fallback') });
      Export.print();
    } else {
      UI.toast({ type: 'error', title: I18n.t('done.pdf'), text: I18n.t('pdf.error') });
    }
  }

  function restart() {
    finished = false;
    submitting = false;
    lastReceipt = null;
    currentStep = 0;
    direction = 'forward';
    State.reset();
    UI.clearBanners();
    refs.panel.removeAttribute('data-state');
    refs.panelFoot.classList.remove('is-hidden');
    renderStep();
    focusStep();
    Core.log('info', 'form.restarted');
  }

  /* ---------------------------------------------------------- Entwuerfe */
  function offerDraftRestore() {
    var draft = State.loadDraft();
    if (!draft) return;

    UI.banner({
      id: 'draft',
      type: 'info',
      title: I18n.t('draft.title'),
      text: I18n.t('draft.text', { time: Core.formatDateTime(new Date(draft.savedAt), 'de-CH') }),
      dismissible: false,
      actions: [
        {
          label: I18n.t('draft.restore'),
          variant: 'primary',
          onClick: function () {
            State.applyDraft(draft);
            renderStep();
            UI.toast({ type: 'success', title: I18n.t('draft.restored') });
            Core.log('ok', 'draft.restored age=' + Math.round((Date.now() - draft.savedAt) / 1000) + 's');
          }
        },
        {
          label: I18n.t('draft.discard'),
          onClick: function () {
            State.clearDraft();
            UI.toast({ type: 'info', title: I18n.t('draft.discarded') });
            Core.log('info', 'draft.discarded');
          }
        }
      ]
    });
  }

  /* -------------------------------------------------------- Warteschlange */
  function flushQueueIfAny() {
    if (!Transport.queueGet().length) return;
    Transport.flushQueue().then(function (result) {
      if (result.sent > 0) {
        UI.removeBanner('queue');
        UI.toast({ type: 'success', title: I18n.t('submit.ok'), text: I18n.t('submit.okText') });
        if (finished && lastReceipt && lastReceipt.pending) {
          lastReceipt.pending = false;
          finish(lastReceipt);
        }
      }
    });
  }

  /* ---------------------------------------------------------- Tastatur */
  function initKeyboard() {
    document.addEventListener('keydown', function (event) {
      if (finished) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        next();
        return;
      }
      if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); next(); }
      if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); back(); }
    });
  }

  /* --------------------------------------------------------------- Init */
  function init() {
    refs = {
      panel: dom.byId('panel'),
      panelFoot: dom.byId('panel-foot'),
      stepper: dom.byId('stepper'),
      stepIndex: dom.byId('step-index'),
      stepTitle: dom.byId('step-title'),
      stepLead: dom.byId('step-lead'),
      stepBadge: dom.byId('step-badge'),
      stepBody: dom.byId('step-body'),
      form: dom.byId('feedback-form'),
      btnBack: dom.byId('btn-back'),
      btnNext: dom.byId('btn-next'),
      footHint: dom.byId('foot-hint'),
      progressFill: dom.byId('progress-fill'),
      progressValue: dom.byId('progress-value'),
      progressBar: dom.byId('progress-bar')
    };

    refs.form.addEventListener('submit', function (event) {
      event.preventDefault();
      next();
    });
    refs.btnBack.addEventListener('click', back);

    buildStepper();
    renderStep();
    initKeyboard();

    Core.bus.on('locale:changed', function () {
      buildStepper();
      renderStep();
    });
    Core.bus.on('network:online', flushQueueIfAny);

    window.addEventListener('beforeunload', function (event) {
      if (finished || submitting) return;
      if (!State.hasAnyAnswer()) return;
      if (Core.storage.available) return;   /* Entwurf ist gesichert – kein Hinweis noetig */
      event.preventDefault();
      event.returnValue = '';
    });

    flushQueueIfAny();
  }

  App.Wizard = {
    init: init,
    goTo: goTo,
    next: next,
    back: back,
    submit: submit,
    restart: restart,
    offerDraftRestore: offerDraftRestore,
    getCurrentStep: function () { return currentStep; },
    isFinished: function () { return finished; }
  };
})(window.BellFeedback);
