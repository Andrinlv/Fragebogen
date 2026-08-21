/* =============================================================================
   schema.js — Deklarative Definition des Fragebogens
   -----------------------------------------------------------------------------
   Der gesamte Fragebogen wird hier beschrieben; Rendering, Validierung,
   Zusammenfassung, PDF-Export und Payload leiten sich automatisch daraus ab.
   Eine neue Frage benoetigt daher nur einen Eintrag in diesem File.

   VERTRAG MIT GOOGLE SHEETS
   -------------------------
   Fragen mit `core: true` bilden den unveraenderten Datenvertrag ab, der
   bereits vor diesem Refactoring bestand:

       gesamt · workshops · lehre · highlight · verbesserung

   Ihre `id` ist gleichzeitig der Feldname im POST und ihre Optionswerte sind
   exakt die bisherigen Strings. Sie duerfen NICHT umbenannt werden, sonst
   brechen bestehende Auswertungen in der Tabelle.

   Feldtypen
   ---------
   choice   Einfachauswahl (Radiogroup)
   multi    Mehrfachauswahl (Checkboxen) – Uebermittlung als "A, B, C"
   scale    Numerische Skala 0–10 (NPS-Logik)
   text     Mehrzeiliges Freitextfeld
   consent  Bestaetigungs-Checkbox
============================================================================= */
(function (App) {
  'use strict';

  var STEPS = [
    /* ------------------------------------------------------------ Schritt 1 */
    {
      id: 'eindruck',
      icon: 'sparkles',
      title: { de: 'Dein Eindruck', en: 'Your impression' },
      lead: {
        de: 'Wie hast du den Morgen bei uns in der Informatik erlebt? Es gibt kein Richtig oder Falsch.',
        en: 'How did you experience the morning with our IT team? There is no right or wrong.'
      },
      questions: [
        {
          id: 'gesamt',
          core: true,
          type: 'choice',
          required: true,
          layout: 'tiles',
          emptyValue: '-',
          label: {
            de: 'Wie bewertest du den IT-Schnuppermorgen insgesamt?',
            en: 'How do you rate the IT discovery morning overall?'
          },
          options: [
            { value: 'Äusserst gut', emoji: '🤩', label: { de: 'Äusserst gut', en: 'Outstanding' } },
            { value: 'Sehr gut', emoji: '😃', label: { de: 'Sehr gut', en: 'Very good' } },
            { value: 'Einigermassen gut', emoji: '🙂', label: { de: 'Geht so', en: 'Okay' } },
            { value: 'Eher nicht gut', emoji: '😕', label: { de: 'Eher nicht', en: 'Not really' } }
          ]
        },
        {
          id: 'workshops',
          core: true,
          type: 'choice',
          required: true,
          layout: 'tiles',
          emptyValue: '-',
          label: {
            de: 'Wie haben dir die Workshops gefallen?',
            en: 'How did you like the workshops?'
          },
          help: {
            de: 'Gemeint sind die praktischen Stationen, an denen du selbst etwas ausprobiert hast.',
            en: 'This refers to the hands-on stations where you tried things out yourself.'
          },
          options: [
            { value: 'Top', emoji: '🚀', label: { de: 'Sehr gut', en: 'Very good' } },
            { value: 'Gut', emoji: '👍', label: { de: 'Gut', en: 'Good' } },
            { value: 'Okay', emoji: '😐', label: { de: 'Okay', en: 'Okay' } },
            { value: 'Nicht so', emoji: '👎', label: { de: 'Nicht so', en: 'Not great' } }
          ]
        },
        {
          id: 'betreuung',
          type: 'choice',
          required: true,
          layout: 'tiles',
          emptyValue: '-',
          label: {
            de: 'Wie gut hat dich unser Team betreut?',
            en: 'How well did our team support you?'
          },
          help: {
            de: 'Lernende, Fachkräfte und alle, die dich durch den Morgen begleitet haben.',
            en: 'Apprentices, specialists and everyone who guided you through the morning.'
          },
          options: [
            { value: 'Sehr gut', emoji: '🤝', label: { de: 'Sehr gut', en: 'Very good' } },
            { value: 'Gut', emoji: '👍', label: { de: 'Gut', en: 'Good' } },
            { value: 'Okay', emoji: '😐', label: { de: 'Okay', en: 'Okay' } },
            { value: 'Nicht so gut', emoji: '😕', label: { de: 'Nicht so gut', en: 'Not so good' } }
          ]
        }
      ]
    },

    /* ------------------------------------------------------------ Schritt 2 */
    {
      id: 'informatik',
      icon: 'cpu',
      title: { de: 'Informatik & Lehre', en: 'IT & apprenticeship' },
      lead: {
        de: 'Damit wir die nächsten Schnuppertage passgenau auf deine Interessen ausrichten können.',
        en: 'So we can tailor the next discovery days to what actually interests you.'
      },
      questions: [
        {
          id: 'lehre',
          core: true,
          type: 'multi',
          required: true,
          layout: 'rows',
          emptyValue: 'Keine Angabe',
          label: {
            de: 'Welche Lehre kannst du dir vorstellen?',
            en: 'Which apprenticeship could you imagine?'
          },
          help: { de: 'Mehrfachauswahl möglich.', en: 'Multiple answers possible.' },
          options: [
            {
              value: 'Plattformentwicklung', icon: 'server',
              label: { de: 'Informatiker/in EFZ – Plattformentwicklung', en: 'IT specialist – platform development' },
              desc: { de: 'Server, Netzwerke, Systeme und Automatisierung', en: 'Servers, networks, systems and automation' }
            },
            {
              value: 'Applikationsentwicklung', icon: 'code',
              label: { de: 'Informatiker/in EFZ – Applikationsentwicklung', en: 'IT specialist – application development' },
              desc: { de: 'Software entwerfen, programmieren und testen', en: 'Designing, coding and testing software' }
            },
            {
              value: 'ICT-Fachmann/-frau', icon: 'headset',
              label: { de: 'ICT-Fachmann/-frau EFZ', en: 'ICT specialist' },
              desc: { de: 'Support, Geräte, Benutzerbetreuung und Betrieb', en: 'Support, devices, user care and operations' }
            },
            {
              value: 'Noch unentschieden', icon: 'helpCircle', exclusive: true,
              label: { de: 'Noch unentschieden', en: 'Not decided yet' },
              desc: { de: 'Ich schaue mir zuerst noch mehr an', en: 'I want to explore more first' }
            }
          ]
        },
        {
          id: 'interessen',
          type: 'multi',
          required: false,
          layout: 'rows dense',
          emptyValue: 'Keine Angabe',
          label: {
            de: 'Welche IT-Themen interessieren dich am meisten?',
            en: 'Which IT topics interest you most?'
          },
          help: { de: 'Mehrfachauswahl möglich.', en: 'Multiple answers possible.' },
          options: [
            { value: 'Programmieren', icon: 'code', label: { de: 'Programmieren', en: 'Programming' } },
            { value: 'Netzwerk & Infrastruktur', icon: 'network', label: { de: 'Netzwerk & Infrastruktur', en: 'Network & infrastructure' } },
            { value: 'Cybersecurity', icon: 'shield', label: { de: 'Cybersecurity', en: 'Cybersecurity' } },
            { value: 'Daten & KI', icon: 'brain', label: { de: 'Daten & KI', en: 'Data & AI' } },
            { value: 'Support & Hardware', icon: 'headset', label: { de: 'Support & Hardware', en: 'Support & hardware' } },
            { value: 'Cloud & Betrieb', icon: 'cloud', label: { de: 'Cloud & Betrieb', en: 'Cloud & operations' } }
          ]
        },
        {
          id: 'vorkenntnisse',
          type: 'choice',
          required: false,
          layout: 'rows dense',
          emptyValue: '-',
          label: {
            de: 'Wie viel IT-Erfahrung bringst du mit?',
            en: 'How much IT experience do you bring along?'
          },
          options: [
            { value: 'Keine', icon: 'helpCircle', label: { de: 'Noch keine', en: 'None yet' } },
            { value: 'Grundlagen', icon: 'monitor', label: { de: 'Grundlagen', en: 'Basics' } },
            { value: 'Fortgeschritten', icon: 'gitBranch', label: { de: 'Fortgeschritten', en: 'Advanced' } },
            { value: 'Ich programmiere selbst', icon: 'terminal', label: { de: 'Ich programmiere selbst', en: 'I code myself' } }
          ]
        }
      ]
    },

    /* ------------------------------------------------------------ Schritt 3 */
    {
      id: 'feedback',
      icon: 'pencil',
      title: { de: 'Dein Feedback', en: 'Your feedback' },
      lead: {
        de: 'Deine Worte helfen uns am meisten – ehrlich und direkt ist genau richtig.',
        en: 'Your own words help us most – honest and direct is exactly right.'
      },
      questions: [
        {
          id: 'highlight',
          core: true,
          type: 'text',
          required: false,
          maxLength: 600,
          minLength: 0,
          emptyValue: '-',
          label: { de: 'Was hat dir am meisten gefallen?', en: 'What did you like most?' },
          placeholder: { de: 'Zum Beispiel: der Workshop, das Team, ein Projekt …', en: 'For example: the workshop, the team, a project …' },
          suggestions: [
            { de: 'Die Workshops', en: 'The workshops' },
            { de: 'Das Team', en: 'The team' },
            { de: 'Einblick in echte Projekte', en: 'Insight into real projects' },
            { de: 'Selbst programmieren', en: 'Coding myself' }
          ]
        },
        {
          id: 'verbesserung',
          core: true,
          type: 'text',
          required: false,
          maxLength: 600,
          minLength: 0,
          emptyValue: '-',
          label: { de: 'Was können wir besser machen?', en: 'What could we do better?' },
          placeholder: { de: 'Ideen, Kritik, Wünsche – alles willkommen.', en: 'Ideas, criticism, wishes – all welcome.' },
          suggestions: [
            { de: 'Mehr Zeit pro Station', en: 'More time per station' },
            { de: 'Mehr selber ausprobieren', en: 'More hands-on time' },
            { de: 'Mehr Infos zur Lehre', en: 'More info about the apprenticeship' }
          ]
        },
        {
          id: 'weiterempfehlung',
          type: 'scale',
          required: true,
          min: 0,
          max: 10,
          emptyValue: '-',
          label: {
            de: 'Wie wahrscheinlich empfiehlst du den IT-Schnuppermorgen weiter?',
            en: 'How likely are you to recommend the IT discovery morning?'
          },
          help: {
            de: '0 = überhaupt nicht wahrscheinlich, 10 = sehr wahrscheinlich.',
            en: '0 = not at all likely, 10 = extremely likely.'
          },
          legend: {
            low: { de: '0 · gar nicht', en: '0 · not at all' },
            high: { de: 'sehr gerne · 10', en: 'absolutely · 10' }
          }
        }
      ]
    },

    /* ------------------------------------------------------------ Schritt 4 */
    {
      id: 'pruefen',
      kind: 'review',
      icon: 'clipboard',
      title: { de: 'Prüfen & Senden', en: 'Review & submit' },
      lead: {
        de: 'Kurz kontrollieren – danach geht dein Feedback direkt in die Auswertung.',
        en: 'A quick check – then your feedback goes straight into the evaluation.'
      },
      questions: [
        {
          id: 'einverstaendnis',
          type: 'consent',
          required: true,
          trueValue: 'Ja',
          emptyValue: 'Nein',
          label: { de: 'Bestätigung', en: 'Confirmation' },
          consentText: {
            de: 'Ich bestätige, dass meine Antworten anonym gespeichert und zur Verbesserung des IT-Schnuppermorgens ausgewertet werden dürfen.',
            en: 'I confirm that my answers may be stored anonymously and evaluated to improve the IT discovery morning.'
          }
        }
      ]
    }
  ];

  /* ---------------------------------------------------------------- Zugriff */
  function allQuestions() {
    return STEPS.reduce(function (acc, step) { return acc.concat(step.questions || []); }, []);
  }

  function getQuestion(id) {
    var found = null;
    allQuestions().forEach(function (q) { if (q.id === id) found = q; });
    return found;
  }

  function getStep(id) {
    var found = null;
    STEPS.forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }

  function stepIndexOfQuestion(id) {
    var index = -1;
    STEPS.forEach(function (step, i) {
      (step.questions || []).forEach(function (q) { if (q.id === id) index = i; });
    });
    return index;
  }

  function coreQuestions() {
    return allQuestions().filter(function (q) { return q.core === true; });
  }

  function extendedQuestions() {
    return allQuestions().filter(function (q) { return q.core !== true; });
  }

  App.Schema = {
    version: App.Config.schemaVersion,
    steps: STEPS,
    allQuestions: allQuestions,
    getQuestion: getQuestion,
    getStep: getStep,
    getStepIndex: stepIndexOfQuestion,
    coreQuestions: coreQuestions,
    extendedQuestions: extendedQuestions
  };
})(window.BellFeedback);
