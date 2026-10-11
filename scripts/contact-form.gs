/**
 * Portfolio contact form → your Gmail inbox.
 *
 * A Google Apps Script web app. The Contact form on sompande1007.github.io
 * posts each message here, and this script emails it to the Google account
 * that deployed it, with the visitor's address as reply-to, so "Reply" in
 * Gmail answers them directly. Nothing else is stored.
 *
 * Deploy: Deploy → New deployment → Web app
 *   Execute as:      Me
 *   Who has access:  Anyone
 * then paste the web app URL into the form's data-endpoint in index.html.
 */

const MAX_PER_HOUR = 20; // a ceiling against floods; real use is far below

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Bots: a hidden field people never see, and a form filled in faster
    // than a person could. Pretend it worked so they don't retry.
    if (p.website) return reply({ ok: true });
    if (Number(p.elapsed || 0) < 3000) return reply({ ok: true });

    const name = clean(p.name, 100);
    const email = clean(p.email, 200);
    const message = clean(p.message, 5000);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 2) {
      return reply({ ok: false, error: "invalid" });
    }

    // A simple hourly ceiling across all senders.
    const cache = CacheService.getScriptCache();
    const sent = Number(cache.get("sent") || 0);
    if (sent >= MAX_PER_HOUR) return reply({ ok: false, error: "busy" });
    cache.put("sent", String(sent + 1), 3600);

    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      replyTo: email,
      name: "Portfolio contact",
      subject: "Portfolio: message from " + name,
      body: message + "\n\n— " + name + " <" + email + ">\nSent from the contact form on sompande1007.github.io",
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: "server" });
  }
}

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
