/**
 * ANNA BLOOM — Google Sheets webhook.
 * Copy this file into Extensions -> Apps Script in the order spreadsheet.
 * Deploy as Web app: Execute as "Me", Who has access: "Anyone".
 * Keep the Google Sheet PRIVATE. This endpoint only accepts new orders and checks order IDs.
 * For actual business use in Russia, check personal-data localization requirements.
 */
const BLOOM_SHEET_ID = '1AN5KH3bsl-ckGF8k8xkLqL1kmKiHb3CUS38Ar94jSuk';
const BLOOM_SHEET_NAME = 'Заявки';

function bloomSheet_() {
  const sheet = SpreadsheetApp.openById(BLOOM_SHEET_ID).getSheetByName(BLOOM_SHEET_NAME);
  if (!sheet) throw new Error('Лист "Заявки" не найден');
  return sheet;
}

function safeText_(value, maxLength) {
  const s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
  // Prevent spreadsheet formula injection from user-submitted fields.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function exists_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return !!sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || '');
  const id = String(p.id || '');
  // Only allow a harmless JSONP status check; NEVER return customer details.
  if (/^bloomAck_[A-Za-z0-9_]{8,70}$/.test(callback) &&
      /^AB-[0-9]{8}-[A-Z0-9]{10}$/.test(id)) {
    try {
      const cached = CacheService.getScriptCache().get('bloom_' + id);
      const saved = cached === '1' || exists_(bloomSheet_(), id);
      return output_({ saved: saved }, callback);
    } catch (err) {
      console.error('Status error', err);
      return output_({ saved: false }, callback);
    }
  }
  return output_({ service: 'ANNA BLOOM', status: 'ok' });
}

function doPost(e) {
  try {
    const body = (e && e.postData && e.postData.contents) || '';
    if (!body || body.length > 18000) throw new Error('Bad payload');
    const d = JSON.parse(body);
    if (d.website) return output_({ ok: true }); // hidden bot trap

    const id = String(d.id || '').trim();
    const name = safeText_(d.name, 70);
    const phone = String(d.phone || '').trim();
    const eventDate = String(d.eventDate || '').trim();
    const place = safeText_(d.place, 150);
    const message = safeText_(d.message, 1200);
    const itemText = safeText_(
      Array.isArray(d.items) && d.items.length
        ? d.items.slice(0, 25).map(x => String(x.name || '').slice(0, 90) +
          ' × ' + Math.max(1, Math.min(50, Number(x.qty) || 1))).join('; ')
        : 'Индивидуальный проект', 2500);
    const estimated = Math.max(0, Math.min(100000000, Number(d.estimatedTotal) || 0));
    if (!/^AB-[0-9]{8}-[A-Z0-9]{10}$/.test(id) ||
        name.length < 2 || !/^\+7\d{10}$/.test(phone) ||
        (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) ||
        d.consent !== true) {
      throw new Error('Invalid order fields');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const sheet = bloomSheet_();
      if (!exists_(sheet, id)) {
        sheet.appendRow([
          new Date(), id, 'Новая', name, phone, eventDate,
          place, itemText, estimated, message, 'anna-bloom / сайт', 'Да'
        ]);
        SpreadsheetApp.flush();
      }
      CacheService.getScriptCache().put('bloom_' + id, '1', 600);
    } finally {
      lock.releaseLock();
    }
    return output_({ ok: true, id: id });
  } catch (err) {
    console.error('Submission error', err);
    return output_({ ok: false, error: 'Не удалось обработать заявку' });
  }
}
