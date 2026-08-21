/* =============================================================================
   ui.js — Rahmen der Applikation
   -----------------------------------------------------------------------------
   Theme, Sprache, Statusanzeigen, Hinweisbanner, Toasts und die Log-Konsole.
   Kennt den Fragebogen nicht – nur die Huelle drumherum.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;
  var I18n = App.I18n;
  var dom = Core.dom;

  var refs = {};
  var toastTimers = [];
  var banners = {};

  /* ================================================================ Theme */
  var themePref = 'system';

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function effectiveTheme() {
    return themePref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : themePref;
  }

  function applyTheme() {
    var theme = effectiveTheme();
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme-pref', themePref);

    dom.qsa('[data-theme-option]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme-option') === themePref));
    });

    if (refs.topbarTheme) {
      refs.topbarTheme.innerHTML = Core.icon(theme === 'dark' ? 'moon' : 'sun');
    }
    Core.bus.emit('theme:changed', theme);
  }

  function setTheme(pref) {
    themePref = ['light', 'dark', 'system'].indexOf(pref) >= 0 ? pref : 'system';
    if (themePref === 'system') Core.storage.remove(Config.storageKeys.theme);
    else Core.storage.setRaw(Config.storageKeys.theme, themePref);
    applyTheme();
  }

  function cycleTheme() {
    var order = ['light', 'dark', 'system'];
    setTheme(order[(order.indexOf(themePref) + 1) % order.length]);
  }

  function initTheme() {
    var stored = Core.storage.getRaw(Config.storageKeys.theme);
    themePref = stored === 'light' || stored === 'dark' ? stored : 'system';
    applyTheme();

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (themePref === 'system') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    dom.qsa('[data-theme-option]').forEach(function (btn) {
      btn.addEventListener('click', function () { setTheme(btn.getAttribute('data-theme-option')); });
    });
    if (refs.topbarTheme) refs.topbarTheme.addEventListener('click', cycleTheme);
  }

  /* ============================================================== Sprache */
  function applyLocaleButtons() {
    var locale = I18n.getLocale();
    dom.qsa('[data-lang-option]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang-option') === locale));
    });
    if (refs.topbarLang) refs.topbarLang.textContent = locale.toUpperCase();
  }

  function initLocale() {
    I18n.setLocale(I18n.detect(), { persist: false });
    applyLocaleButtons();

    dom.qsa('[data-lang-option]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        I18n.setLocale(btn.getAttribute('data-lang-option'));
        applyLocaleButtons();
      });
    });

    if (refs.topbarLang) {
      refs.topbarLang.addEventListener('click', function () {
        var list = Config.availableLocales;
        var next = list[(list.indexOf(I18n.getLocale()) + 1) % list.length];
        I18n.setLocale(next);
        applyLocaleButtons();
      });
    }

    Core.bus.on('locale:changed', applyLocaleButtons);
  }

  /* ============================================================== Status */
  function setConnection(online) {
    if (!refs.connection) return;
    refs.connection.className = 'pill ' + (online ? 'pill--live' : 'pill--offline');
    refs.connection.innerHTML = '';
    refs.connection.appendChild(dom.el('span', { class: 'pill__dot' }));
    refs.connection.appendChild(dom.el('span', { text: I18n.t(online ? 'status.online' : 'status.offline') }));
  }

  function setAutosave(state) {
    if (!refs.autosave) return;
    var key = {
      idle: 'status.autosaveIdle',
      saving: 'status.autosaveSaving',
      saved: 'status.autosaveSaved',
      off: 'status.autosaveOff'
    }[state] || 'status.autosaveIdle';
    refs.autosave.className = 'pill ' + (state === 'saved' ? 'pill--live' : state === 'off' ? 'pill--offline' : 'pill--muted');
    refs.autosave.textContent = I18n.t(key);
  }

  /* ============================================================== Banner */
  /**
   * Zeigt ein Hinweisbanner. Gleiche id ersetzt das vorhandene Banner.
   * @returns {Function} Funktion zum Entfernen
   */
  function banner(options) {
    var opts = options || {};
    var id = opts.id || Core.uuid();
    removeBanner(id);

    var iconName = { info: 'info', warn: 'warning', error: 'alert', success: 'checkCircle' }[opts.type] || 'info';

    var actions = (opts.actions || []).map(function (action) {
      return dom.el('button', {
        type: 'button',
        class: 'btn btn--sm ' + (action.variant === 'primary' ? 'btn--primary' : 'btn--secondary'),
        text: action.label,
        on: {
          click: function () {
            if (action.keepOpen !== true) removeBanner(id);
            if (typeof action.onClick === 'function') action.onClick();
          }
        }
      });
    });

    var node = dom.el('div', { class: 'banner banner--' + (opts.type || 'info'), dataset: { bannerId: id } }, [
      dom.el('span', { class: 'banner__icon', html: Core.icon(iconName) }),
      dom.el('div', { class: 'banner__body' }, [
        opts.title ? dom.el('p', { class: 'banner__title', text: opts.title }) : null,
        opts.text ? dom.el('p', { class: 'banner__text', text: opts.text }) : null,
        actions.length ? dom.el('div', { class: 'banner__actions' }, actions) : null
      ]),
      opts.dismissible === false ? null : dom.el('button', {
        type: 'button',
        class: 'btn btn--quiet',
        'aria-label': 'Schliessen',
        html: Core.icon('x'),
        on: { click: function () { removeBanner(id); } }
      })
    ]);

    banners[id] = node;
    if (refs.bannerSlot) refs.bannerSlot.appendChild(node);
    return function () { removeBanner(id); };
  }

  function removeBanner(id) {
    var node = banners[id];
    if (node && node.parentNode) node.parentNode.removeChild(node);
    delete banners[id];
  }

  function clearBanners() {
    Object.keys(banners).forEach(removeBanner);
  }

  /* =============================================================== Toasts */
  function toast(options) {
    var opts = options || {};
    if (!refs.toastStack) return;

    var iconName = { info: 'info', error: 'alert', success: 'checkCircle', warn: 'warning' }[opts.type] || 'info';
    var node = dom.el('div', { class: 'toast toast--' + (opts.type || 'info'), role: 'status' }, [
      dom.el('span', { class: 'toast__icon', html: Core.icon(iconName) }),
      dom.el('div', {}, [
        opts.title ? dom.el('p', { class: 'toast__title', text: opts.title }) : null,
        opts.text ? dom.el('p', { class: 'toast__text', text: opts.text }) : null
      ])
    ]);

    refs.toastStack.appendChild(node);

    while (refs.toastStack.children.length > 4) {
      refs.toastStack.removeChild(refs.toastStack.firstChild);
    }

    var timer = window.setTimeout(function () {
      node.setAttribute('data-leaving', 'true');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, opts.timeout || 5200);
    toastTimers.push(timer);
  }

  /* ========================================================= Log-Konsole */
  function initConsole() {
    if (!refs.console) return;
    if (!Config.showConsole) { refs.console.hidden = true; return; }
    refs.console.hidden = false;

    var expanded = !!Config.consoleOpenByDefault;
    var setExpanded = function (value) {
      expanded = value;
      refs.consoleToggle.setAttribute('aria-expanded', String(expanded));
      refs.consoleBody.hidden = !expanded;
      if (expanded) refs.consoleBody.scrollTop = refs.consoleBody.scrollHeight;
    };

    refs.consoleToggle.addEventListener('click', function () { setExpanded(!expanded); });
    setExpanded(expanded);

    renderLogPlaceholder();
    Core.logEntries.forEach(appendLogLine);
    Core.bus.on('log', appendLogLine);
  }

  function renderLogPlaceholder() {
    if (!refs.consoleBody || Core.logEntries.length) return;
    dom.clear(refs.consoleBody);
    refs.consoleBody.appendChild(dom.el('p', { class: 'console__empty', text: I18n.t('console.empty') }));
  }

  function appendLogLine(entry) {
    if (!refs.consoleBody) return;
    var placeholder = dom.qs('.console__empty', refs.consoleBody);
    if (placeholder) refs.consoleBody.removeChild(placeholder);

    var line = dom.el('p', { class: 'console__line', dataset: { level: entry.level } }, [
      dom.el('span', { class: 'console__time', text: Core.formatTime(entry.time) }),
      dom.el('span', { class: 'console__msg', text: entry.message + (entry.detail ? ' ' + entry.detail : '') })
    ]);
    refs.consoleBody.appendChild(line);

    while (refs.consoleBody.children.length > 120) {
      refs.consoleBody.removeChild(refs.consoleBody.firstChild);
    }
    refs.consoleBody.scrollTop = refs.consoleBody.scrollHeight;
    if (refs.consoleCount) refs.consoleCount.textContent = String(Core.logEntries.length);
  }

  /* ================================================================= Init */
  function init() {
    refs = {
      bannerSlot: dom.byId('banner-slot'),
      toastStack: dom.byId('toast-stack'),
      connection: dom.byId('status-connection'),
      autosave: dom.byId('status-autosave'),
      version: dom.byId('status-version'),
      console: dom.byId('console'),
      consoleToggle: dom.byId('console-toggle'),
      consoleBody: dom.byId('console-body'),
      consoleCount: dom.byId('console-count'),
      topbarTheme: dom.byId('topbar-theme'),
      topbarLang: dom.byId('topbar-lang'),
      footTech: dom.byId('foot-tech')
    };

    initTheme();
    initLocale();
    initConsole();

    if (refs.version) refs.version.textContent = 'v' + Config.formVersion;
    if (refs.footTech) {
      refs.footTech.textContent = 'v' + Config.formVersion + ' · schema ' + Config.schemaVersion + ' · ' + Config.endpointHost;
    }

    setConnection(navigator.onLine !== false);
    setAutosave(Core.storage.available ? 'idle' : 'off');

    window.addEventListener('online', function () {
      setConnection(true);
      Core.log('ok', 'network.online');
      Core.bus.emit('network:online');
    });
    window.addEventListener('offline', function () {
      setConnection(false);
      Core.log('warn', 'network.offline');
      Core.bus.emit('network:offline');
    });

    Core.bus.on('locale:changed', function () {
      setConnection(navigator.onLine !== false);
      setAutosave(Core.storage.available ? 'idle' : 'off');
      renderLogPlaceholder();
    });
  }

  App.UI = {
    init: init,
    toast: toast,
    banner: banner,
    removeBanner: removeBanner,
    clearBanners: clearBanners,
    setConnection: setConnection,
    setAutosave: setAutosave,
    setTheme: setTheme,
    cycleTheme: cycleTheme,
    effectiveTheme: effectiveTheme
  };
})(window.BellFeedback);
