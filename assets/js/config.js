/* =============================================================================
   config.js — Zentrale Konfiguration
   -----------------------------------------------------------------------------
   Einziger Ort, an dem Endpunkt, Versionen und Betriebsparameter gepflegt
   werden. Werte lassen sich vor dem Laden der App ueberschreiben:

       <script>window.BELL_FEEDBACK_CONFIG = { endpoint: '...' };</script>

   WICHTIG — Vertrag mit Google Sheets
   -----------------------------------
   Die fuenf Kernfelder (gesamt, workshops, lehre, highlight, verbesserung)
   werden unveraendert als multipart/form-data an dieselbe Apps-Script-URL
   gesendet wie bisher. Es werden bewusst KEINE zusaetzlichen HTTP-Header
   gesetzt, damit der Request ein "simple request" bleibt und kein
   CORS-Preflight ausloest (Apps Script beantwortet kein OPTIONS).

   `sendExtendedFields` haengt die neuen Felder als zusaetzliche Parameter an.
   Ein bestehendes Apps Script, das nur die bekannten Spalten liest, ignoriert
   sie folgenlos. Mit dem mitgelieferten Skript (apps-script/Code.gs) werden
   sie automatisch als neue Spalten uebernommen.
============================================================================= */
(function (App) {
  'use strict';

  var defaults = {
    /* ---------------------------------------------------------- Anbindung */
    endpoint: 'https://script.google.com/macros/s/AKfycbxrCNjeTy5K_9N1jcZCYXMH6ONtITx25FWrjRf5cHFj2aJRjJ7kByR8uFwPQQiHWQlz/exec',
    requestTimeoutMs: 25000,

    /* Zusatzfelder mitsenden (neue Fragen). Auf false setzen, wenn das
       Apps Script strikt nur die fuenf Ursprungsfelder verarbeiten darf.   */
    sendExtendedFields: true,

    /* Technische Metadaten (Vorgangsnummer, Zeitstempel, Version, Sprache,
       Bearbeitungsdauer) mitsenden. Enthaelt keine personenbezogenen Daten. */
    sendDiagnostics: true,

    /* Automatischer Wiederholversuch bei Netzfehlern.
       Standard: aus. Grund: Bricht die Antwort nach erfolgreichem Schreiben
       ab (z. B. CORS), wuerde ein Retry eine Doppelzeile erzeugen. Das
       mitgelieferte Apps Script erkennt Duplikate anhand der Vorgangsnummer –
       erst dann ist `true` gefahrlos.                                      */
    autoRetry: false,
    autoRetryAttempts: 2,

    /* ------------------------------------------------------- Applikation */
    appName: 'Bell IT Feedback',
    organisation: 'Bell Schweiz AG',
    formVersion: '2.0.0',
    schemaVersion: '2025.1',

    defaultLocale: 'de',
    availableLocales: ['de', 'en'],

    /* Sprache aus dem Browser uebernehmen. Standard: aus. Zielgruppe des
       Fragebogens ist deutschsprachig; Englisch ist ueber den Umschalter
       jederzeit einen Klick entfernt.                                      */
    autoDetectLocale: false,

    /* ---------------------------------------------------------- Verhalten */
    storagePrefix: 'bell-it-feedback',
    draftTtlHours: 24,
    autosaveDebounceMs: 400,
    showConsole: true,
    consoleOpenByDefault: false,
    pdfEnabled: true,
    scrollBehaviour: 'smooth'
  };

  var config = {};
  Object.keys(defaults).forEach(function (key) { config[key] = defaults[key]; });

  var overrides = window.BELL_FEEDBACK_CONFIG || {};
  Object.keys(overrides).forEach(function (key) { config[key] = overrides[key]; });

  /* Abgeleitete Werte */
  config.storageKeys = {
    draft: config.storagePrefix + ':draft',
    queue: config.storagePrefix + ':queue',
    theme: config.storagePrefix + ':theme',
    locale: config.storagePrefix + ':locale'
  };

  config.endpointHost = (function () {
    try { return new URL(config.endpoint).host; }
    catch (err) { return 'unbekannt'; }
  })();

  config.isConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint);

  App.Config = config;
})(window.BellFeedback);
