/* =============================================================================
   transport.js — Übermittlung an Google Sheets (Apps Script Web-App)
   -----------------------------------------------------------------------------
   Bewusst unveraendert gegenueber der Vorversion:
     · POST auf dieselbe /exec-URL
     · Body als FormData (multipart/form-data)
     · KEINE zusaetzlichen Request-Header

   Damit bleibt der Request ein "simple request" im Sinne von CORS und loest
   keinen OPTIONS-Preflight aus, den Apps Script nicht beantworten wuerde.

   Neu sind ausschliesslich die Betriebsqualitaeten: Timeout, Offline-Erkennung,
   lokale Warteschlange, strukturiertes Logging und Idempotenz-Schluessel.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;

  /* --------------------------------------------------------------- Fehler */
  function TransportError(code, message, detail) {
    this.name = 'TransportError';
    this.code = code;                 /* offline | notConfigured | timeout | http | network */
    this.message = message || code;
    this.detail = detail;
  }
  TransportError.prototype = Object.create(Error.prototype);

  /* ------------------------------------------------------------ Hilfsmittel */
  function toFormData(payload) {
    var body = new FormData();
    Object.keys(payload).forEach(function (key) {
      body.append(key, payload[key] === null || payload[key] === undefined ? '' : String(payload[key]));
    });
    return body;
  }

  function wait(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  /* ------------------------------------------------------------- Einzelruf */
  function postOnce(payload) {
    var started = Date.now();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;

    var options = { method: 'POST', body: toFormData(payload), redirect: 'follow' };
    if (controller) options.signal = controller.signal;

    var timeout = new Promise(function (_resolve, reject) {
      timer = window.setTimeout(function () {
        if (controller) controller.abort();
        reject(new TransportError('timeout', 'Zeitüberschreitung nach ' + Config.requestTimeoutMs + ' ms'));
      }, Config.requestTimeoutMs);
    });

    var request = fetch(Config.endpoint, options).then(function (response) {
      if (!response.ok) {
        throw new TransportError('http', 'HTTP ' + response.status, response.status);
      }
      return { ok: true, status: response.status, durationMs: Date.now() - started };
    });

    return Promise.race([request, timeout])
      .then(function (result) {
        window.clearTimeout(timer);
        return result;
      })
      .catch(function (error) {
        window.clearTimeout(timer);
        if (error instanceof TransportError) throw error;
        /* AbortError entsteht durch unseren eigenen Timeout. */
        if (error && error.name === 'AbortError') {
          throw new TransportError('timeout', 'Zeitüberschreitung');
        }
        throw new TransportError('network', (error && error.message) || 'Netzwerkfehler');
      });
  }

  /* ------------------------------------------------------------- Übermitteln */
  /**
   * Sendet einen Datensatz.
   * @param {Object} payload  Flaches Objekt aus State.buildPayload()
   * @returns {Promise<{ok:boolean,status:number,durationMs:number,attempts:number}>}
   */
  function submit(payload) {
    if (!Config.isConfigured) {
      Core.log('error', 'submit.abort reason=not_configured');
      return Promise.reject(new TransportError('notConfigured', App.I18n.t('submit.notConfigured')));
    }
    if (navigator.onLine === false) {
      Core.log('warn', 'submit.abort reason=offline');
      return Promise.reject(new TransportError('offline', App.I18n.t('submit.offlineText')));
    }

    var maxAttempts = Config.autoRetry ? Math.max(1, Config.autoRetryAttempts) : 1;
    var attempt = 0;

    Core.log('net', 'POST ' + Config.endpointHost + '/exec fields=' + Object.keys(payload).length);

    function run() {
      attempt++;
      return postOnce(payload)
        .then(function (result) {
          result.attempts = attempt;
          Core.log('ok', 'submit.ok status=' + result.status + ' in ' + result.durationMs + 'ms');
          return result;
        })
        .catch(function (error) {
          var retryable = error.code === 'network' || error.code === 'timeout';
          if (retryable && attempt < maxAttempts) {
            var backoff = Math.min(8000, 800 * Math.pow(2, attempt - 1));
            Core.log('warn', 'submit.retry attempt=' + attempt + ' in ' + backoff + 'ms (' + error.code + ')');
            return wait(backoff).then(run);
          }
          Core.log('error', 'submit.failed code=' + error.code + ' attempts=' + attempt, error.message);
          error.attempts = attempt;
          throw error;
        });
    }

    return run();
  }

  /* ------------------------------------------------------- Warteschlange */
  /* Nicht uebermittelte Datensaetze bleiben lokal erhalten, damit nichts
     verloren geht, wenn das Netz waehrend des Absendens wegbricht.        */
  function queueGet() {
    var queue = Core.storage.get(Config.storageKeys.queue, []);
    return Array.isArray(queue) ? queue : [];
  }

  function queueSave(queue) {
    Core.storage.set(Config.storageKeys.queue, queue.slice(-10));
  }

  function queueAdd(entry) {
    var queue = queueGet();
    var exists = queue.some(function (item) { return item.id === entry.id; });
    if (!exists) {
      queue.push(entry);
      queueSave(queue);
      Core.log('warn', 'queue.stored id=' + entry.id + ' size=' + queue.length);
    }
    return queue.length;
  }

  function queueRemove(id) {
    var queue = queueGet().filter(function (item) { return item.id !== id; });
    queueSave(queue);
    return queue.length;
  }

  function queueClear() {
    Core.storage.remove(Config.storageKeys.queue);
  }

  /**
   * Versucht alle wartenden Datensaetze zu senden.
   * @returns {Promise<{sent:number, failed:number, remaining:number}>}
   */
  function flushQueue() {
    var queue = queueGet();
    if (!queue.length) return Promise.resolve({ sent: 0, failed: 0, remaining: 0 });
    if (navigator.onLine === false) return Promise.resolve({ sent: 0, failed: queue.length, remaining: queue.length });

    Core.log('net', 'queue.flush size=' + queue.length);

    var sent = 0;
    var failed = 0;

    return queue.reduce(function (chain, item) {
      return chain.then(function () {
        return submit(item.payload)
          .then(function () { sent++; queueRemove(item.id); })
          .catch(function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      var remaining = queueGet().length;
      Core.log(failed ? 'warn' : 'ok', 'queue.flushed sent=' + sent + ' failed=' + failed + ' remaining=' + remaining);
      Core.bus.emit('queue:flushed', { sent: sent, failed: failed, remaining: remaining });
      return { sent: sent, failed: failed, remaining: remaining };
    });
  }

  App.Transport = {
    submit: submit,
    queueAdd: queueAdd,
    queueGet: queueGet,
    queueRemove: queueRemove,
    queueClear: queueClear,
    flushQueue: flushQueue,
    toFormData: toFormData,
    TransportError: TransportError
  };
})(window.BellFeedback);
