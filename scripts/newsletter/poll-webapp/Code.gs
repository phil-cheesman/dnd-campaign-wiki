/**
 * Alambor "Cast Your Vote" — one-click poll, Google Apps Script web app.
 *
 * Each newsletter button is a DIRECT link (no Google Form, no Submit step):
 *   <WEBAPP_URL>?ep=163&vote=A&l=<url-encoded answer label>
 * Clicking it logs the vote to the bound Sheet and shows a themed thank-you page.
 *
 * Results for a past episode (powers the "Last week's results" section):
 *   <WEBAPP_URL>?mode=results&ep=162   ->  JSON { "A": 3, "B": 1, "C": 0 }
 *
 * SETUP: see README.md in this folder. Deploy as: Web app · Execute as Me ·
 * Who has access: Anyone. Paste the resulting /exec URL into
 * config/newsletter-poll.json -> "webapp_base".
 */

// The "Alambor Poll Votes" Sheet ID (the long string in its URL between /d/ and /edit).
// A published web app can't reliably use getActiveSpreadsheet(), so this is required.
var SHEET_ID = '1Z4Afm3vCNN0Wkm5FcGrphocSVG6FMlxWMHUQ0xN2QI8';
var SHEET_NAME = 'votes';

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};

    if (p.mode === 'results') {
      return ContentService
        .createTextOutput(JSON.stringify(tally_(p.ep)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ep = String(p.ep || '').replace(/[^0-9]/g, '');
    var vote = String(p.vote || '').toUpperCase().replace(/[^A-D]/g, '');
    if (!ep || !vote) {
      return page_('Hmm.', 'That link was malformed &mdash; no vote was recorded.');
    }
    var label = p.l ? decodeURIComponent(p.l) : ('Option ' + vote);
    var who = p.who ? decodeURIComponent(p.who) : '';

    sheet_().appendRow([new Date(), 'E' + ep, vote, label, who]);
    return page_('Vote counted!',
      'You voted <b>' + escapeHtml_(label) + '</b> for <b>E' + ep + '</b>.<br>Thanks for playing.');
  } catch (err) {
    return page_('Something broke', 'Could not record the vote (' + escapeHtml_(String(err)) +
      '). Most likely SHEET_ID is empty in the script.');
  }
}

function sheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['timestamp', 'episode', 'vote', 'label', 'who']);
  }
  return sh;
}

function tally_(ep) {
  var key = 'E' + String(ep || '').replace(/[^0-9]/g, '');
  var rows = sheet_().getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === key) {
      var v = rows[i][2];
      out[v] = (out[v] || 0) + 1;
    }
  }
  return out;
}

function page_(title, body) {
  var html =
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:Georgia,serif;max-width:460px;margin:12vh auto;padding:0 24px;' +
    'text-align:center;color:#23211c;">' +
    '<div style="font-size:42px;color:#a8842c;line-height:1;">&#11045;</div>' +
    '<h1 style="font-size:25px;margin:.4em 0;">' + title + '</h1>' +
    '<p style="font-size:18px;line-height:1.5;">' + body + '</p>' +
    '<p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#a8842c;">' +
    'The Alambor Chronicle</p></div>';
  return HtmlService.createHtmlOutput(html);
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
