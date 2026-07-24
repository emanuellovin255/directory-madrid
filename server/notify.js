/* =========================================================================
   notify.js — Notificare best-effort a unui lead nou (cerere de presupuesto).

   Toate canalele sunt OPȚIONALE și se activează prin variabile de mediu. Dacă
   niciunul nu e configurat, `notifyLead` e un no-op: lead-ul rămâne oricum în
   baza de date și în inbox-ul din /admin. Fără dependențe — folosește `fetch`
   (global în Node 18+/24). Fiecare apel are timeout, ca un webhook lent să nu
   blocheze răspunsul către vizitator.

   Env suportate:
     LEADS_WEBHOOK_URL      → POST JSON generic (Zapier / Make / n8n / Slack / Discord)
     TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID → mesaj pe Telegram
     RESEND_API_KEY + LEADS_EMAIL_TO [+ LEADS_EMAIL_FROM] → email via Resend
   ========================================================================= */
'use strict';

function fmtLead(lead, siteName) {
  return [
    `Nuevo presupuesto — ${siteName || 'Directorio'}`,
    lead.businessName ? `Negocio: ${lead.businessName}` : null,
    lead.context ? `Página: ${lead.context}` : null,
    `Nombre: ${lead.name}`,
    lead.phone ? `Teléfono: ${lead.phone}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.message ? `Mensaje: ${lead.message}` : null,
    lead.source_url ? `URL: ${lead.source_url}` : null,
  ].filter(Boolean).join('\n');
}

async function postJson(url, body, headers) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    return res.ok;
  } catch { return false; } finally { clearTimeout(t); }
}

/* Trimite notificarea pe toate canalele configurate. Nu aruncă niciodată —
   întoarce un rezumat { sent, channels }. */
async function notifyLead(lead, opts) {
  opts = opts || {};
  const text = fmtLead(lead, opts.siteName);
  const jobs = [];

  if (process.env.LEADS_WEBHOOK_URL)
    jobs.push(postJson(process.env.LEADS_WEBHOOK_URL, { type: 'lead', text, lead }));

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
    jobs.push(postJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }));

  if (process.env.RESEND_API_KEY && process.env.LEADS_EMAIL_TO)
    jobs.push(postJson('https://api.resend.com/emails', {
      from: process.env.LEADS_EMAIL_FROM || 'Leads <onboarding@resend.dev>',
      to: [process.env.LEADS_EMAIL_TO],
      subject: `Nuevo presupuesto${lead.businessName ? ' — ' + lead.businessName : ''}`,
      text,
    }, { authorization: 'Bearer ' + process.env.RESEND_API_KEY }));

  if (!jobs.length) return { sent: 0, channels: 0 };
  const results = await Promise.allSettled(jobs);
  return { sent: results.filter(r => r.status === 'fulfilled' && r.value).length, channels: jobs.length };
}

module.exports = { notifyLead };
