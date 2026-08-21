/* =============================================================================
   export.js — PDF-Kopie und Druckansicht
   -----------------------------------------------------------------------------
   jsPDF wird ueber ein CDN geladen und ist daher optional: In gesperrten
   Firmennetzen faellt der Export automatisch auf den Druckdialog zurueck,
   der ueber assets/css/print.css sauber gestaltet ist.
============================================================================= */
(function (App) {
  'use strict';

  var Core = App.Core;
  var Config = App.Config;
  var I18n = App.I18n;
  var Render = App.Render;
  var el = Core.dom.el;

  var BRAND_RED = [227, 6, 19];
  var BRAND_GREEN = [81, 180, 1];
  var INK = [22, 28, 36];
  var MUTED = [110, 120, 133];
  var HAIRLINE = [220, 227, 235];

  /* jsPDF-Standardschriften koennen nur WinAnsi (Latin-1) darstellen. */
  function pdfSafe(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\n\u0020-\u00FF]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function isAvailable() {
    return !!(window.jspdf && window.jspdf.jsPDF);
  }

  /* -------------------------------------------------------------- Logo */
  /**
   * Versucht, das echte Logo als Bilddaten zu gewinnen. Über file:// gilt das
   * Bild als fremde Herkunft und canvas.toDataURL() wirft – dann wird eine
   * vektorbasierte Ersatzmarke gezeichnet.
   */
  function logoDataUrl() {
    try {
      var img = document.querySelector('.rail__logo img, .topbar__logo img');
      if (!img || !img.complete || !img.naturalWidth) return null;
      var canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (err) {
      return null;
    }
  }

  function drawLogo(doc, x, y, width) {
    var height = width * (159 / 318);
    var data = logoDataUrl();
    if (data) {
      try {
        doc.addImage(data, 'PNG', x, y, width, height);
        return height;
      } catch (err) { /* auf Vektorvariante zurueckfallen */ }
    }
    /* Ersatzmarke: rote Ellipse mit gruenem Blatt – dem Logo nachempfunden. */
    var cx = x + width / 2;
    var cy = y + height * 0.45;
    doc.setFillColor(254, 0, 0);
    doc.ellipse(cx, cy, width * 0.34, height * 0.42, 'F');
    doc.setFillColor(BRAND_GREEN[0], BRAND_GREEN[1], BRAND_GREEN[2]);
    doc.ellipse(cx, cy + height * 0.34, width * 0.24, height * 0.14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(width * 0.9);
    doc.text('Bell', cx, cy + height * 0.14, { align: 'center' });
    return height;
  }

  /* --------------------------------------------------------------- PDF */
  function buildPdf(groups, receipt) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

    var pageWidth = 210;
    var pageHeight = 297;
    var margin = 18;
    var contentWidth = pageWidth - margin * 2;
    var y = 0;

    /* Kopfbalken */
    doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
    doc.rect(0, 0, pageWidth, 15, 'F');
    doc.setFillColor(BRAND_GREEN[0], BRAND_GREEN[1], BRAND_GREEN[2]);
    doc.rect(0, 15, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(pdfSafe(Config.organisation.toUpperCase() + '  |  INFORMATIK'), margin, 9.6);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafe('Feedback-Erhebung'), pageWidth - margin, 9.6, { align: 'right' });

    y = 28;
    var logoHeight = drawLogo(doc, margin, y, 30);

    y += logoHeight + 10;
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(pdfSafe(I18n.t('app.title')), margin, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(pdfSafe(I18n.t('review.title')), margin, y);

    /* Kennzahlenblock */
    y += 8;
    doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'S');

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    var cellWidth = contentWidth / 3;
    [
      [I18n.t('done.ref'), receipt.reference],
      [I18n.t('done.time'), Core.formatDateTime(receipt.at, I18n.getLocale() === 'de' ? 'de-CH' : 'en-GB')],
      [I18n.t('done.status'), receipt.pending ? I18n.t('done.statusPending') : I18n.t('done.statusOk')]
    ].forEach(function (pair, index) {
      var cellX = margin + 4 + index * cellWidth;
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(pdfSafe(pair[0]).toUpperCase(), cellX, y + 7);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(pdfSafe(pair[1]), cellX, y + 13.5);
    });

    y += 30;

    /* Inhalt */
    function ensureSpace(needed) {
      if (y + needed <= pageHeight - 22) return;
      doc.addPage();
      y = margin + 6;
    }

    groups.forEach(function (group) {
      ensureSpace(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
      doc.text(pdfSafe(I18n.label(group.title)).toUpperCase(), margin, y);
      y += 2.5;
      doc.setDrawColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 18, y);
      y += 6;

      group.rows.forEach(function (row) {
        var question = pdfSafe(I18n.label(row.label));
        var value = row.answered ? pdfSafe(displayValue(row)) : pdfSafe(I18n.t('review.empty'));

        var questionLines = doc.splitTextToSize(question, contentWidth);
        var valueLines = doc.splitTextToSize(value, contentWidth - 4);
        ensureSpace(questionLines.length * 4.6 + valueLines.length * 4.8 + 8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(questionLines, margin, y);
        y += questionLines.length * 4.6 + 1.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(60, 68, 80);
        doc.text(valueLines, margin + 4, y);
        y += valueLines.length * 4.8 + 4;

        doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
        doc.setLineWidth(0.2);
        doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
        y += 3;
      });

      y += 4;
    });

    /* Fusszeilen */
    var pages = doc.getNumberOfPages();
    for (var page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(pdfSafe(I18n.t('foot.legal')), margin, pageHeight - 11);
      doc.text(page + ' / ' + pages, pageWidth - margin, pageHeight - 11, { align: 'right' });
      doc.setFontSize(6.8);
      doc.text(pdfSafe(I18n.t('foot.privacy')), margin, pageHeight - 7);
    }

    return doc;
  }

  function displayValue(row) {
    if (row.list && row.list.length) {
      return row.list.map(function (value) { return Render.labelOfOption(row.question, value); }).join(', ');
    }
    if (row.question.type === 'choice') return Render.labelOfOption(row.question, row.text);
    if (row.question.type === 'scale') return row.text + ' / ' + (row.question.max || 10);
    return row.text;
  }

  /**
   * Erstellt und speichert die PDF-Kopie.
   * @returns {{ok:boolean, reason?:string}}
   */
  function downloadPdf(groups, receipt) {
    if (!Config.pdfEnabled) return { ok: false, reason: 'disabled' };
    if (!isAvailable()) {
      Core.log('warn', 'pdf.unavailable fallback=print');
      return { ok: false, reason: 'unavailable' };
    }
    try {
      var doc = buildPdf(groups, receipt);
      doc.save('Bell-IT-Feedback_' + receipt.reference + '.pdf');
      Core.log('ok', 'pdf.created ref=' + receipt.reference);
      return { ok: true };
    } catch (err) {
      Core.log('error', 'pdf.failed', err && err.message);
      return { ok: false, reason: 'error' };
    }
  }

  /* ------------------------------------------------------- Druckansicht */
  /** Baut den nur im Druck sichtbaren Beleg (Kopf + Zusammenfassung). */
  function buildPrintDocument(groups, receipt) {
    var header = el('div', { class: 'print-header' }, [
      el('img', { src: 'assets/img/bell-logo.png', alt: 'Bell' }),
      el('div', {}, [
        el('div', { class: 'print-header__title', text: I18n.t('app.title') + ' · ' + I18n.t('app.subtitle') }),
        el('div', { class: 'print-header__meta' }, [
          el('div', { text: I18n.t('done.ref') + ': ' + receipt.reference }),
          el('div', { text: Core.formatDateTime(receipt.at, 'de-CH') })
        ])
      ])
    ]);

    return el('div', { class: 'print-only', id: 'print-document' }, [
      header,
      Render.summary(groups, function () {})
    ]);
  }

  function print() {
    window.setTimeout(function () { window.print(); }, 60);
  }

  App.Export = {
    isAvailable: isAvailable,
    downloadPdf: downloadPdf,
    buildPrintDocument: buildPrintDocument,
    print: print,
    pdfSafe: pdfSafe
  };
})(window.BellFeedback);
