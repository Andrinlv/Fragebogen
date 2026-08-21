/* =============================================================================
   app.js — Bootstrap
   -----------------------------------------------------------------------------
   Startet die Applikation in definierter Reihenfolge und faengt Fehler ab,
   damit ein Teilproblem nie die ganze Seite unbrauchbar macht.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;
  var I18n = App.I18n;
  var UI = App.UI;
  var Wizard = App.Wizard;

  function fatal(message, error) {
    Core.log('error', 'app.fatal ' + message, error && error.message);
    var body = Core.dom.byId('step-body');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(Core.dom.el('div', { class: 'banner banner--error' }, [
      Core.dom.el('span', { class: 'banner__icon', html: Core.icon('alert') }),
      Core.dom.el('div', { class: 'banner__body' }, [
        Core.dom.el('p', { class: 'banner__title', text: 'Der Fragebogen konnte nicht geladen werden.' }),
        Core.dom.el('p', {
          class: 'banner__text',
          text: 'Bitte lade die Seite neu. Bleibt das Problem bestehen, melde dich bei der IT-Abteilung. (' + message + ')'
        })
      ])
    ]));
  }

  function start() {
    try {
      Core.log('info', 'app.boot ' + Config.appName + ' v' + Config.formVersion);

      UI.init();
      Wizard.init();

      Core.log('ok', 'app.ready locale=' + I18n.getLocale() +
        ' storage=' + (Core.storage.available ? 'on' : 'off') +
        ' endpoint=' + Config.endpointHost);

      if (!Config.isConfigured) {
        UI.banner({
          id: 'config',
          type: 'error',
          title: 'Konfiguration unvollständig',
          text: I18n.t('submit.notConfigured') + ' Siehe assets/js/config.js.',
          dismissible: false
        });
      }

      if (navigator.onLine === false) {
        UI.banner({
          id: 'offline',
          type: 'warn',
          title: I18n.t('offline.title'),
          text: I18n.t('offline.text')
        });
      }

      Core.bus.on('network:online', function () { UI.removeBanner('offline'); });
      Core.bus.on('network:offline', function () {
        UI.banner({ id: 'offline', type: 'warn', title: I18n.t('offline.title'), text: I18n.t('offline.text') });
      });

      Wizard.offerDraftRestore();
    } catch (error) {
      fatal(error && error.message ? error.message : 'unbekannter Fehler', error);
    }
  }

  window.addEventListener('error', function (event) {
    Core.log('error', 'window.error', event && event.message);
  });
  window.addEventListener('unhandledrejection', function (event) {
    Core.log('error', 'promise.unhandled', event && event.reason && event.reason.message);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.BellFeedback);
