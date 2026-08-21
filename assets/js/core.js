/* =============================================================================
   core.js — Basisschicht der Applikation
   -----------------------------------------------------------------------------
   Stellt Namespace, DOM-Helfer, Icon-Registry, sicheren Storage-Zugriff,
   Event-Bus und Logger bereit. Keine Abhaengigkeiten, laedt als Erstes.
============================================================================= */
window.BellFeedback = window.BellFeedback || {};

(function (App) {
  'use strict';

  /* ------------------------------------------------------------------ DOM */
  var dom = {
    byId: function (id) { return document.getElementById(id); },
    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    /**
     * Erzeugt ein Element.
     * @param {string} tag
     * @param {Object} [attrs]  class | text | html | dataset | on | beliebige Attribute
     * @param {Array|Node|string} [children]
     */
    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          var value = attrs[key];
          if (value === null || value === undefined || value === false) return;
          if (key === 'class') { node.className = value; return; }
          if (key === 'text') { node.textContent = value; return; }
          if (key === 'html') { node.innerHTML = value; return; }
          if (key === 'dataset') {
            Object.keys(value).forEach(function (dk) { node.dataset[dk] = value[dk]; });
            return;
          }
          if (key === 'on') {
            Object.keys(value).forEach(function (evt) { node.addEventListener(evt, value[evt]); });
            return;
          }
          if (value === true) { node.setAttribute(key, ''); return; }
          node.setAttribute(key, value);
        });
      }
      if (children !== undefined && children !== null) {
        (Array.isArray(children) ? children : [children]).forEach(function (child) {
          if (child === null || child === undefined || child === false) return;
          node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
      }
      return node;
    },

    clear: function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; },

    on: function (target, type, handler, options) {
      if (!target) return function () {};
      target.addEventListener(type, handler, options);
      return function () { target.removeEventListener(type, handler, options); };
    }
  };

  /* ---------------------------------------------------------------- Icons */
  var ICON_PATHS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/>',
    warning: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
    moon: '<path d="M12 3a6.5 6.5 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01"/><path d="M6 17h.01"/>',
    smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    headset: '<path d="M3 14a9 9 0 0 1 18 0"/><path d="M21 14v4a3 3 0 0 1-3 3h-3"/><rect x="2" y="13" width="4" height="7" rx="1.5"/><rect x="18" y="13" width="4" height="7" rx="1.5"/>',
    helpCircle: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.7-2.6 2.7"/><path d="M12 17h.01"/>',
    network: '<rect x="9" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="16" width="6" height="6" rx="1.5"/><rect x="16" y="16" width="6" height="6" rx="1.5"/><path d="M5 16v-2.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1V16"/><path d="M12 12.5V8"/>',
    shield: '<path d="M12 21c-4.5-1.5-7-4.5-7-9V6l7-3 7 3v6c0 4.5-2.5 7.5-7 9Z"/><path d="m9.5 12 1.8 1.8L15 10"/>',
    brain: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 16h.01"/><path d="M16 16h.01"/>',
    cloud: '<path d="M17.5 19H9a5.5 5.5 0 1 1 1.4-10.8A6 6 0 0 1 21.9 11a4 4 0 0 1-1.4 7.8Z"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M2 9h2"/><path d="M2 15h2"/><path d="M20 9h2"/><path d="M20 15h2"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    gitBranch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    lock: '<rect x="3.5" y="10" width="17" height="11" rx="2"/><path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    sparkles: '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6.3 6.3 2.4 2.4"/><path d="m15.3 15.3 2.4 2.4"/><path d="m17.7 6.3-2.4 2.4"/><path d="m8.7 15.3-2.4 2.4"/>',
    wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.5-2.3"/><path d="M15.5 10.6A10 10 0 0 1 19 12.9"/><path d="M2 8.8a16 16 0 0 1 5-3"/><path d="M17 5.8a16 16 0 0 1 5 3"/><path d="M12 20h.01"/>',
    gauge: '<path d="M12 14 15.5 9"/><path d="M20.5 17a9 9 0 1 0-17 0"/><circle cx="12" cy="14" r="1.5"/>'
  };

  /** Liefert ein SVG-Icon als String (24x24, currentColor, Stroke-Stil). */
  function iconMarkup(name, extraClass) {
    var body = ICON_PATHS[name];
    if (!body) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' +
      (extraClass ? ' class="' + extraClass + '"' : '') + '>' + body + '</svg>';
  }

  function iconNode(name, extraClass) {
    var wrap = document.createElement('span');
    wrap.innerHTML = iconMarkup(name, extraClass);
    return wrap.firstChild || document.createTextNode('');
  }

  /* -------------------------------------------------------------- Storage */
  /* localStorage kann blockiert sein (Privatmodus, Firmenrichtlinie, file://).
     Deshalb immer gekapselt und mit In-Memory-Fallback.                    */
  var memoryStore = {};
  var storageAvailable = (function () {
    try {
      var probe = '__bell_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) { return false; }
  })();

  var storage = {
    available: storageAvailable,
    get: function (key, fallback) {
      try {
        var raw = storageAvailable ? window.localStorage.getItem(key) : memoryStore[key];
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (err) { return fallback; }
    },
    set: function (key, value) {
      try {
        var raw = JSON.stringify(value);
        if (storageAvailable) window.localStorage.setItem(key, raw);
        else memoryStore[key] = raw;
        return true;
      } catch (err) { return false; }
    },
    remove: function (key) {
      try {
        if (storageAvailable) window.localStorage.removeItem(key);
        else delete memoryStore[key];
      } catch (err) { /* bewusst ignoriert */ }
    },
    /** Rohwert ohne JSON (fuer das Theme, das der Inline-Bootstrap liest) */
    getRaw: function (key) {
      try { return storageAvailable ? window.localStorage.getItem(key) : (memoryStore[key] || null); }
      catch (err) { return null; }
    },
    setRaw: function (key, value) {
      try {
        if (storageAvailable) window.localStorage.setItem(key, value);
        else memoryStore[key] = value;
      } catch (err) { /* bewusst ignoriert */ }
    }
  };

  /* ------------------------------------------------------------ Event-Bus */
  function createBus() {
    var handlers = {};
    return {
      on: function (type, fn) {
        (handlers[type] = handlers[type] || []).push(fn);
        return function () { handlers[type] = handlers[type].filter(function (h) { return h !== fn; }); };
      },
      emit: function (type, payload) {
        (handlers[type] || []).forEach(function (fn) {
          try { fn(payload); } catch (err) { if (window.console) console.error('[bus:' + type + ']', err); }
        });
      }
    };
  }

  /* --------------------------------------------------------------- Logger */
  var logEntries = [];
  var bus = createBus();

  function log(level, message, detail) {
    var entry = {
      time: new Date(),
      level: level,          /* info | ok | warn | error | net */
      message: message,
      detail: detail
    };
    logEntries.push(entry);
    if (logEntries.length > 200) logEntries.shift();
    bus.emit('log', entry);
    if (window.console && (level === 'error' || level === 'warn')) {
      console[level === 'error' ? 'error' : 'warn']('[bell-feedback] ' + message, detail || '');
    }
    return entry;
  }

  /* ---------------------------------------------------------------- Utils */
  function uuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
      if (window.crypto && window.crypto.getRandomValues) {
        var buf = new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40;
        buf[8] = (buf[8] & 0x3f) | 0x80;
        var hex = Array.prototype.map.call(buf, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
      }
    } catch (err) { /* Fallback unten */ }
    return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /** Kurze, gut vorlesbare Referenz fuer Nutzer und Auswertung: BF-7QK4-2M9X */
  function submissionRef(id) {
    var clean = String(id || uuid()).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    while (clean.length < 8) clean += 'X';
    return 'BF-' + clean.slice(0, 4) + '-' + clean.slice(4, 8);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatTime(date) {
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
  }

  function formatDateTime(date, locale) {
    try {
      return new Intl.DateTimeFormat(locale || 'de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch (err) {
      return pad2(date.getDate()) + '.' + pad2(date.getMonth() + 1) + '.' + date.getFullYear() +
        ', ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Steuerzeichen (ausser Zeilenumbruch/Tab) entfernen und Laenge begrenzen. */
  var CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  function sanitizeText(value, maxLength) {
    var text = String(value === null || value === undefined ? '' : value);
    text = text.replace(/\r\n?/g, '\n');
    text = text.replace(CONTROL_CHARS, '');
    text = text.replace(/\n{4,}/g, '\n\n\n');
    text = text.replace(/[ \t]+$/gm, '');
    text = text.trim();
    if (maxLength && text.length > maxLength) text = text.slice(0, maxLength);
    return text;
  }

  /**
   * Verhindert, dass Google Sheets Eingaben als Formel auswertet.
   * Bewusst OHNE fuehrendes Minus: "- mehr Zeit" ist gewoehnlicher Text und
   * wuerde sonst mit einem Hochkomma in der Tabelle landen.
   */
  function neutralizeFormula(value) {
    var text = String(value === null || value === undefined ? '' : value);
    return /^[=+@\t\r]/.test(text) ? "'" + text : text;
  }

  App.Core = {
    dom: dom,
    icon: iconMarkup,
    iconNode: iconNode,
    icons: ICON_PATHS,
    storage: storage,
    bus: bus,
    createBus: createBus,
    log: log,
    logEntries: logEntries,
    uuid: uuid,
    submissionRef: submissionRef,
    pad2: pad2,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    debounce: debounce,
    clamp: clamp,
    escapeHtml: escapeHtml,
    sanitizeText: sanitizeText,
    neutralizeFormula: neutralizeFormula
  };
})(window.BellFeedback);
