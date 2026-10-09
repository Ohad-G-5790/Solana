/**
 * Greenroom "demo version" sign-ups into this Google Sheet.
 *
 * In the sheet: Extensions → Apps Script, replace the code with this file,
 * then Deploy → New deployment → type "Web app", Execute as "Me",
 * Who has access "Anyone" → Deploy, allow access, and copy the web app URL
 * (https://script.google.com/macros/s/…/exec). That URL is the dashboard's
 * NEXT_PUBLIC_SIGNUP_URL (repository variable GREENROOM_SIGNUP_URL).
 *
 * The dashboard POSTs `email` and `source`; each sign-up becomes one row:
 * time, email, source. Repeated emails are added once.
 */
function doPost(e) {
  var email = String((e && e.parameter && e.parameter.email) || "").trim().toLowerCase();
  var source = String((e && e.parameter && e.parameter.source) || "").slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(["Time", "Email", "Source"]);
    var emails = sheet.getLastRow() > 1 ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); }) : [];
    if (emails.indexOf(email) === -1) sheet.appendRow([new Date(), email, source]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
