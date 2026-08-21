/* =============================================================================
   render.js — Erzeugt die Oberflaeche aus dem Schema
   -----------------------------------------------------------------------------
   Jede Frage wird generisch aus ihrer Definition gebaut. Neue Fragen brauchen
   deshalb keinen zusaetzlichen Rendering-Code.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var I18n = App.I18n;
  var State = App.State;
  var dom = Core.dom;
  var el = dom.el;

  /* ------------------------------------------------------------- Helfer */
  function fieldId(question) { return 'q-' + question.id; }
  function errorId(question) { return 'q-' + question.id + '-error'; }
  function helpId(question) { return 'q-' + question.id + '-help'; }

  function describedBy(question) {
    var ids = [];
    if (question.help) ids.push(helpId(question));
    ids.push(errorId(question));
    return ids.join(' ');
  }

  function headBlock(question, tagName, forId) {
    var head = el('div', { class: 'question__head' });

    var label = el(tagName || 'legend', { class: 'question__label' });
    if (forId) label.setAttribute('for', forId);
    label.appendChild(document.createTextNode(I18n.label(question.label)));

    if (question.required) {
      label.appendChild(el('span', { class: 'question__req', text: '*', 'aria-hidden': 'true' }));
    } else {
      label.appendChild(el('span', { class: 'question__optional', text: I18n.t('question.optional') }));
    }
    head.appendChild(label);

    if (question.help) {
      head.appendChild(el('p', { class: 'question__help', id: helpId(question), text: I18n.label(question.help) }));
    }
    return head;
  }

  function errorBlock(question) {
    return el('p', {
      class: 'question__error',
      id: errorId(question),
      role: 'alert',
      html: Core.icon('alert') + '<span></span>'
    });
  }

  function checkBadge(multi) {
    return el('span', { class: 'option__check' + (multi ? ' option__check--multi' : ''), html: Core.icon('check') });
  }

  /* ---------------------------------------------------- Einfachauswahl */
  function renderChoice(question, onChange) {
    var value = State.get(question.id);
    var isTiles = (question.layout || 'tiles').indexOf('tiles') >= 0;
    var wrap = el('fieldset', { 'aria-describedby': describedBy(question) });
    wrap.appendChild(headBlock(question, 'legend'));

    var list = el('div', {
      class: 'options ' + (isTiles ? 'options--tiles' : 'options--rows' +
        ((question.layout || '').indexOf('dense') >= 0 ? ' options--dense' : ''))
    });

    (question.options || []).forEach(function (option, index) {
      var input = el('input', {
        type: 'radio',
        class: 'option__input',
        name: 'q_' + question.id,
        id: fieldId(question) + '-' + index,
        value: option.value
      });
      input.checked = value === option.value;
      input.addEventListener('change', function () {
        if (input.checked) onChange(question, option.value);
      });

      var faceChildren = [];
      if (option.emoji) faceChildren.push(el('span', { class: 'option__emoji', 'aria-hidden': 'true', text: option.emoji }));
      if (option.icon) faceChildren.push(el('span', { class: 'option__icon', html: Core.icon(option.icon) }));
      faceChildren.push(el('span', { class: 'option__text' }, [
        el('span', { class: 'option__title', text: I18n.label(option.label) }),
        option.desc ? el('span', { class: 'option__desc', text: I18n.label(option.desc) }) : null
      ]));
      faceChildren.push(checkBadge(false));

      list.appendChild(el('label', { class: 'option' }, [
        input,
        el('span', { class: 'option__face' }, faceChildren)
      ]));
    });

    wrap.appendChild(list);
    return wrap;
  }

  /* ---------------------------------------------------- Mehrfachauswahl */
  function renderMulti(question, onChange) {
    var selected = State.get(question.id) || [];
    var wrap = el('fieldset', { 'aria-describedby': describedBy(question) });
    wrap.appendChild(headBlock(question, 'legend'));

    var list = el('div', {
      class: 'options options--rows' + ((question.layout || '').indexOf('dense') >= 0 ? ' options--dense' : '')
    });

    var inputs = [];

    (question.options || []).forEach(function (option, index) {
      var input = el('input', {
        type: 'checkbox',
        class: 'option__input',
        name: 'q_' + question.id,
        id: fieldId(question) + '-' + index,
        value: option.value
      });
      input.checked = selected.indexOf(option.value) >= 0;
      input.addEventListener('change', function () {
        var next = State.toggleMulti(question.id, option.value, input.checked);
        /* Exklusive Optionen koennen andere Haken entfernen: UI angleichen. */
        inputs.forEach(function (entry) {
          entry.input.checked = next.indexOf(entry.value) >= 0;
        });
        onChange(question, next, { silent: true });
      });
      inputs.push({ input: input, value: option.value });

      list.appendChild(el('label', { class: 'option option--multi' }, [
        input,
        el('span', { class: 'option__face' }, [
          option.icon ? el('span', { class: 'option__icon', html: Core.icon(option.icon) }) : null,
          el('span', { class: 'option__text' }, [
            el('span', { class: 'option__title', text: I18n.label(option.label) }),
            option.desc ? el('span', { class: 'option__desc', text: I18n.label(option.desc) }) : null
          ]),
          checkBadge(true)
        ])
      ]));
    });

    wrap.appendChild(list);
    return wrap;
  }

  /* --------------------------------------------------------------- Skala */
  function renderScale(question, onChange) {
    var value = State.get(question.id);
    var min = typeof question.min === 'number' ? question.min : 0;
    var max = typeof question.max === 'number' ? question.max : 10;

    var wrap = el('fieldset', { 'aria-describedby': describedBy(question) });
    wrap.appendChild(headBlock(question, 'legend'));

    var scale = el('div', { class: 'scale' });
    var row = el('div', { class: 'scale__row' });

    for (var i = min; i <= max; i++) {
      (function (num) {
        var band = num <= 6 ? 'low' : (num <= 8 ? 'mid' : 'high');
        var input = el('input', {
          type: 'radio',
          class: 'option__input',
          name: 'q_' + question.id,
          id: fieldId(question) + '-' + num,
          value: String(num),
          'aria-label': String(num)
        });
        input.checked = value === num;
        input.addEventListener('change', function () {
          if (input.checked) onChange(question, num);
        });

        row.appendChild(el('label', { class: 'scale__opt', dataset: { band: band } }, [
          input,
          el('span', { class: 'scale__face', text: String(num) })
        ]));
      })(i);
    }

    scale.appendChild(row);
    if (question.legend) {
      scale.appendChild(el('div', { class: 'scale__legend' }, [
        el('span', { text: I18n.label(question.legend.low) }),
        el('span', { text: I18n.label(question.legend.high) })
      ]));
    }

    wrap.appendChild(scale);
    return wrap;
  }

  /* ------------------------------------------------------------- Freitext */
  function renderText(question, onChange) {
    var value = State.get(question.id) || '';
    var id = fieldId(question);
    var wrap = el('div', {});
    wrap.appendChild(headBlock(question, 'label', id));

    var counter = el('span', { class: 'field__counter' });
    var area = el('textarea', {
      id: id,
      name: question.id,
      class: 'field__control',
      rows: '4',
      maxlength: question.maxLength ? String(question.maxLength) : null,
      placeholder: question.placeholder ? I18n.label(question.placeholder) : '',
      'aria-describedby': describedBy(question)
    });
    area.value = value;

    function updateCounter() {
      var length = area.value.length;
      var max = question.maxLength || 0;
      counter.textContent = max ? length + ' / ' + max : String(length);
      var ratio = max ? length / max : 0;
      counter.setAttribute('data-state', ratio >= 1 ? 'full' : (ratio > 0.9 ? 'warn' : 'ok'));
    }

    area.addEventListener('input', function () {
      updateCounter();
      onChange(question, area.value, { silent: true });
    });
    area.addEventListener('blur', function () { onChange(question, area.value); });
    updateCounter();

    var field = el('div', { class: 'field' }, [
      area,
      el('div', { class: 'field__foot' }, [
        el('span', { class: 'field__hint', text: '' }),
        counter
      ])
    ]);

    if (question.suggestions && question.suggestions.length) {
      var chips = el('div', { class: 'chips' });
      question.suggestions.forEach(function (suggestion) {
        var text = I18n.label(suggestion);
        chips.appendChild(el('button', {
          type: 'button',
          class: 'chip',
          text: text,
          on: {
            click: function () {
              var current = area.value.trim();
              if (current.toLowerCase().indexOf(text.toLowerCase()) >= 0) return;
              area.value = current ? current.replace(/[.\s]*$/, '') + '. ' + text : text;
              if (question.maxLength) area.value = area.value.slice(0, question.maxLength);
              updateCounter();
              onChange(question, area.value);
              area.focus();
            }
          }
        }));
      });
      field.appendChild(chips);
    }

    wrap.appendChild(field);
    return wrap;
  }

  /* ---------------------------------------------------------- Zustimmung */
  function renderConsent(question, onChange) {
    var value = State.get(question.id) === true;
    var input = el('input', {
      type: 'checkbox',
      class: 'option__input',
      id: fieldId(question),
      name: question.id,
      'aria-describedby': errorId(question)
    });
    input.checked = value;
    input.addEventListener('change', function () { onChange(question, input.checked); });

    return el('div', {}, [
      el('label', { class: 'consent' }, [
        input,
        el('span', { class: 'consent__box', html: Core.icon('check') }),
        el('span', { class: 'consent__text' }, [
          el('strong', { text: I18n.label(question.label) }),
          document.createTextNode(I18n.label(question.consentText))
        ])
      ])
    ]);
  }

  /* -------------------------------------------------------- Frage-Wrapper */
  function question(questionDef, index, onChange) {
    var body;
    switch (questionDef.type) {
      case 'multi':   body = renderMulti(questionDef, onChange); break;
      case 'scale':   body = renderScale(questionDef, onChange); break;
      case 'text':    body = renderText(questionDef, onChange); break;
      case 'consent': body = renderConsent(questionDef, onChange); break;
      default:        body = renderChoice(questionDef, onChange); break;
    }

    var section = el('section', {
      class: 'question',
      id: 'question-' + questionDef.id,
      dataset: {
        questionId: questionDef.id,
        answered: String(State.isAnswered(questionDef.id)),
        core: String(questionDef.core === true)
      }
    }, [
      questionDef.type === 'consent'
        ? el('span', { class: 'question__index', 'aria-hidden': 'true' })
        : el('span', { class: 'question__index', 'aria-hidden': 'true', text: Core.pad2(index) }),
      el('div', { class: 'question__content' }, [body, errorBlock(questionDef)])
    ]);

    return section;
  }

  /* ------------------------------------------------------- Fehleranzeige */
  function setError(sectionNode, message) {
    if (!sectionNode) return;
    var slot = dom.qs('.question__error span', sectionNode);
    if (slot) slot.textContent = message || '';
    sectionNode.setAttribute('data-invalid', message ? 'true' : 'false');
    dom.qsa('input, textarea', sectionNode).forEach(function (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  }

  function setAnswered(sectionNode, answered) {
    if (sectionNode) sectionNode.setAttribute('data-answered', String(!!answered));
  }

  /* ------------------------------------------------------ Zusammenfassung */
  function summary(groups, onEdit) {
    var wrap = el('div', { class: 'summary' });

    groups.forEach(function (group) {
      var rows = el('div', { class: 'summary__list' });

      group.rows.forEach(function (row) {
        var valueNode;
        if (row.list && row.list.length) {
          valueNode = el('span', { class: 'summary__val' }, [
            el('span', { class: 'summary__tags' }, row.list.map(function (value) {
              return el('span', { class: 'summary__tag', text: labelOfOption(row.question, value) });
            }))
          ]);
        } else if (row.answered) {
          var display = row.text;
          if (row.question.type === 'choice') display = labelOfOption(row.question, row.text);
          if (row.question.type === 'scale') display = row.text + ' / ' + (row.question.max || 10);
          valueNode = el('span', { class: 'summary__val', text: display });
        } else {
          valueNode = el('span', { class: 'summary__val', dataset: { empty: 'true' }, text: I18n.t('review.empty') });
        }

        rows.appendChild(el('div', { class: 'summary__row' }, [
          el('span', { class: 'summary__key', text: I18n.label(row.label) }),
          valueNode
        ]));
      });

      wrap.appendChild(el('section', { class: 'summary__group' }, [
        el('header', { class: 'summary__group-head' }, [
          el('h3', { class: 'summary__group-title', text: I18n.label(group.title) }),
          el('button', {
            type: 'button',
            class: 'btn btn--quiet summary__edit',
            html: Core.icon('pencil') + '<span>' + Core.escapeHtml(I18n.t('review.edit')) + '</span>',
            on: { click: function () { onEdit(group.stepId); } }
          })
        ]),
        rows
      ]));
    });

    return wrap;
  }

  function labelOfOption(questionDef, value) {
    var match = (questionDef.options || []).filter(function (o) { return o.value === value; })[0];
    return match ? I18n.label(match.label) : value;
  }

  /* ------------------------------------------------------ Payload-Vorschau */
  function payloadPreview(payload) {
    var pre = el('pre', { class: 'codeblock', tabindex: '0' });
    var keys = Object.keys(payload);

    pre.appendChild(el('span', { class: 'tok-punct', text: '{\n' }));
    keys.forEach(function (key, index) {
      pre.appendChild(document.createTextNode('  '));
      pre.appendChild(el('span', { class: 'tok-key', text: '"' + key + '"' }));
      pre.appendChild(el('span', { class: 'tok-punct', text: ': ' }));
      pre.appendChild(el('span', { class: 'tok-str', text: JSON.stringify(String(payload[key])) }));
      pre.appendChild(el('span', { class: 'tok-punct', text: (index < keys.length - 1 ? ',' : '') + '\n' }));
    });
    pre.appendChild(el('span', { class: 'tok-punct', text: '}' }));

    var body = el('div', { id: 'payload-body', hidden: true }, [pre]);
    var toggle = el('button', {
      type: 'button',
      class: 'payload__toggle',
      'aria-expanded': 'false',
      'aria-controls': 'payload-body',
      html: Core.icon('chevronRight') + '<span>' + Core.escapeHtml(I18n.t('review.payloadShow')) + '</span>'
    });

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
      dom.qs('span', toggle).textContent = I18n.t(open ? 'review.payloadShow' : 'review.payloadHide');
    });

    return el('div', { class: 'payload' }, [toggle, body]);
  }

  /* --------------------------------------------------------- Abschluss */
  function done(result, handlers) {
    var rows = [
      { key: I18n.t('done.ref'), value: result.reference, status: null },
      { key: I18n.t('done.time'), value: Core.formatDateTime(result.at, I18n.getLocale() === 'de' ? 'de-CH' : 'en-GB'), status: null },
      { key: I18n.t('done.duration'), value: result.durationSeconds + ' ' + I18n.t('time.seconds'), status: null },
      {
        key: I18n.t('done.status'),
        value: result.pending ? I18n.t('done.statusPending') : I18n.t('done.statusOk'),
        status: result.pending ? 'pending' : 'ok'
      }
    ];

    return el('div', { class: 'done' }, [
      el('div', { class: 'done__badge', html: Core.icon('checkCircle') }),
      el('h2', { class: 'done__title', text: I18n.t('done.title') }),
      el('p', { class: 'done__text', text: I18n.t('done.text') }),
      el('div', { class: 'done__receipt' }, rows.map(function (row) {
        return el('div', { class: 'done__receipt-row' }, [
          el('span', { class: 'done__receipt-key', text: row.key }),
          el('span', {
            class: 'done__receipt-val',
            dataset: row.status ? { status: row.status } : {},
            text: row.value
          })
        ]);
      })),
      el('div', { class: 'done__actions' }, [
        el('button', {
          type: 'button', class: 'btn btn--primary',
          html: Core.icon('download') + '<span class="btn__label">' + Core.escapeHtml(I18n.t('done.pdf')) + '</span>',
          on: { click: handlers.onPdf }
        }),
        el('button', {
          type: 'button', class: 'btn btn--secondary',
          html: Core.icon('printer') + '<span class="btn__label">' + Core.escapeHtml(I18n.t('done.print')) + '</span>',
          on: { click: handlers.onPrint }
        }),
        el('button', {
          type: 'button', class: 'btn btn--ghost',
          html: Core.icon('refresh') + '<span class="btn__label">' + Core.escapeHtml(I18n.t('done.again')) + '</span>',
          on: { click: handlers.onRestart }
        })
      ])
    ]);
  }

  App.Render = {
    question: question,
    setError: setError,
    setAnswered: setAnswered,
    summary: summary,
    payloadPreview: payloadPreview,
    done: done,
    labelOfOption: labelOfOption
  };
})(window.BellFeedback);
