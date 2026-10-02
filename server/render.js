/* =========================================================================
   render.js — SSR cu template literals (fără dependențe). Generează paginile
   publice indexabile (SEO): home, categorie, distrito, barrio, metro, ficha
   de negocio, căutare, sitemap, robots. Reutilizează stilurile din
   /assets/css/styles.css. Fiecare pagină: <title>/meta/canonical/H1/JSON-LD
   unice + internal linking dens.
   ========================================================================= */
'use strict';
const DB = require('./db');
const PRO = require('./content/profesionales');
const { CATEGORIAS } = require('./content/categorias');
const { DISTRITOS } = require('./content/distritos');
const { PRECIOS, UPDATED: PRECIOS_UPDATED } = require('./content/precios');
const { GUIAS } = require('./content/guias');
const precioBySlug = slug => PRECIOS.find(x => x.slug === slug) || null;
const guiaBySlug = slug => GUIAS.find(x => x.slug === slug) || null;

const SITE = {
  name: 'Profesionales Madrid',
  brandA: 'Profesionales',
  brandB: 'Madrid',
  tagline: 'El directorio de profesionales del hogar, reformas y talleres en Madrid',
  // Email de contacto general (LSSI art. 10). Para los clientes que buscan
  // profesionales NO mostramos teléfono propio: solo formularios.
  email: process.env.SITE_EMAIL || 'hola@profesionalesmadrid.es',
  // Teléfono/WhatsApp SOLO para profesionales que quieren aparecer (alta,
  // reclamar ficha, historias). Es la misma línea comercial que Listo247.
  proPhone: process.env.PRO_PHONE || '+34 663 291 101',
  listo247: 'https://listo247.es',
};

/* Página de listado indexable a partir de MIN_LISTING empresas. Por debajo:
   noindex,follow, fuera del sitemap y sin enlaces internos hacia ella. */
const MIN_LISTING = Math.max(1, parseInt(process.env.MIN_LISTING, 10) || 3);

/* Tipo schema.org más específico por servicio (por la categoría raíz). */
const BIZ_TYPE = {
  fontaneros: 'Plumber', electricistas: 'Electrician', cerrajeros: 'Locksmith',
  climatizacion: 'HVACBusiness', reformas: 'GeneralContractor', mudanzas: 'MovingCompany',
  talleres: 'AutoRepair', 'control-de-plagas': 'HomeAndConstructionBusiness',
};

/* ------------------------------ Helpers ------------------------------ */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const attr = esc;
function abs(ctx, p) { return (ctx && ctx.origin ? ctx.origin : '') + p; }
function tel(s) { return String(s || '').replace(/[^\d+]/g, ''); }
function titleCase(s) { return String(s || ''); }

/* Geo: distingue el distrito de la capital del municipio de la Comunidad, para
   redactar el copy correcto ("en el distrito de Salamanca" vs "en Móstoles"). */
function geoIn(d) { return d && d.kind === 'municipio' ? d.name : 'el distrito de ' + (d ? d.name : ''); }
function zonaName(slug) { const z = (DB.ZONES || []).find(x => x.slug === slug); return z ? z.name : ''; }

/* „reformas, fontaneros, electricistas, … y talleres" — sale de las categorías
   reales (no de una lista fija), así el copy no se queda viejo al añadir servicios.
   `max` recorta para títulos/meta descriptions: „…, cerrajeros y más". */
function ucFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function servicesPhrase(max) {
  const names = DB.getCategoryTree().map(c => c.name.toLowerCase());
  if (max && names.length > max) return names.slice(0, max).join(', ') + ' y más';
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
}

/* Enlaces de profesionales (alta / reclamar ficha): teléfono y WhatsApp con el
   mensaje ya escrito. Nunca se muestran en las páginas para clientes. */
function proWaLink(text) {
  return 'https://wa.me/' + String(SITE.proPhone).replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
}
function listo247Link(campaign, path) {
  return SITE.listo247 + (path || '/') + '?utm_source=profesionalesmadrid&utm_medium=referral&utm_campaign=' + encodeURIComponent(campaign || 'directorio');
}

/* Cobertura (nº de empresas por página de listado), cacheada en DB.coverage().
   `covCount('catMun', 'fontaneros|salamanca')` → 0 si no hay. */
function covCount(map, key) { const m = DB.coverage()[map]; return (m && m.get(key)) || 0; }
/* Filtra enlaces a páginas de listado con al menos MIN_LISTING empresas y les
   pone el contador. `items` = [{ name, href, n }]. */
function covered(items) { return (items || []).filter(x => x.n >= MIN_LISTING).map(x => ({ name: x.name, href: x.href, count: x.n })); }
function hasMetroData() { return DB.coverage().metro.size > 0; }
/* Insignias honestas: „Verificado" solo para fichas reclamadas y comprobadas;
   „Patrocinado" para los destacados de pago (LSSI art. 20: publicidad identificable). */
function verifiedBadge() { return `<span class="badge-verified" title="Ficha reclamada por el negocio y verificada por nuestro equipo">${icon('check')}Verificado</span>`; }
function sponsoredBadge() { return `<span class="badge-featured" title="Espacio patrocinado">${icon('star')}Patrocinado</span>`; }

function svgPlaceholder(name, label) {
  // Primera letra/cifra de cada palabra (no `w[0]`: con un emoji delante sale medio
  // par sustituto y encodeURIComponent lanza URIError → la página daba 500).
  const initials = String(name || '?').split(/\s+/).map(w => (w.match(/[\p{L}\p{N}]/u) || [''])[0])
    .filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8102e"/><stop offset="1" stop-color="#7a0a1c"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><text x="50%" y="46%" fill="rgba(255,255,255,.95)" font-family="Arial,Helvetica,sans-serif" font-size="120" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(initials)}</text><text x="50%" y="73%" fill="rgba(255,255,255,.72)" font-family="Arial,Helvetica,sans-serif" font-size="24" letter-spacing="3" text-anchor="middle">${esc(String(label || SITE.name).toUpperCase())}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function bizPhoto(b) {
  if (b.photo) return b.photo;
  const primary = (b.categories || []).find(c => !c.parent_id) || (b.categories || [])[0];
  return svgPlaceholder(b.name, primary ? primary.name : SITE.name);
}
/* Imaginea de copertă a cardului: prima poză de servicii, apoi `photo`, apoi placeholder. */
function bizCover(b) {
  if (b.photos && b.photos.length) return b.photos[0];
  return bizPhoto(b);
}
function bizLogo(b) { return b.logo || null; }
function fmtInt(n) { return Number(n || 0).toLocaleString('es-ES'); }
function reviewsLabel(n) { return `${fmtInt(n)} ${Number(n) === 1 ? 'reseña' : 'reseñas'}`; }
/* Horario „gol" (toate zilele Cerrado/necompletate, ex. leads importate) → nu-l afișăm. */
function hasHours(h) { return !!h && Object.values(h).some(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'cerrado'); }

/* Imagen de la tarjeta de servicio (home). Las categorías clásicas usan foto
   real (/assets/img/cat-<slug>.jpg); las nuevas usan una ilustración SVG
   embebida y coherente con el diseño (sin ficheros binarios). */
const CAT_PHOTO = new Set(['reformas', 'fontaneros', 'electricistas', 'climatizacion', 'cerrajeros', 'control-de-plagas', 'mudanzas', 'talleres']);
const CAT_ART = {
  'control-de-plagas': {
    c1: '#16a34a', c2: '#065f46',
    icon: `<ellipse cx="450" cy="258" rx="56" ry="80"/><circle cx="450" cy="170" r="30"/><path d="M436 150 Q420 120 402 120 M464 150 Q480 120 498 120"/><path d="M394 216 L344 194 M392 258 L340 258 M394 300 L344 322"/><path d="M506 216 L556 194 M508 258 L560 258 M506 300 L556 322"/><path d="M450 190 L450 330"/>`,
  },
  'mudanzas': {
    c1: '#2563eb', c2: '#1e3a8a',
    icon: `<rect x="330" y="196" width="168" height="118" rx="10"/><path d="M498 232 L548 232 L576 268 L576 314 L498 314 Z"/><circle cx="396" cy="332" r="26"/><circle cx="532" cy="332" r="26"/>`,
  },
  'talleres': {
    c1: '#ea580c', c2: '#7c2d12',
    icon: `<circle cx="450" cy="250" r="62"/><circle cx="450" cy="250" r="22"/><path d="M512 250 L532 250 M493.8 293.8 L508 308 M450 312 L450 332 M406.2 293.8 L392 308 M388 250 L368 250 M406.2 206.2 L392 192 M450 188 L450 168 M493.8 206.2 L508 192"/>`,
  },
};
function catIllustration(slug) {
  const a = CAT_ART[slug] || { c1: '#c8102e', c2: '#7a0a1c', icon: '' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/></linearGradient><radialGradient id="h" cx="0.3" cy="0.24" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.20"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="900" height="600" fill="url(#g)"/><rect width="900" height="600" fill="url(#h)"/><g fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">${a.icon}</g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function catTileImg(slug) {
  return CAT_PHOTO.has(slug) ? `/assets/img/cat-${slug}.jpg` : catIllustration(slug);
}

/* --------------------------- Componente ------------------------------ */
function icon(name) {
  const P = {
    pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z"/>',
    phone: '<path d="M4 5c0 9 6 15 15 15l2-3-4-2-2 2c-3-1.5-6.5-5-8-8l2-2-2-4z"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    metro: '<circle cx="12" cy="12" r="8"/><path d="M8 15l2-6 2 3 2-3 2 6"/>',
    tools: '<path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2 2-2-.5-.5-2 2-2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    shield: '<path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h6M9.5 15.5h6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M15.5 5.6a3.2 3.2 0 010 5.8M17.5 14.8c1.8.6 3 2.2 3.4 4.7"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.2 9.5"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    whatsapp: '<path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1112 19.8a7.7 7.7 0 01-3.9-1z"/><path d="M9.2 8.6c.3 2.6 2.4 4.9 5.1 5.4l1-1.1-1.6-.9-.7.6c-.9-.4-1.7-1.2-2.1-2.1l.6-.7-.8-1.7z"/>',
  };
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
function trustBadge(ic, title, sub) {
  return `<div class="trust-badge"><span class="trust-ic">${icon(ic)}</span><span class="trust-txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`;
}

/* Formular „Solicitar presupuesto" → POST /api/leads (gestionat de site.js).
   Reutilizabil pe ficha (businessId setat) și pe paginile de listare
   (context = serviciu/zonă). Are honeypot (câmpul .lead-hp) anti-boți. */
function leadForm(opts) {
  opts = opts || {};
  const title = opts.title || 'Solicita presupuesto gratis';
  const sub = opts.sub || 'Cuéntanos qué necesitas y te ponemos en contacto con un profesional de la zona.';
  return `<section class="lead-cta${opts.compact ? ' lead-cta-compact' : ''}">
      <div class="lead-cta-head">
        <span class="lead-cta-ic">${icon('doc')}</span>
        <div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
      </div>
      <form class="lead-form" data-lead-form novalidate>
        ${opts.businessId ? `<input type="hidden" name="businessId" value="${attr(opts.businessId)}">` : ''}
        <input type="hidden" name="context" value="${attr(opts.context || '')}">
        <div class="lead-hp" aria-hidden="true"><label>No rellenar<input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
        <div class="lead-row">
          <label class="lead-field"><span>Nombre*</span><input name="name" type="text" required autocomplete="name" placeholder="Tu nombre"></label>
          <label class="lead-field"><span>Teléfono</span><input name="phone" type="tel" autocomplete="tel" placeholder="600 000 000"></label>
          <label class="lead-field"><span>Email</span><input name="email" type="email" autocomplete="email" placeholder="tu@email.com"></label>
        </div>
        <label class="lead-field lead-field-full"><span>¿Qué necesitas?</span><textarea name="message" rows="3" placeholder="Describe brevemente el trabajo…"></textarea></label>
        <div class="lead-actions">
          <button type="submit" class="btn btn-primary">Solicitar presupuesto</button>
          <span class="lead-hint">Indica teléfono o email · Gratis y sin compromiso</span>
        </div>
        <p class="lead-note">Al enviar aceptas la <a href="/privacidad">política de privacidad</a>.</p>
        <div class="lead-feedback" role="status" aria-live="polite" hidden></div>
      </form>
    </section>`;
}

/* Formulario genérico para profesionales y contacto → POST /api/leads (site.js).
   `fields`: [{ name, label, type, required, placeholder, full, rows, min, options, html, value }].
   name/phone/email/message van como campos del lead; el resto, en `payload`. */
function proForm(o) {
  const field = f => {
    const req = f.required ? ' required' : '';
    const cls = 'lead-field' + (f.full ? ' lead-field-full' : '');
    const lbl = `<span>${esc(f.label)}${f.required ? '*' : ''}</span>`;
    if (f.type === 'textarea') {
      return `<label class="${cls}">${lbl}<textarea name="${attr(f.name)}" rows="${f.rows || 3}" placeholder="${attr(f.placeholder || '')}"${f.min ? ` data-min="${f.min}"` : ''}${req}></textarea>${f.min ? `<small class="lead-counter" aria-live="polite">0 / ${f.min} caracteres mínimo</small>` : ''}</label>`;
    }
    if (f.type === 'select') {
      return `<label class="${cls}">${lbl}<select name="${attr(f.name)}"${req}>${f.options.map(op => `<option value="${attr(op.value)}"${op.selected ? ' selected' : ''}>${esc(op.label)}</option>`).join('')}</select></label>`;
    }
    if (f.type === 'checkbox') {
      return `<label class="lead-check lead-field-full"><input type="checkbox" name="${attr(f.name)}" value="si"${req}><span>${f.html || esc(f.label)}</span></label>`;
    }
    return `<label class="${cls}">${lbl}<input name="${attr(f.name)}" type="${f.type || 'text'}" value="${attr(f.value || '')}" placeholder="${attr(f.placeholder || '')}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ''}${req}></label>`;
  };
  return `<form class="lead-form pro-form" data-lead-form data-ok="${attr(o.ok || '')}" novalidate>
      <input type="hidden" name="kind" value="${attr(o.kind)}">
      ${o.businessId ? `<input type="hidden" name="businessId" value="${attr(o.businessId)}">` : ''}
      <input type="hidden" name="context" value="${attr(o.context || '')}">
      <div class="lead-hp" aria-hidden="true"><label>No rellenar<input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
      <div class="lead-row lead-grid">${o.fields.map(field).join('')}</div>
      <div class="lead-actions">
        <button type="submit" class="btn btn-primary">${esc(o.submit || 'Enviar')}</button>
        ${o.hint ? `<span class="lead-hint">${esc(o.hint)}</span>` : ''}
      </div>
      <p class="lead-note">Al enviar aceptas la <a href="/privacidad">política de privacidad</a>.</p>
      <div class="lead-feedback" role="status" aria-live="polite" hidden></div>
      ${o.okHtml ? `<div class="lead-ok-extra" hidden>${o.okHtml}</div>` : ''}
    </form>`;
}
/* Teléfono y WhatsApp comercial: SOLO en bloques para profesionales. */
function proContact(waText) {
  return `<p class="pro-contact">¿Prefieres hablar? Llámanos al <a href="tel:${attr(tel(SITE.proPhone))}">${esc(SITE.proPhone.replace(/^\+34\s*/, ''))}</a> o escríbenos por <a href="${attr(proWaLink(waText))}" target="_blank" rel="noopener">WhatsApp</a>.</p>`;
}
const CLAIM_FIELDS = [
  { name: 'name', label: 'Nombre y apellidos', required: true, autocomplete: 'name' },
  { name: 'cargo', label: 'Tu relación con el negocio', type: 'select', options: [
    { value: 'Propietario/a', label: 'Soy el propietario/a', selected: true },
    { value: 'Gerente', label: 'Soy gerente o encargado/a' },
    { value: 'Empleado/a autorizado', label: 'Trabajo allí y tengo autorización' },
  ] },
  { name: 'phone', label: 'Teléfono', type: 'tel', required: true, autocomplete: 'tel', placeholder: '600 000 000' },
  { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', placeholder: 'tu@email.com' },
  { name: 'descripcion', label: 'Describe tu negocio', type: 'textarea', rows: 5, required: true, full: true, min: DB.MIN_ABOUT,
    placeholder: 'Qué hacéis, desde cuándo, en qué zonas trabajáis y qué os diferencia. Es el texto que verán los clientes en tu ficha.' },
  { name: 'servicios', label: 'Servicios principales', full: true, placeholder: 'Ej.: desatascos, reparación de fugas, cambio de calentador' },
  { name: 'zonas', label: 'Zonas donde trabajas', placeholder: 'Ej.: Retiro, Moratalaz y Vallecas' },
  { name: 'horario', label: 'Horario', placeholder: 'Ej.: L-V 8:00-20:00, urgencias 24 h' },
  { name: 'web', label: 'Web (si tienes)', type: 'url', full: true, placeholder: 'https://' },
  { name: 'titular', type: 'checkbox', required: true, html: 'Soy el titular del negocio o tengo su autorización para gestionar esta ficha.' },
];
/* Bloque «¿Es tu negocio?» en la ficha (solo si aún no está verificada). Va en
   la propia ficha, no en una URL aparte: 12k páginas de formulario rastreables
   no aportarían nada. */
function claimBlock(b, primary) {
  if (b.claimed) return '';
  const oficio = primary ? primary.name.toLowerCase() : 'tu oficio';
  return `<details class="claim" id="reclamar">
      <summary>
        <span class="claim-ic">${icon('check')}</span>
        <span class="claim-sum"><b>¿Es tu negocio? Reclama esta ficha gratis</b><small>Añade tu descripción y tus servicios, consigue la insignia ✓ Verificado y sal por delante de las fichas sin verificar.</small></span>
      </summary>
      <div class="claim-body">
        ${proForm({
          kind: 'claim', businessId: b.id, context: 'Reclamar ficha: ' + b.name, fields: CLAIM_FIELDS,
          submit: 'Enviar reclamación', hint: 'Gratis · Sin permanencia',
          ok: 'Recibido. Te llamaremos al teléfono de la ficha para comprobar que eres tú y después publicaremos tus datos.',
          okHtml: `<div class="claim-next"><p><b>Mientras tanto:</b> ¿sabes en qué puesto sales en Google Maps cuando alguien de tu zona busca ${esc(oficio)}?</p><a class="btn btn-ghost btn-sm" href="${attr(listo247Link('reclamar-ficha'))}" target="_blank" rel="noopener">Pide tu análisis gratis a Listo247</a></div>`,
        })}
        ${proContact(`Hola, quiero reclamar la ficha de ${b.name} en Profesionales Madrid.`)}
      </div>
    </details>`;
}
/* Insignia para la web del negocio verificado (SVG servido en /insignia/<id>.svg). */
function renderBadgeSvg(b) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="236" height="64" viewBox="0 0 236 64" role="img" aria-label="Verificado en ${attr(SITE.name)}"><title>${esc(b.name)} · Verificado en ${esc(SITE.name)}</title><rect x="0.5" y="0.5" width="235" height="63" rx="12" fill="#ffffff" stroke="#e6eaf1"/><rect x="11" y="12" width="40" height="40" rx="9" fill="#c8102e"/><g fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 45.5V28.3L31 20.1l12.5 8.2v17.2"/><path d="M26.6 45.5v-8.1h8.8v8.1"/></g><text x="62" y="28" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" letter-spacing="0.6" fill="#047857">✓ VERIFICADO</text><text x="62" y="46" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#0f172a">${esc(SITE.name)}</text></svg>`;
}
/* Código HTML de la insignia (lo copia el admin y se lo manda al negocio). */
function badgeSnippet(ctx, b) {
  const url = abs(ctx, '/negocio/' + b.id);
  return `<a href="${url}" title="${attr(b.name)} en ${attr(SITE.name)}"><img src="${abs(ctx, '/insignia/' + encodeURIComponent(b.id) + '.svg')}" alt="Verificado en ${attr(SITE.name)}" width="236" height="64"></a>`;
}
/* Bloque FAQ visible + su JSON-LD (FAQPage). */
function faqSection(title, items) {
  if (!items || !items.length) return '';
  return `<section class="faq"><h2>${esc(title)}</h2>${items.map(f => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>`;
}
function faqJsonLd(items) {
  if (!items || !items.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}
/* Texto en párrafos (separados por línea en blanco), escapado. */
function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
}

function businessCard(ctx, b) {
  const tags = (b.categories || []).slice(0, 3).map(c => `<span class="tag">${esc(c.name)}</span>`).join('');
  const more = (b.categories || []).length > 3 ? `<span class="tag tag-more">+${b.categories.length - 3}</span>` : '';
  const href = '/negocio/' + attr(b.id);
  return `<article class="card">
      <a class="card-media" href="${href}">
        ${b.featured ? sponsoredBadge() : ''}
        ${b.rating ? `<span class="card-rating">${icon('star')}${b.rating.toFixed(1)}</span>` : ''}
        ${bizLogo(b) ? `<span class="card-logo"><img src="${attr(bizLogo(b))}" alt="${attr(b.name)} logo" loading="lazy" /></span>` : ''}
        <img class="card-cover" src="${attr(bizCover(b))}" alt="${attr(b.name)}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3 class="card-title"><a href="${href}">${esc(b.name)}</a></h3>
        ${b.claimed || DB.storyBusinessIds().has(b.id) ? `<div class="card-badges">${b.claimed ? verifiedBadge() : ''}${DB.storyBusinessIds().has(b.id) ? '<span class="badge-story">Historia</span>' : ''}</div>` : ''}
        <span class="card-zone">${icon('pin')}${esc(b.zone || 'Madrid')}</span>
        ${!b.rating && b.reviews ? `<span class="card-reviews">${icon('star')}${reviewsLabel(b.reviews)}</span>` : ''}
        <div class="card-tags">${tags}${more}</div>
        <div class="card-foot"><a class="card-cta" href="${href}">Ver ficha ${icon('arrow')}</a></div>
      </div>
    </article>`;
}
function grid(ctx, businesses, emptyMsg) {
  if (!businesses.length) return `<div class="empty"><p>${esc(emptyMsg || 'Aún no hay empresas listadas en esta zona.')}</p><p class="empty-sub">¿Eres profesional de la zona? <a href="/profesionales">Aparece aquí gratis</a>.</p></div>`;
  return `<div class="grid">${businesses.map(b => businessCard(ctx, b)).join('')}</div>`;
}
/* ----------------------------- Paginare ------------------------------ */
function pageHref(baseHref, p) {
  if (p <= 1) return baseHref;
  return baseHref + (baseHref.indexOf('?') >= 0 ? '&' : '?') + 'page=' + p;
}
function paginationNav(ctx, pg) {
  if (!pg || pg.pages <= 1) return '';
  const { page, pages, baseHref } = pg;
  const win = 2;
  const nums = new Set([1, pages, page]);
  for (let i = page - win; i <= page + win; i++) if (i >= 1 && i <= pages) nums.add(i);
  const sorted = [...nums].sort((a, b) => a - b);
  let prev = 0; const cells = [];
  sorted.forEach(p => {
    if (prev && p - prev > 1) cells.push('<span class="pg-gap">…</span>');
    cells.push(`<a class="pg-num${p === page ? ' is-current' : ''}" href="${attr(pageHref(baseHref, p))}"${p === page ? ' aria-current="page"' : ''}>${p}</a>`);
    prev = p;
  });
  const prevLink = page > 1 ? `<a class="pg-arrow pg-prev" rel="prev" href="${attr(pageHref(baseHref, page - 1))}">${icon('arrow')}<span>Anterior</span></a>` : '';
  const nextLink = page < pages ? `<a class="pg-arrow pg-next" rel="next" href="${attr(pageHref(baseHref, page + 1))}"><span>Siguiente</span>${icon('arrow')}</a>` : '';
  return `<nav class="pagination" aria-label="Paginación">${prevLink}<div class="pg-nums">${cells.join('')}</div>${nextLink}</nav>`;
}

function chipRow(title, links) {
  links = (links || []).filter(Boolean);
  if (!links.length) return '';
  return `<section class="linkset"><h2 class="linkset-title">${esc(title)}</h2><div class="chips">${links.map(l => `<a class="chip" href="${attr(l.href)}">${esc(l.name)}${l.count != null ? ` <b>${l.count}</b>` : ''}</a>`).join('')}</div></section>`;
}
/* Grupo de zona (home + índice /zonas): título enlazado + chips de lugares. */
function zonaGroup(title, anchor, items, total) {
  return `<div class="zona-group">
      <h3 class="zona-group-title"><a href="/zonas#${attr(anchor)}">${esc(title)}</a> <span class="zona-count">${total}</span></h3>
      <div class="chips">${items.map(x => `<a class="chip" href="/zona/${attr(x.slug)}">${esc(x.name)}${x.n != null ? ` <b>${x.n}</b>` : ''}</a>`).join('')}${total > items.length ? `<a class="chip chip-more" href="/zonas#${attr(anchor)}">+${total - items.length} más</a>` : ''}</div>
    </div>`;
}
function breadcrumb(ctx, items) {
  return `<nav class="breadcrumb" aria-label="Ruta"><ol>${items.map(it => `<li>${it.href ? `<a href="${attr(it.href)}">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`}</li>`).join('')}</ol></nav>`;
}
function jsonLdBreadcrumb(ctx, items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => Object.assign({ '@type': 'ListItem', position: i + 1, name: it.name }, it.href ? { item: abs(ctx, it.href) } : {})) };
}
function jsonLdItemList(ctx, businesses) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: businesses.length, itemListElement: businesses.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(ctx, '/negocio/' + b.id), name: b.name })) };
}

/* ------------------------ Header / Footer ---------------------------- */
function renderHeader(ctx) {
  const cats = DB.getCategoryTree();
  const distritos = DB.listDistritos();
  const zones = DB.listZones();
  const flagship = cats[0] ? cats[0].slug : 'reformas';
  // Solo especialidades con empresas suficientes: un menú en todas las páginas
  // que enlaza a páginas vacías gasta rastreo y decepciona al usuario.
  const megaServicios = cats.map(c => {
    const subs = c.children.filter(s => covCount('cat', s.slug) >= MIN_LISTING);
    return `
      <div class="mega-col">
        <a class="mega-head" href="/${attr(c.slug)}">${esc(c.name)}</a>
        ${subs.length ? `<ul>${subs.map(s => `<li><a href="/${attr(s.slug)}">${esc(s.name)}</a></li>`).join('')}</ul>` : ''}
      </div>`;
  }).join('');
  const CAP = 6;
  const withBiz = list => list.filter(d => covCount('muni', d.slug) >= MIN_LISTING);
  const megaCol = (title, href, items, total, unit) => `
      <div class="mega-col">
        <a class="mega-head" href="${attr(href)}">${esc(title)}</a>
        <ul>${items.slice(0, CAP).map(it => `<li><a href="/zona/${attr(it.slug)}">${esc(it.name)}</a></li>`).join('')}${total > CAP ? `<li><a class="mega-more" href="${attr(href)}">+${total - CAP} ${esc(unit)}</a></li>` : ''}</ul>
      </div>`;
  const capWithBiz = withBiz(distritos);
  const megaZonas = megaCol('Madrid capital', '/zonas#madrid', capWithBiz, capWithBiz.length, 'distritos')
    + zones.map(z => { const ms = withBiz(z.municipios); return ms.length ? megaCol(z.name, `/zonas#${z.slug}`, ms, ms.length, 'municipios') : ''; }).join('');
  return `<header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="${attr(SITE.name)} — inicio">
        <span class="brand-logo"><svg viewBox="0 0 24 24" class="brand-mark" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/></svg></span>
        <span class="brand-name">${esc(SITE.brandA)}<b> ${esc(SITE.brandB)}</b><span class="brand-sub">Hogar, reformas y talleres</span></span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Menú" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav" id="mainNav">
        <div class="nav-item has-mega">
          <a class="nav-link" href="/${attr(flagship)}" aria-haspopup="true">Servicios</a>
          <div class="mega"><div class="mega-grid">${megaServicios}</div></div>
        </div>
        <div class="nav-item has-mega">
          <a class="nav-link" href="/zonas" aria-haspopup="true">Zonas</a>
          <div class="mega mega-zonas"><div class="mega-grid">${megaZonas}</div><a class="mega-all" href="/zonas">Ver todas las zonas y los 179 municipios ${icon('arrow')}</a></div>
        </div>
        ${hasMetroData() ? '<a class="nav-link" href="/metro">Metro</a>' : ''}
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost btn-sm header-pro" href="/profesionales"><span class="header-pro-q">¿Eres profesional? </span><b>Alta gratis</b></a>
      </div>
    </div>
  </header>`;
}
function renderFooter(ctx) {
  const cats = DB.getCategoryTree();
  const zones = DB.listZones();
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-col footer-brand">
        <span class="brand-name">${esc(SITE.brandA)}<b> ${esc(SITE.brandB)}</b></span>
        <p>${esc(SITE.tagline)}.</p>
        <a class="footer-mail" href="/contacto">${icon('mail')}<span>Escríbenos</span></a>
      </div>
      <div class="footer-col"><h4>Servicios</h4><ul>${cats.map(c => `<li><a href="/${attr(c.slug)}">${esc(c.name)} en Madrid</a></li>`).join('')}</ul></div>
      <div class="footer-col"><h4>Zonas</h4><ul>
        <li><a href="/zonas#madrid">Madrid capital</a></li>
        ${zones.map(z => `<li><a href="/zonas#${attr(z.slug)}">${esc(z.name)}</a></li>`).join('')}
        <li><a href="/zonas"><b>Ver los 179 municipios</b></a></li>
      </ul></div>
      <div class="footer-col"><h4>Precios y guías</h4><ul>
        <li><a href="/precios">Precios orientativos</a></li>
        ${PRECIOS.slice(0, 4).map(pr => `<li><a href="/precios/${attr(pr.slug)}">${esc(pr.h1.replace(/^¿Cuánto (cuesta|cobra) /, '').replace(/ en Madrid\?$/, '').replace(/\?$/, ''))}</a></li>`).join('')}
        <li><a href="/guias">Guías</a></li>
      </ul></div>
      <div class="footer-col"><h4>Profesionales</h4><ul>
        <li><a href="/profesionales">Aparece gratis</a></li>
        <li><a href="/profesionales#buscar-ficha">Reclama tu ficha</a></li>
        ${DB.countStories({ status: 'published' }) ? '<li><a href="/historias">Historias de profesionales</a></li>' : ''}
        <li><a href="/sobre-nosotros">Cómo funciona el directorio</a></li>
        <li><a href="/contacto">Contacto</a></li>
        ${hasMetroData() ? '<li><a href="/metro">Buscar por metro</a></li>' : ''}
      </ul></div>
    </div>
    <div class="container footer-trust">
      ${trustBadge('check', 'Fichas verificadas', 'Las marcadas con ✓ las revisamos con el negocio')}
      ${trustBadge('phone', 'Contacto directo', 'Hablas con el profesional, sin intermediarios')}
      ${trustBadge('doc', 'Presupuesto sin compromiso', 'Pídelo gratis desde cualquier ficha')}
      ${trustBadge('lock', 'Cumplimiento del RGPD', 'Tus datos protegidos')}
    </div>
    <div class="container footer-legal">
      <p>© ${new Date().getFullYear()} ${esc(SITE.name)}. Un proyecto de <a href="${attr(SITE.listo247)}/">Listo247</a>.</p>
      <nav class="footer-legal-links" aria-label="Legal">
        <a href="/aviso-legal">Aviso legal</a>
        <a href="/privacidad">Política de privacidad</a>
        <a href="/cookies">Política de cookies</a>
        <a href="/condiciones">Condiciones de uso</a>
      </nav>
    </div>
  </footer>`;
}

/* Analytics (Plausible o GA4) — se cargan SOLO tras el consentimiento del banner
   de cookies (RGPD). Se activan por variables de entorno; sin ellas, no se emite
   ningún script (el banner sigue siendo honesto: solo promete lo que existe). */
function analyticsSnippet() {
  const plausible = process.env.PLAUSIBLE_DOMAIN || '';
  const ga4 = process.env.GA4_ID || '';
  if (!plausible && !ga4) return '';
  const loader = plausible
    ? `var s=document.createElement('script');s.defer=true;s.setAttribute('data-domain',${JSON.stringify(plausible)});s.src='https://plausible.io/js/script.js';document.head.appendChild(s);`
    : `var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+${JSON.stringify(ga4)};document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga4)});`;
  return `<script>(function(){window.__loadAnalytics=function(){if(window.__anaLoaded)return;window.__anaLoaded=true;${loader}};try{if(localStorage.getItem('rm_cookie_consent')==='accept')window.__loadAnalytics();}catch(e){}})();</script>`;
}

/* Banner de consentimiento de cookies (RGPD). Privacy-first: solo se guarda
   la decisión del usuario; sin cookies analíticas hasta que las acepte. */
function cookieBanner() {
  return `<div class="cookie-banner" id="cookieBanner" role="dialog" aria-live="polite" aria-label="Aviso de cookies" hidden>
    <div class="container cookie-inner">
      <p class="cookie-txt">Usamos cookies propias necesarias para el funcionamiento del sitio y, con tu permiso, cookies analíticas para mejorarlo. Consulta la <a href="/cookies">Política de cookies</a>.</p>
      <div class="cookie-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cookie="reject">Rechazar</button>
        <button type="button" class="btn btn-primary btn-sm" data-cookie="accept">Aceptar</button>
      </div>
    </div>
  </div>
  <script>(function(){try{var K='rm_cookie_consent',b=document.getElementById('cookieBanner');if(!b)return;if(!localStorage.getItem(K))b.hidden=false;b.addEventListener('click',function(e){var t=e.target.closest('[data-cookie]');if(!t)return;var v=t.getAttribute('data-cookie');localStorage.setItem(K,v);b.hidden=true;if(v==='accept'&&window.__loadAnalytics)window.__loadAnalytics();});}catch(e){}})();</script>`;
}

/* ------------------------------ Layout ------------------------------- */
/* La organización detrás del directorio (una vez por página; el resto de
   bloques la referencian por @id). Listo247 figura como matriz: es público. */
function orgJsonLd(ctx) {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': abs(ctx, '/#organization'),
    name: SITE.name, url: abs(ctx, '/'), logo: abs(ctx, '/assets/img/logo-512.png'), email: SITE.email,
    parentOrganization: { '@type': 'Organization', name: 'Listo247', url: SITE.listo247 + '/' },
  };
}
function renderLayout(ctx, page) {
  const canonical = page.canonical || abs(ctx, ctx.path || '/');
  const jsonLd = [orgJsonLd(ctx)].concat(page.jsonLd || []).filter(Boolean);
  const ogImage = page.ogImage || abs(ctx, '/assets/img/og-profesionales-madrid.jpg');  // imagen social por defecto (1200×630)
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${attr(page.description || '')}">
<link rel="canonical" href="${attr(canonical)}">
${page.prev ? `<link rel="prev" href="${attr(page.prev)}">` : ''}
${page.next ? `<link rel="next" href="${attr(page.next)}">` : ''}
<meta name="robots" content="${page.robots || 'index,follow'}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:title" content="${attr(page.title)}">
<meta property="og:description" content="${attr(page.description || '')}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(page.title)}">
<meta name="twitter:description" content="${attr(page.description || '')}">
<meta name="twitter:image" content="${attr(ogImage)}">
<meta name="theme-color" content="#c8102e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/favicon.svg">
<link rel="mask-icon" href="/favicon.svg" color="#c8102e">
<link rel="stylesheet" href="/assets/css/styles.css">
${jsonLd.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body class="${page.bodyClass || ''}">
${renderHeader(ctx)}
<main id="contenido">${page.body}</main>
${renderFooter(ctx)}
${analyticsSnippet()}
${cookieBanner()}
${page.inlineData ? `<script>window.__RM__=${JSON.stringify(page.inlineData)};</script>` : ''}
<script src="/assets/js/ui.js"></script>
<script src="/assets/js/api.js"></script>
<script src="/assets/js/site.js"></script>
</body>
</html>`;
}

/* ------------------------- Pagini de listare ------------------------- */
function listingPage(ctx, opts) {
  const businesses = opts.businesses;
  const pg = opts.pagination;
  const total = opts.total != null ? opts.total : businesses.length;
  const hasBiz = businesses.length > 0;
  const lcFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;  // păstrează majuscula la nume proprii (ex. „en Vicálvaro")
  const leadBlock = opts.hideLeadForm ? '' : leadForm({
    context: opts.h1,
    compact: hasBiz,
    title: hasBiz ? '¿No encuentras lo que buscas?' : 'Pide presupuesto sin compromiso',
    sub: hasBiz
      ? 'Pide presupuesto gratis y te ponemos en contacto con un profesional de la zona.'
      : `¿Buscas ${lcFirst(opts.h1 || 'un profesional')}? Déjanos tu solicitud y te ponemos en contacto con profesionales de la zona, sin compromiso.`,
  });
  const body = `
    <div class="container">
      ${breadcrumb(ctx, opts.crumbs)}
      <header class="page-head">
        <h1>${esc(opts.h1)}</h1>
        ${opts.intro ? `<p class="page-intro">${esc(opts.intro)}</p>` : ''}
        <p class="page-count">${total} ${total === 1 ? 'empresa' : 'empresas'}${pg && pg.pages > 1 ? ` · página ${pg.page} de ${pg.pages}` : ''}</p>
      </header>
      ${opts.subchips || ''}
      ${pg && pg.page > 1 ? '' : (opts.storiesHtml || '')}
      ${grid(ctx, businesses, opts.emptyMsg)}
      ${paginationNav(ctx, pg)}
      ${leadBlock}
      ${opts.contentHtml || ''}
      ${(opts.related || []).join('')}
    </div>`;
  const onPageN = pg && pg.page > 1;
  const canonical = onPageN ? opts.canonical + '?page=' + pg.page : opts.canonical;
  return renderLayout(ctx, {
    title: onPageN ? opts.title.replace(' | ', ` — página ${pg.page} | `) : opts.title,
    description: opts.description, canonical,
    // Anti-thin content: paginile de listare cu sub MIN_LISTING negocios → noindex,follow
    // (aceeași regulă ca sitemap-ul; păstrăm crawl-ul link-urilor interne).
    robots: total < MIN_LISTING ? 'noindex,follow' : undefined,
    prev: pg && pg.page > 1 ? abs(ctx, pageHref(pg.baseHref, pg.page - 1)) : null,
    next: pg && pg.page < pg.pages ? abs(ctx, pageHref(pg.baseHref, pg.page + 1)) : null,
    jsonLd: [jsonLdBreadcrumb(ctx, opts.crumbs), businesses.length ? jsonLdItemList(ctx, businesses) : null].concat(opts.jsonLd || []),
    body,
  });
}

/* Fecha legible «octubre de 2026» a partir de 'YYYY-MM-DD'. */
function monthYear(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00Z');
  return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function authorLine(updated) { return `<p class="content-author">Por Emanuel, de ${esc(SITE.name)}${updated ? ' · Actualizado en ' + esc(monthYear(updated)) : ''}</p>`; }
function guideLinks(slugs) {
  const list = (slugs || []).map(guiaBySlug).filter(Boolean);
  if (!list.length) return '';
  return `<div class="content-links"><h3>Guías útiles</h3><ul>${list.map(g => `<li><a href="/guias/${attr(g.slug)}">${esc(g.h1)}</a></li>`).join('')}</ul></div>`;
}
function priceTeaser(slug) {
  const pr = precioBySlug(slug);
  if (!pr) return '';
  const rows = pr.tabla.slice(0, 3);
  return `<div class="price-teaser"><h3>¿Cuánto cuesta?</h3><table class="price-table price-table-sm"><tbody>${rows.map(r => `<tr><th>${esc(r.c)}</th><td>${esc(r.p)}</td></tr>`).join('')}</tbody></table><a class="section-link" href="/precios/${attr(pr.slug)}">Ver todos los precios ${icon('arrow')}</a></div>`;
}
/* Texto propio de la página de servicio (va debajo de las empresas). */
function categoryContent(category) {
  const c = CATEGORIAS[category.slug];
  if (!c) return { html: '', faq: [] };
  const html = `<section class="cat-content">
      <div class="cat-content-main">
        <h2>Cómo elegir ${esc(category.name.toLowerCase())} en Madrid</h2>
        ${c.intro.map(t => `<p>${esc(t)}</p>`).join('')}
        <h3>Qué comprobar antes de contratar</h3>
        <ul class="checklist">${c.checklist.map(t => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul>
        ${authorLine(PRECIOS_UPDATED)}
      </div>
      <aside class="cat-content-side">${priceTeaser(c.precio)}${guideLinks(c.guias)}</aside>
    </section>
    ${faqSection(`Preguntas frecuentes sobre ${category.name.toLowerCase()}`, c.faq)}`;
  return { html, faq: c.faq };
}
/* Bloque local de servicio×distrito/municipio: nota del distrito + nota del
   servicio por tipo de vivienda + datos reales del directorio. */
function localContent(category, district) {
  const c = CATEGORIAS[category.slug];
  const d = DISTRITOS[district.slug];
  const st = DB.contextStats({ categorySlug: category.slug, districtSlug: district.slug });
  if (!st.total) return '';
  const barrios = covered(DB.listNeighborhoods(district.id).map(b => ({ name: b.name, href: `/${category.slug}/${district.slug}/${b.slug}`, n: covCount('catBar', category.slug + '|' + district.slug + '|' + b.slug) })))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const where = district.kind === 'municipio' ? district.name : 'el distrito de ' + district.name;
  const facts = [
    `En el directorio hay <b>${fmtInt(st.total)}</b> ${esc(category.name.toLowerCase())} en ${esc(where)}${st.withWeb ? `; <b>${fmtInt(st.withWeb)}</b> tienen web propia` : ''}${st.claimed ? ` y <b>${fmtInt(st.claimed)}</b> están verificados` : ''}.`,
    st.reviews ? `Entre todos suman <b>${fmtInt(st.reviews)}</b> reseñas en Google.` : '',
    barrios.length ? `Los barrios con más profesionales son ${barrios.map(b => `<a href="${attr(b.href)}">${esc(b.name)}</a> (${b.count})`).join(', ')}.` : '',
  ].filter(Boolean);
  const notes = [d ? d.nota : '', d && c && c.porVivienda ? c.porVivienda[d.vivienda] : ''].filter(Boolean);
  return `<section class="local-content">
      <h2>${esc(category.name)} en ${esc(district.name)}: lo que conviene saber</h2>
      ${notes.map(t => `<p>${esc(t)}</p>`).join('')}
      <p class="local-facts">${facts.join(' ')}</p>
      ${c && c.precio && precioBySlug(c.precio) ? `<p class="local-links"><a href="/precios/${attr(c.precio)}">Precios orientativos de ${esc(category.name.toLowerCase())} en Madrid</a>${(c.guias || []).map(guiaBySlug).filter(Boolean).map(g => ` · <a href="/guias/${attr(g.slug)}">${esc(g.h1)}</a>`).join('')}</p>` : ''}
    </section>`;
}

function renderCategory(ctx, category, page) {
  const r = DB.listForContext('cat:' + category.slug, { categorySlug: category.slug }, { page });
  const distritos = DB.listDistritos();
  const zones = DB.listZones();
  const subs = DB.getCategory(category.id) && DB.getCategoryTree().find(c => c.id === category.id);
  const subChildren = subs ? subs.children : [];
  const cs = category.slug;
  // Solo enlazamos páginas con empresas suficientes (las demás son noindex).
  const related = [
    chipRow(`${category.name} por distrito en Madrid capital`, covered(distritos.map(d => ({ name: d.name, href: `/${cs}/${d.slug}`, n: covCount('catMun', cs + '|' + d.slug) })))),
    chipRow(`${category.name} por zona de la Comunidad`, covered(zones.map(z => ({ name: 'Zona ' + z.name, href: `/${cs}/zona/${z.slug}`, n: covCount('catZona', cs + '|' + z.slug) })))),
    ...zones.map(z => chipRow(`${category.name} en ${z.name}`, covered(z.municipios.map(m => ({ name: m.name, href: `/${cs}/${m.slug}`, n: covCount('catMun', cs + '|' + m.slug) }))))),
    chipRow(`${category.name} cerca del metro`, covered(DB.listMetros().map(m => ({ name: m.name, href: `/${cs}/metro/${m.slug}`, n: covCount('catMetro', cs + '|' + m.slug) })))),
  ];
  const subchips = chipRow('Especialidades', covered(subChildren.map(s => ({ name: s.name, href: `/${s.slug}`, n: covCount('cat', s.slug) }))));
  const catContent = categoryContent(category.parent_id ? (DB.getCategory(category.parent_id) || category) : category);
  const crumbs = [{ name: 'Inicio', href: '/' }];
  if (category.parent_id) { const p = DB.getCategory(category.parent_id); if (p) crumbs.push({ name: p.name, href: `/${p.slug}` }); }
  crumbs.push({ name: category.name });
  return listingPage(ctx, {
    title: `${category.name} en Madrid — presupuestos y opiniones | ${SITE.name}`,
    description: category.intro || `Encuentra ${category.name.toLowerCase()} en Madrid por distrito, barrio y municipio. Compara profesionales, reseñas y contacto directo.`,
    canonical: abs(ctx, `/${category.slug}`),
    h1: `${category.name} en Madrid`,
    intro: category.intro,
    crumbs,
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/${category.slug}` },
    subchips, related,
    storiesHtml: storyStrip(ctx, `Conoce a los profesionales: ${category.name.toLowerCase()}`, DB.listStories({ status: 'published', categorySlug: category.slug, limit: 3 }), '/historias?categoria=' + category.slug),
    contentHtml: r.page > 1 ? '' : catContent.html,
    jsonLd: r.page > 1 ? [] : [faqJsonLd(catContent.faq)],
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados. Vuelve pronto.`,
  });
}

function renderDistrict(ctx, category, district, page) {
  const r = DB.listForContext('cat:' + category.slug + ':mun:' + district.slug, { categorySlug: category.slug, districtSlug: district.slug }, { page });
  const barrios = DB.listNeighborhoods(district.id);
  const isMuni = district.kind === 'municipio';
  const cs = category.slug;
  const munLink = d => ({ name: d.name, href: `/${cs}/${d.slug}`, n: covCount('catMun', cs + '|' + d.slug) });
  const related = [
    chipRow(`${category.name} por barrio en ${district.name}`, covered(barrios.map(b => ({ name: b.name, href: `/${cs}/${district.slug}/${b.slug}`, n: covCount('catBar', cs + '|' + district.slug + '|' + b.slug) })))),
    isMuni
      ? chipRow(`${category.name} en otros municipios de ${zonaName(district.zona)}`, covered(DB.listMunicipios().filter(d => d.zona === district.zona && d.id !== district.id).map(munLink)))
      : chipRow(`${category.name} en otros distritos`, covered(DB.listDistritos().filter(d => d.id !== district.id).map(munLink))),
    chipRow(`Otros servicios en ${district.name}`, covered(DB.getCategoryTree().filter(c => c.id !== category.id).map(c => ({ name: c.name, href: `/${c.slug}/${district.slug}`, n: covCount('catMun', c.slug + '|' + district.slug) })))),
  ];
  return listingPage(ctx, {
    title: `${category.name} en ${district.name} (Madrid) | ${SITE.name}`,
    description: `${category.name} en ${geoIn(district)}, Comunidad de Madrid. Profesionales cercanos con opiniones y contacto directo${isMuni ? '' : ', por barrios'}.`,
    canonical: abs(ctx, `/${category.slug}/${district.slug}`),
    h1: `${category.name} en ${district.name}`,
    intro: isMuni
      ? `Profesionales de ${category.name.toLowerCase()} en ${district.name}, en la zona ${zonaName(district.zona)} de la Comunidad de Madrid.`
      : `Profesionales de ${category.name.toLowerCase()} en el distrito de ${district.name}. Elige tu barrio para afinar la búsqueda.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: district.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/${category.slug}/${district.slug}` },
    related,
    storiesHtml: storyStrip(ctx, `Conoce a los profesionales de ${district.name}`, DB.listStories({ status: 'published', categorySlug: category.slug, districtSlug: district.slug, limit: 3 })),
    contentHtml: r.page > 1 ? '' : localContent(category, district),
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados en ${district.name}.`,
  });
}

function renderBarrio(ctx, category, district, barrio, page) {
  // Barrio-ul moștenește contextul municipiului (ordinea manuală de la mun se aplică și aici).
  const r = DB.listForContext('cat:' + category.slug + ':mun:' + district.slug, { categorySlug: category.slug, districtSlug: district.slug, barrioSlug: barrio.slug }, { page });
  const siblings = DB.listNeighborhoods(district.id).filter(b => b.id !== barrio.id);
  const related = [
    chipRow(`Otros barrios de ${district.name}`, covered(siblings.map(b => ({ name: b.name, href: `/${category.slug}/${district.slug}/${b.slug}`, n: covCount('catBar', category.slug + '|' + district.slug + '|' + b.slug) })))),
    chipRow(`${category.name} en todo ${district.name}`, covered([{ name: `${category.name} en ${district.name}`, href: `/${category.slug}/${district.slug}`, n: covCount('catMun', category.slug + '|' + district.slug) }])),
  ];
  return listingPage(ctx, {
    title: `${category.name} en ${barrio.name}, ${district.name} (Madrid) | ${SITE.name}`,
    description: `${category.name} en ${barrio.name} (${district.name}, Madrid). Encuentra un profesional cerca de casa con opiniones y contacto.`,
    canonical: abs(ctx, `/${category.slug}/${district.slug}/${barrio.slug}`),
    h1: `${category.name} en ${barrio.name}`,
    intro: `${category.name} en el barrio de ${barrio.name} (${district.name}). Profesionales de proximidad.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: district.name, href: `/${category.slug}/${district.slug}` }, { name: barrio.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/${category.slug}/${district.slug}/${barrio.slug}` },
    related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados en ${barrio.name}.`,
  });
}

function renderCategoryMetro(ctx, category, metro, page) {
  // Metro: fără board manual — shuffle determinist stabil + paginare.
  const r = DB.listForContext('cat:' + category.slug + ':metro:' + metro.slug, { categorySlug: category.slug, metroSlug: metro.slug }, { page });
  const otherCats = DB.getCategoryTree().filter(c => c.id !== category.id);
  const related = [
    chipRow(`Otros servicios cerca de ${metro.name}`, covered(otherCats.map(c => ({ name: c.name, href: `/${c.slug}/metro/${metro.slug}`, n: covCount('catMetro', c.slug + '|' + metro.slug) })))),
    chipRow(`${category.name} cerca de otras estaciones`, covered(DB.listMetros().filter(m => m.id !== metro.id).map(m => ({ name: m.name, href: `/${category.slug}/metro/${m.slug}`, n: covCount('catMetro', category.slug + '|' + m.slug) }))).slice(0, 12)),
  ];
  const lines = (metro.lines || []).length ? ` (líneas ${metro.lines.join(', ')})` : '';
  return listingPage(ctx, {
    title: `${category.name} cerca de ${metro.name} (metro) | ${SITE.name}`,
    description: `${category.name} cerca de la estación de metro ${metro.name}${lines} en Madrid. Encuentra un profesional a pocos minutos.`,
    canonical: abs(ctx, `/${category.slug}/metro/${metro.slug}`),
    h1: `${category.name} cerca de ${metro.name}`,
    intro: `Profesionales de ${category.name.toLowerCase()} cerca de la estación de metro ${metro.name}${lines}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: 'Metro ' + metro.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/${category.slug}/metro/${metro.slug}` },
    related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados cerca de ${metro.name}.`,
  });
}

/* Nișă × zonă geografică (Sur/Norte/Este…) — pagină SEO + board manual. */
function renderCategoryZona(ctx, category, zona, page) {
  const r = DB.listForContext('cat:' + category.slug + ':zona:' + zona.slug, { categorySlug: category.slug, zona: zona.slug }, { page });
  const munis = DB.listMunicipios().filter(d => d.zona === zona.slug);
  const otherZones = (DB.ZONES || []).filter(z => z.slug !== zona.slug);
  const related = [
    chipRow(`${category.name} por municipio en ${zona.name}`, covered(munis.map(m => ({ name: m.name, href: `/${category.slug}/${m.slug}`, n: covCount('catMun', category.slug + '|' + m.slug) })))),
    chipRow(`${category.name} en otras zonas`, covered(otherZones.map(z => ({ name: z.name, href: `/${category.slug}/zona/${z.slug}`, n: covCount('catZona', category.slug + '|' + z.slug) })))),
  ];
  return listingPage(ctx, {
    title: `${category.name} en la zona ${zona.name} de Madrid | ${SITE.name}`,
    description: `${category.name} en los municipios de la zona ${zona.name} de la Comunidad de Madrid. Compara profesionales, opiniones y contacto directo.`,
    canonical: abs(ctx, `/${category.slug}/zona/${zona.slug}`),
    h1: `${category.name} en la zona ${zona.name}`,
    intro: `Profesionales de ${category.name.toLowerCase()} en los municipios de la zona ${zona.name} de la Comunidad de Madrid.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: 'Zona ' + zona.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/${category.slug}/zona/${zona.slug}` },
    related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados en la zona ${zona.name}.`,
  });
}

function renderZoneDistrict(ctx, district, page) {
  const r = DB.listForContext('zona-mun:' + district.slug, { districtSlug: district.slug }, { page });
  const cats = DB.getCategoryTree();
  const barrios = DB.listNeighborhoods(district.id);
  const isMuni = district.kind === 'municipio';
  const related = [
    chipRow(`Servicios en ${district.name}`, covered(cats.map(c => ({ name: c.name, href: `/${c.slug}/${district.slug}`, n: covCount('catMun', c.slug + '|' + district.slug) })))),
    chipRow(`Barrios de ${district.name}`, covered(barrios.map(b => ({ name: b.name, href: `/zona/${district.slug}/${b.slug}`, n: covCount('bar', district.slug + '|' + b.slug) })))),
    isMuni
      ? chipRow(`Otros municipios de ${zonaName(district.zona)}`, covered(DB.listMunicipios().filter(d => d.zona === district.zona && d.id !== district.id).map(d => ({ name: d.name, href: `/zona/${d.slug}`, n: covCount('muni', d.slug) }))))
      : chipRow('Otros distritos de Madrid', covered(DB.listDistritos().filter(d => d.id !== district.id).map(d => ({ name: d.name, href: `/zona/${d.slug}`, n: covCount('muni', d.slug) })))),
  ];
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Zonas', href: '/zonas' }];
  if (isMuni) crumbs.push({ name: zonaName(district.zona), href: `/zonas#${district.zona}` });
  crumbs.push({ name: district.name });
  return listingPage(ctx, {
    title: `Empresas y profesionales en ${district.name} (Madrid) | ${SITE.name}`,
    description: `Directorio de ${servicesPhrase(5)} en ${geoIn(district)}, Comunidad de Madrid.`,
    canonical: abs(ctx, `/zona/${district.slug}`),
    h1: `Profesionales en ${district.name}`,
    intro: `Profesionales en ${geoIn(district)}: ${servicesPhrase()}.`,
    crumbs,
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/zona/${district.slug}` },
    related,
    emptyMsg: `Aún no hay empresas listadas en ${district.name}.`,
  });
}

function renderZoneBarrio(ctx, district, barrio, page) {
  const r = DB.listForContext('zona-bar:' + district.slug + ':' + barrio.slug, { districtSlug: district.slug, barrioSlug: barrio.slug }, { page });
  const cats = DB.getCategoryTree();
  const related = [
    chipRow(`Servicios en ${barrio.name}`, covered(cats.map(c => ({ name: c.name, href: `/${c.slug}/${district.slug}/${barrio.slug}`, n: covCount('catBar', c.slug + '|' + district.slug + '|' + barrio.slug) })))),
    chipRow(`Otros barrios de ${district.name}`, covered(DB.listNeighborhoods(district.id).filter(b => b.id !== barrio.id).map(b => ({ name: b.name, href: `/zona/${district.slug}/${b.slug}`, n: covCount('bar', district.slug + '|' + b.slug) })))),
  ];
  return listingPage(ctx, {
    title: `Empresas y profesionales en ${barrio.name}, ${district.name} | ${SITE.name}`,
    description: `Profesionales en ${barrio.name} (${district.name}, Madrid): ${servicesPhrase(5)}.`,
    canonical: abs(ctx, `/zona/${district.slug}/${barrio.slug}`),
    h1: `Profesionales en ${barrio.name}`,
    intro: `Profesionales en el barrio de ${barrio.name} (${district.name}): ${servicesPhrase()}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: district.name, href: `/zona/${district.slug}` }, { name: barrio.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/zona/${district.slug}/${barrio.slug}` },
    related,
    emptyMsg: `Aún no hay empresas listadas en ${barrio.name}.`,
  });
}

/* Índice maestro de zonas: navegación rápida por toda la Comunidad de Madrid. */
function renderZonesIndex(ctx) {
  const distritos = DB.listDistritos();
  const zones = DB.listZones();
  const totalMuni = DB.listMunicipios().length + 1;
  // Los lugares con empresas suficientes van enlazados (con su contador); el resto
  // se muestra sin enlace, para no mandar al rastreador a páginas vacías.
  const place = x => {
    const n = covCount('muni', x.slug);
    return n >= MIN_LISTING
      ? `<a class="chip" href="/zona/${attr(x.slug)}">${esc(x.name)} <b>${n}</b></a>`
      : `<span class="chip chip-muted">${esc(x.name)}</span>`;
  };
  const section = (title, anchor, sub, items) => `
      <section class="zona-index-block" id="${attr(anchor)}">
        <h2 class="zona-index-title">${esc(title)} <span class="zona-count">${items.length}</span></h2>
        ${sub ? `<p class="zona-index-sub">${esc(sub)}</p>` : ''}
        <div class="chips">${items.map(place).join('')}</div>
      </section>`;
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Zonas' }])}
      <header class="page-head">
        <h1>Profesionales por zona en la Comunidad de Madrid</h1>
        <p class="page-intro">Cubrimos los ${totalMuni} municipios de la Comunidad de Madrid y los ${distritos.length} distritos de la capital. Elige tu zona para encontrar profesionales cerca de ti.</p>
      </header>
      ${section('Madrid capital', 'madrid', `Los ${distritos.length} distritos del municipio de Madrid.`, distritos)}
      ${zones.map(z => section(z.name, z.slug, null, z.municipios)).join('')}
    </div>`;
  return renderLayout(ctx, {
    title: `Zonas y municipios de Madrid — directorio por zona | ${SITE.name}`,
    description: `Directorio de ${servicesPhrase(4)} en los ${totalMuni} municipios de la Comunidad de Madrid, agrupados por zona: Sur, Corredor del Henares, Norte, Oeste, Sierra y Sureste.`,
    canonical: abs(ctx, '/zonas'), body,
    jsonLd: [jsonLdBreadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Zonas' }])],
  });
}

function renderMetroIndex(ctx) {
  const metros = DB.listMetros();
  const cats = DB.getCategoryTree();
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Metro' }])}
      <header class="page-head"><h1>Buscar profesionales por estación de metro</h1>
      <p class="page-intro">Elige tu estación de metro en Madrid y encuentra ${esc(servicesPhrase())} cerca de ti.</p></header>
      ${chipRow('Estaciones de metro', covered(metros.map(m => ({ name: m.name, href: `/metro/${m.slug}`, n: covCount('metro', m.slug) }))))}
      ${chipRow('Servicios', cats.map(c => ({ name: c.name, href: `/${c.slug}` })))}
    </div>`;
  return renderLayout(ctx, {
    title: `Buscar por metro en Madrid | ${SITE.name}`,
    description: `Encuentra ${servicesPhrase(5)} cerca de tu estación de metro en Madrid.`,
    canonical: abs(ctx, '/metro'), body,
    // Sin empresas asociadas a estaciones, el índice de metro está vacío → no indexar.
    robots: hasMetroData() ? undefined : 'noindex,follow',
    jsonLd: [jsonLdBreadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Metro' }])],
  });
}

function renderMetroHub(ctx, metro, page) {
  const r = DB.listForContext('metro:' + metro.slug, { metroSlug: metro.slug }, { page });
  const cats = DB.getCategoryTree();
  const lines = (metro.lines || []).length ? ` (líneas ${metro.lines.join(', ')})` : '';
  const related = [chipRow(`Servicios cerca de ${metro.name}`, covered(cats.map(c => ({ name: c.name, href: `/${c.slug}/metro/${metro.slug}`, n: covCount('catMetro', c.slug + '|' + metro.slug) }))))];
  return listingPage(ctx, {
    title: `Profesionales cerca de ${metro.name} (metro Madrid) | ${SITE.name}`,
    description: `Empresas de ${servicesPhrase(5)} cerca de la estación ${metro.name}${lines}.`,
    canonical: abs(ctx, `/metro/${metro.slug}`),
    h1: `Profesionales cerca de ${metro.name}`,
    intro: `Profesionales cerca de la estación de metro ${metro.name}${lines}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: 'Metro', href: '/metro' }, { name: metro.name }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: `/metro/${metro.slug}` },
    related,
    emptyMsg: `Aún no hay empresas listadas cerca de ${metro.name}.`,
  });
}

/* ------------------------- Ficha de negocio -------------------------- */
function renderBusiness(ctx, b) {
  const DAYS = [['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']];
  const primary = (b.categories || []).find(c => !c.parent_id) || (b.categories || [])[0];
  const crumbs = [{ name: 'Inicio', href: '/' }];
  if (primary) crumbs.push({ name: primary.name, href: `/${primary.slug}` });
  if (primary && b.district) crumbs.push({ name: b.district.name, href: `/${primary.slug}/${b.district.slug}` });
  crumbs.push({ name: b.name });

  const social = Object.entries(b.social || {}).filter(([, v]) => v);
  const catLinks = (b.categories || []).map(c => `<a class="chip" href="/${attr(c.slug)}">${esc(c.name)}</a>`).join('');
  const metroLinks = (b.metros || []).map(m => primary
    ? `<a class="chip" href="/${attr(primary.slug)}/metro/${attr(m.slug)}">${icon('metro')}${esc(m.name)}</a>`
    : `<a class="chip" href="/metro/${attr(m.slug)}">${icon('metro')}${esc(m.name)}</a>`).join('');

  const ogImg = bizLogo(b) || (b.photos && b.photos[0]) || b.photo || null;
  const profileUrl = abs(ctx, '/negocio/' + b.id);
  const topCat = primary && primary.parent_id ? DB.getCategory(primary.parent_id) : primary;
  // Sin aggregateRating: las reseñas son de Google, y Google no permite marcar
  // como propias valoraciones recogidas en otros sitios.
  const jsonLd = {
    '@context': 'https://schema.org', '@type': BIZ_TYPE[topCat && topCat.slug] || 'LocalBusiness', '@id': profileUrl + '#business',
    name: b.name, description: b.about || undefined, telephone: b.phone || undefined, url: b.website || profileUrl,
    mainEntityOfPage: profileUrl,
    image: ogImg ? abs(ctx, ogImg) : undefined,
    logo: bizLogo(b) ? abs(ctx, bizLogo(b)) : undefined,
    address: { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: b.district && b.district.kind === 'municipio' ? b.district.name : 'Madrid', addressRegion: 'Madrid', addressCountry: 'ES' },
    areaServed: b.zone || 'Madrid',
    numberOfEmployees: b.team_size ? { '@type': 'QuantitativeValue', value: b.team_size } : undefined,
  };

  // Otros profesionales del mismo servicio en la misma zona (enlazado interno + alternativas).
  let related = '';
  if (primary && b.district) {
    const relCtx = 'cat:' + primary.slug + ':mun:' + b.district.slug;
    const rel = DB.listForContext(relCtx, { categorySlug: primary.slug, districtSlug: b.district.slug }, { pageSize: 7 });
    const others = rel.items.filter(x => x.id !== b.id).slice(0, 6);
    if (others.length) {
      const allHref = rel.total >= MIN_LISTING ? `/${primary.slug}/${b.district.slug}` : `/${primary.slug}`;
      related = `<section class="biz-related">
          <div class="section-head"><h2>Otros ${esc(primary.name.toLowerCase())} en ${esc(b.district.name)}</h2><a class="section-link" href="${attr(allHref)}">Ver todos ${icon('arrow')}</a></div>
          ${grid(ctx, others)}
        </section>`;
    }
  }

  const gallery = (b.photos || []).filter(Boolean);
  const facts = [
    b.contact_name ? `<span>${icon('user')}Responsable: ${esc(b.contact_name)}</span>` : '',
    b.team_size ? `<span>${icon('users')}Equipo de ${fmtInt(b.team_size)} ${b.team_size === 1 ? 'persona' : 'personas'}</span>` : '',
  ].filter(Boolean);
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="biz">
        <div class="biz-media">
          ${b.featured ? sponsoredBadge() : ''}
          <img src="${attr(bizCover(b))}" alt="${attr(b.name)}" />
        </div>
        <div class="biz-head">
          ${bizLogo(b) ? `<span class="biz-logo"><img src="${attr(bizLogo(b))}" alt="${attr(b.name)} logo" /></span>` : ''}
          <h1>${esc(b.name)}</h1>
          ${b.claimed ? verifiedBadge() : ''}
          <p class="biz-zone">${icon('pin')}${esc(b.address || b.zone || 'Madrid')}</p>
          ${b.rating ? `<p class="biz-rating">${icon('star')}<b>${b.rating.toFixed(1)}</b> · ${reviewsLabel(b.reviews || 0)} en Google</p>`
            : b.reviews ? `<p class="biz-rating">${icon('star')}<b>${reviewsLabel(b.reviews)}</b> en Google</p>` : ''}
          ${facts.length ? `<p class="biz-facts">${facts.join('')}</p>` : ''}
          <div class="biz-actions">
            ${b.phone ? `<a class="btn btn-primary" href="tel:${attr(tel(b.phone))}" data-track="phone">${icon('phone')} Llamar</a>` : ''}
            ${b.website ? `<a class="btn btn-ghost" href="${attr(b.website)}" target="_blank" rel="noopener nofollow" data-track="web">Visitar web</a>` : ''}
          </div>
        </div>
      </article>

      <div class="biz-grid">
        <div class="biz-main">
          ${b.about ? `<section class="biz-section biz-about"><h2>Sobre ${esc(b.name)}</h2>${paragraphs(b.about)}</section>` : ''}
          ${gallery.length ? `<section class="biz-section"><h2>Trabajos y servicios</h2><div class="biz-gallery">${gallery.map(p => `<a class="biz-gallery-item" href="${attr(p)}" target="_blank" rel="noopener"><img src="${attr(p)}" alt="${attr(b.name)} — trabajo" loading="lazy" /></a>`).join('')}</div></section>` : ''}
          ${b.categories && b.categories.length ? `<section class="biz-section"><h2>Servicios</h2><div class="chips">${catLinks}</div>${(() => { const c = topCat && CATEGORIAS[topCat.slug]; return c && precioBySlug(c.precio) ? `<p class="biz-price-link"><a href="/precios/${attr(c.precio)}">Precios orientativos de ${esc(topCat.name.toLowerCase())} en Madrid ${icon('arrow')}</a></p>` : ''; })()}</section>` : ''}
          ${b.metros && b.metros.length ? `<section class="biz-section"><h2>Metro cercano</h2><div class="chips">${metroLinks}</div></section>` : ''}
          ${(() => { const st = DB.listStories({ status: 'published', businessId: b.id, limit: 1 })[0]; return st ? `<section class="biz-section biz-story"><h2>Historia</h2><a class="biz-story-link" href="/historias/${attr(st.id)}"><b>${esc(st.title)}</b>${st.excerpt ? `<span>${esc(st.excerpt)}</span>` : ''}<em>Leer la historia ${icon('arrow')}</em></a></section>` : ''; })()}
          ${claimBlock(b, primary)}
        </div>
        <aside class="biz-aside">
          ${leadForm({ businessId: b.id, context: b.name, title: `Pide presupuesto a ${b.name}`, sub: 'Rellena el formulario y este profesional te contactará. Gratis y sin compromiso.' })}
          ${hasHours(b.hours) ? `<section class="biz-card">
            <h2>Horario</h2>
            <table class="hours">${DAYS.map(([k, lbl]) => `<tr><th>${lbl}</th><td>${esc((b.hours && b.hours[k]) || 'Cerrado')}</td></tr>`).join('')}</table>
          </section>` : ''}
          <section class="biz-card">
            <h2>Contacto</h2>
            <ul class="contact-list">
              ${b.phone ? `<li>${icon('phone')}<a href="tel:${attr(tel(b.phone))}" data-track="phone">${esc(b.phone)}</a></li>` : ''}
              ${b.email ? `<li><a href="mailto:${attr(b.email)}">${esc(b.email)}</a></li>` : ''}
              ${b.website ? `<li><a href="${attr(b.website)}" target="_blank" rel="noopener nofollow" data-track="web">Sitio web</a></li>` : ''}
              ${b.district ? `<li>${icon('pin')}<a href="/zona/${attr(b.district.slug)}">${esc(b.zone)}</a></li>` : b.zone ? `<li>${icon('pin')}${esc(b.zone)}</li>` : ''}
            </ul>
            ${social.length ? `<div class="chips">${social.map(([k, v]) => `<a class="chip" href="${attr(v)}" target="_blank" rel="noopener nofollow">${esc(k)}</a>`).join('')}</div>` : ''}
            <p class="biz-fix"><a href="/contacto?negocio=${attr(encodeURIComponent(b.id))}" rel="nofollow">¿Datos incorrectos? Corregir o eliminar esta ficha</a></p>
          </section>
        </aside>
      </div>
      ${related}
    </div>`;

  return renderLayout(ctx, {
    title: `${b.name} — ${primary ? primary.name : 'Servicios'} en ${b.zone || 'Madrid'} | ${SITE.name}`,
    description: (b.about ? b.about.slice(0, 155) : `${b.name}: ${primary ? primary.name.toLowerCase() : 'servicios'} en ${b.zone || 'Madrid'}. Contacto directo y presupuesto gratis.`),
    canonical: profileUrl, ogType: 'business.business', ogImage: ogImg ? abs(ctx, ogImg) : undefined,
    // Fichas sin contenido propio: visibles, pero fuera de Google hasta que se
    // reclamen o tengan descripción (ver DB.isIndexableBusiness).
    robots: DB.isIndexableBusiness(b) ? undefined : 'noindex,follow',
    bodyClass: 'page-biz', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), jsonLd],
    inlineData: { trackId: b.id },
  });
}

/* --------------------------- Home / Search --------------------------- */
function renderHome(ctx) {
  const cats = DB.getCategoryTree();
  const districts = DB.listDistricts();
  const distritos = DB.listDistritos();
  const zones = DB.listZones();
  const metros = DB.listMetros();
  const showMetro = hasMetroData();
  // Destacadas = lista curată „home", 20 pe pagină (pagina 1 aici, restul pe
  // /destacadas?page=N); fallback: shuffle din toate (light → hidratăm doar 20).
  let feat = DB.listHome({ pageSize: 20 });
  if (!feat.total) feat = DB.listForContext('home', {}, { pageSize: 20 });
  const featList = feat.items;
  const total = DB.countBusinesses();

  const inlineData = {
    categories: cats.map(c => ({ slug: c.slug, name: c.name })),
    districts: districts.map(d => ({ slug: d.slug, name: d.name, kind: d.kind, barrios: DB.listNeighborhoods(d.id).map(b => ({ slug: b.slug, name: b.name })) })),
    metros: showMetro ? metros.map(m => ({ slug: m.slug, name: m.name })) : [],
  };

  // Solo lugares con empresas suficientes, ordenados por número de empresas.
  const withCount = list => list.map(d => Object.assign({}, d, { n: covCount('muni', d.slug) }))
    .filter(d => d.n >= MIN_LISTING).sort((a, b) => b.n - a.n);

  const catTiles = cats.map(c => `
      <a class="cat-tile" href="/${attr(c.slug)}">
        <img src="${attr(catTileImg(c.slug))}" alt="${attr(c.name)} en Madrid" loading="lazy" width="900" height="600">
        <span class="cat-name">${esc(c.name)}</span>
      </a>`).join('');

  const body = `
    <section class="hero">
      <div class="hero-bg" role="img" aria-label="Madrid"></div>
      <div class="container hero-inner">
        <p class="hero-eyebrow">${esc(SITE.tagline)}</p>
        <h1 class="hero-title">Encuentra <span>profesionales</span> de confianza en Madrid</h1>
        <p class="hero-lead">${esc(ucFirst(servicesPhrase()))}, cerca de tu barrio.</p>
        <form class="hero-search" id="heroSearch" role="search">
          <div class="hs-field">
            <label>Servicio</label>
            <select id="hsService"><option value="">¿Qué necesitas?</option>${cats.map(c => `<option value="${attr(c.slug)}">${esc(c.name)}</option>`).join('')}</select>
          </div>
          <div class="hs-field">
            <label>Zona</label>
            <select id="hsDistrict"><option value="">Toda la Comunidad</option><optgroup label="Madrid capital">${distritos.map(d => `<option value="${attr(d.slug)}">${esc(d.name)}</option>`).join('')}</optgroup>${zones.map(z => `<optgroup label="${attr(z.name)}">${z.municipios.map(m => `<option value="${attr(m.slug)}">${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}</select>
          </div>
          <div class="hs-field">
            <label>Barrio</label>
            <select id="hsBarrio" disabled><option value="">Elige zona primero</option></select>
          </div>
          ${showMetro ? `<div class="hs-field">
            <label>Metro</label>
            <select id="hsMetro"><option value="">Cualquiera</option>${metros.map(m => `<option value="${attr(m.slug)}">${esc(m.name)}</option>`).join('')}</select>
          </div>` : ''}
          <button class="btn btn-primary hs-go" type="submit">Buscar</button>
        </form>
        <form class="searchbar hero-keyword" action="/buscar" method="get" role="search">
          ${icon('search')}
          <input type="search" name="q" placeholder="Busca: fontanero, cerrajero…" aria-label="Buscar por palabra clave">
          <button class="btn btn-primary" type="submit">Buscar</button>
        </form>
        <div class="hero-stats">
          <div><b>${total}</b><span>Empresas</span></div>
          <div><b>${DB.listMunicipios().length + 1}</b><span>Municipios</span></div>
          <div><b>${cats.length}</b><span>Servicios</span></div>
        </div>
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>Servicios destacados</h2></div>
      <div class="cat-tiles">${catTiles}</div>
    </section>

    ${(() => { const latest = DB.listStories({ status: 'published', limit: 3 }); return latest.length ? `<section class="container section section-tight">${storyStrip(ctx, 'Historias de profesionales', latest, '/historias')}</section>` : ''; })()}

    <section class="section section-alt">
      <div class="container">
        <div class="section-head"><h2>Empresas destacadas</h2><a class="section-link" href="/destacadas">Ver todas ${icon('arrow')}</a></div>
        ${grid(ctx, featList)}
        ${paginationNav(ctx, { page: 1, pages: feat.pages, baseHref: '/destacadas' })}
      </div>
    </section>

    <section class="container section section-tight">
      <div class="home-two">
        <div><div class="section-head"><h2>Precios orientativos</h2><a class="section-link" href="/precios">Ver todos ${icon('arrow')}</a></div>
          <ul class="home-list">${PRECIOS.slice(0, 6).map(pr => `<li><a href="/precios/${attr(pr.slug)}">${esc(pr.h1)}</a></li>`).join('')}</ul></div>
        <div><div class="section-head"><h2>Guías</h2><a class="section-link" href="/guias">Ver todas ${icon('arrow')}</a></div>
          <ul class="home-list">${GUIAS.slice(0, 6).map(g => `<li><a href="/guias/${attr(g.slug)}">${esc(g.h1)}</a></li>`).join('')}</ul></div>
      </div>
      <div class="home-pro"><div><b>¿Tienes un negocio en Madrid?</b><span>Aparece gratis en el directorio o reclama tu ficha.</span></div><a class="btn btn-primary" href="/profesionales">Alta gratis</a></div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>Explora por zona</h2><a class="section-link" href="/zonas">Ver los 179 municipios ${icon('arrow')}</a></div>
      ${zonaGroup('Madrid capital', 'madrid', withCount(distritos), distritos.length)}
      ${zones.map(z => { const ms = withCount(z.municipios); return ms.length ? zonaGroup(z.name, z.slug, ms.slice(0, 12), z.municipios.length) : ''; }).join('')}
    </section>`;

  return renderLayout(ctx, {
    title: `${SITE.name}: fontaneros, electricistas, cerrajeros, reformas y más`,
    description: `Encuentra ${servicesPhrase(5)} en Madrid capital y los 179 municipios de la Comunidad. Contacto directo y presupuesto gratis.`,
    canonical: abs(ctx, '/'), bodyClass: 'page-home', body, inlineData,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs(ctx, '/#website'), name: SITE.name, url: abs(ctx, '/'), inLanguage: 'es-ES', publisher: { '@id': abs(ctx, '/#organization') } }],
  });
}

function renderSearch(ctx, q, page) {
  const query = String(q || '').trim();
  // light (fără relații) pentru numărare/paginare; hidratăm doar pagina afișată.
  const all = query ? DB.listBusinessesLight({ q: query }) : [];
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const p = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
  const businesses = all.slice((p - 1) * pageSize, p * pageSize).map(b => DB.getBusiness(b.id)).filter(Boolean);
  const baseHref = '/buscar?q=' + encodeURIComponent(query);
  const pg = query && all.length ? { page: p, pages, baseHref } : null;
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Búsqueda' }])}
      <header class="page-head"><h1>${query ? `Resultados para “${esc(query)}”` : 'Buscar'}</h1>
      <form class="page-search" action="/buscar" method="get"><input type="search" name="q" value="${attr(query)}" placeholder="Fontanero, cerrajero, Salamanca…" autofocus><button class="btn btn-primary">Buscar</button></form>
      ${query ? `<p class="page-count">${all.length} ${all.length === 1 ? 'resultado' : 'resultados'}${pages > 1 ? ` · página ${p} de ${pages}` : ''}</p>` : ''}</header>
      ${query ? grid(ctx, businesses, `No hemos encontrado resultados para “${esc(query)}”. Prueba con otro término o explora por servicio.`) + paginationNav(ctx, pg) : chipRow('Servicios', DB.getCategoryTree().map(c => ({ name: c.name, href: `/${c.slug}` })))}
    </div>`;
  return renderLayout(ctx, {
    title: query ? `“${query}”${p > 1 ? ` — página ${p}` : ''} | ${SITE.name}` : `Buscar | ${SITE.name}`,
    description: `Busca ${servicesPhrase(5)} en Madrid.`,
    canonical: abs(ctx, '/buscar'),
    robots: 'noindex,follow',   // páginas de resultados de búsqueda interna: no indexar
    prev: pg && p > 1 ? abs(ctx, pageHref(baseHref, p - 1)) : null,
    next: pg && p < pages ? abs(ctx, pageHref(baseHref, p + 1)) : null,
    body,
  });
}

/* ------------------------- Empresas destacadas ----------------------- */
/* Pagina publică `/destacadas`: lista curată „home" (membership), paginată 20/pagină. */
function renderDestacadas(ctx, page) {
  let r = DB.listHome({ page });
  if (r.total === 0) r = DB.listForContext('home', {}, { page }); // fallback: toate, shuffle „home"
  const cats = DB.getCategoryTree();
  const related = [chipRow('Explora por servicio', cats.map(c => ({ name: c.name, href: `/${c.slug}` })))];
  return listingPage(ctx, {
    title: `Empresas destacadas en Madrid | ${SITE.name}`,
    description: `Selección de empresas destacadas de ${servicesPhrase(5)} en la Comunidad de Madrid.`,
    canonical: abs(ctx, '/destacadas'),
    h1: 'Empresas destacadas en Madrid',
    intro: `Nuestra selección de profesionales en la Comunidad de Madrid: ${servicesPhrase()}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: 'Empresas destacadas' }],
    businesses: r.items, total: r.total,
    pagination: { page: r.page, pages: r.pages, baseHref: '/destacadas' },
    related,
    emptyMsg: 'Aún no hay empresas destacadas seleccionadas.',
  });
}

/* ----------------------------- Páginas legales ----------------------- */
/* Datos del titular. El CUI (código fiscal) se puede fijar por .env
   (LEGAL_NIF); si está vacío, simplemente no se muestra. */
const LEGAL_ENTITY = {
  razon: process.env.LEGAL_RAZON || 'Refluxe Loial SRL',
  nif: process.env.LEGAL_NIF || '49608691',
  domicilio: process.env.LEGAL_DOMICILIO || 'Bacău, Rumanía',
};
function legalDocs() {
  const E = LEGAL_ENTITY;
  const nifPart = E.nif ? `, con código de identificación fiscal (CUI) ${esc(E.nif)}` : '';
  const mail = `<a href="mailto:${attr(SITE.email)}">${esc(SITE.email)}</a>`;
  const contacto = `correo electrónico ${mail} y el <a href="/contacto">formulario de contacto</a>`;
  const titular = `<strong>${esc(E.razon)}</strong> (en adelante, «${esc(SITE.name)}»)${nifPart}, con domicilio en ${esc(E.domicilio)}, y contacto por ${contacto}`;
  return {
    'aviso-legal': {
      title: `Aviso legal | ${SITE.name}`,
      h1: 'Aviso legal',
      description: 'Información legal del titular del sitio web conforme a la LSSI-CE.',
      sections: [
        ['1. Titular del sitio web', `<p>En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el titular de este sitio web es ${titular}.</p>`],
        ['2. Objeto', `<p>${esc(SITE.name)} es un directorio en línea que facilita el contacto entre usuarios y profesionales o empresas de ${esc(servicesPhrase())} en la Comunidad de Madrid. ${esc(SITE.name)} no ejecuta directamente las obras ni los servicios anunciados: actúa únicamente como plataforma de información. Es un proyecto de Listo247, gestionado por el mismo titular.</p>`],
        ['3. Condiciones de uso', `<p>El acceso a este sitio web es gratuito y atribuye la condición de usuario, que acepta las presentes condiciones. El usuario se compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades ilícitas o contrarias a la buena fe.</p>`],
        ['4. Propiedad intelectual e industrial', `<p>Los contenidos del sitio (textos, diseño, logotipos, código y demás elementos) son titularidad de ${esc(SITE.name)} o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción sin autorización expresa.</p>`],
        ['5. Responsabilidad', `<p>${esc(SITE.name)} no se responsabiliza de la veracidad, calidad o resultado de los servicios prestados por los profesionales y empresas listados, ni de los acuerdos que el usuario alcance con ellos. Recomendamos verificar la información y solicitar presupuesto por escrito antes de contratar.</p>`],
        ['6. Legislación aplicable', `<p>Las presentes condiciones se rigen por la legislación española. Para la resolución de cualquier controversia, las partes se someten a los Juzgados y Tribunales de Madrid, salvo que la normativa de consumo disponga otro fuero.</p>`],
      ],
    },
    'privacidad': {
      title: `Política de privacidad | ${SITE.name}`,
      h1: 'Política de privacidad',
      description: 'Cómo tratamos tus datos personales conforme al RGPD y la LOPDGDD.',
      sections: [
        ['1. Responsable del tratamiento', `<p>El responsable del tratamiento de tus datos es ${titular}.</p>`],
        ['2. Datos que tratamos y finalidad', `<p>Tratamos los datos de contacto que nos facilitas al comunicarte con nosotros o al solicitar presupuesto a un profesional (nombre, teléfono, correo electrónico y el contenido de tu consulta), así como datos de navegación. Los usamos para gestionar tu solicitud, ponerte en contacto con el profesional adecuado y para la analítica y mejora del sitio.</p>`],
        ['3. Legitimación', `<p>La base legal es tu <em>consentimiento</em> al remitir una solicitud y el <em>interés legítimo</em> en mantener y mejorar el servicio.</p>`],
        ['4. Conservación', `<p>Conservamos los datos durante el tiempo necesario para atender tu solicitud y, después, durante los plazos legalmente exigibles. Cuando dejen de ser necesarios, se suprimen de forma segura.</p>`],
        ['5. Destinatarios', `<p>Tus datos podrán comunicarse al profesional o empresa al que solicites presupuesto y a los proveedores tecnológicos que prestan servicios de alojamiento e infraestructura, siempre con las debidas garantías. No se realizan transferencias internacionales sin garantías adecuadas.</p>`],
        ['6. Tus derechos', `<p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ${mail} o mediante el <a href="/contacto">formulario de contacto</a>, indicando el derecho que deseas ejercer. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener nofollow">www.aepd.es</a>).</p>`],
      ],
    },
    'cookies': {
      title: `Política de cookies | ${SITE.name}`,
      h1: 'Política de cookies',
      description: 'Información sobre las cookies que utiliza este sitio web.',
      sections: [
        ['1. ¿Qué son las cookies?', `<p>Una cookie es un pequeño fichero que se descarga en tu dispositivo al acceder a determinadas páginas web y que permite, entre otras cosas, recordar tus preferencias o recopilar información estadística sobre la navegación.</p>`],
        ['2. Cookies que utilizamos', `<p><strong>Cookies técnicas o necesarias:</strong> imprescindibles para el funcionamiento del sitio (por ejemplo, mantener la sesión o recordar tu decisión sobre las cookies). No requieren consentimiento.</p><p><strong>Cookies analíticas:</strong> nos ayudan a entender cómo se usa el sitio para mejorarlo. Solo se activan con tu consentimiento.</p>`],
        ['3. Gestión de cookies', `<p>Puedes aceptar o rechazar las cookies no necesarias a través del aviso que aparece al entrar en el sitio. Además, puedes configurar o eliminar las cookies desde las opciones de tu navegador en cualquier momento.</p>`],
      ],
    },
    'condiciones': {
      title: `Condiciones de uso | ${SITE.name}`,
      h1: 'Condiciones de uso',
      description: 'Términos y condiciones de uso del directorio.',
      sections: [
        ['1. Aceptación', `<p>El uso de ${esc(SITE.name)} implica la aceptación plena de estas condiciones y del <a href="/aviso-legal">Aviso legal</a> y la <a href="/privacidad">Política de privacidad</a>.</p>`],
        ['2. Uso del directorio', `<p>La información publicada tiene carácter orientativo. El usuario es responsable de verificar los datos de cada profesional y de acordar directamente con él las condiciones del servicio.</p><p>Las fichas marcadas como <strong>Verificado</strong> han sido reclamadas por el propio negocio y comprobadas por nuestro equipo. Las marcadas como <strong>Patrocinado</strong> son espacios publicitarios contratados por el negocio.</p>`],
        ['3. Exención de responsabilidad', `<p>${esc(SITE.name)} no interviene en la contratación ni garantiza la disponibilidad, calidad o precio de los servicios ofrecidos por terceros, y no será responsable de los daños derivados de dicha relación.</p>`],
        ['4. Modificaciones', `<p>${esc(SITE.name)} podrá modificar en cualquier momento estas condiciones, así como los contenidos y servicios del sitio, publicando la versión vigente en esta misma página.</p>`],
      ],
    },
  };
}
function renderLegal(ctx, slug) {
  const docs = legalDocs();
  const doc = docs[slug];
  if (!doc) return null;
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: doc.h1 }])}
      <article class="legal">
        <header class="page-head"><h1>${esc(doc.h1)}</h1><p class="page-count">Última actualización: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p></header>
        ${doc.sections.map(([h, html]) => `<section class="legal-section"><h2>${esc(h)}</h2>${html}</section>`).join('')}
        <p class="legal-links">Consulta también: <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Política de privacidad</a> · <a href="/cookies">Política de cookies</a> · <a href="/condiciones">Condiciones de uso</a></p>
      </article>
    </div>`;
  return renderLayout(ctx, {
    title: doc.title, description: doc.description, canonical: abs(ctx, `/${slug}`), body,
    robots: 'noindex,follow',   // páginas legales: útiles, pero no aportan nada en Google
    jsonLd: [jsonLdBreadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: doc.h1 }])],
  });
}

function render404(ctx, message) {
  const body = `<div class="container"><div class="empty empty-404">
      <h1>Página no encontrada</h1>
      <p>${esc(message || 'La página que buscas no existe o ha cambiado de dirección.')}</p>
      <p><a class="btn btn-primary" href="/">Volver al inicio</a></p>
      ${chipRow('Servicios', DB.getCategoryTree().map(c => ({ name: c.name, href: `/${c.slug}` })))}
    </div></div>`;
  return renderLayout(ctx, { title: `Página no encontrada | ${SITE.name}`, description: '', canonical: abs(ctx, ctx.path || '/'), body });
}

function render500(ctx) {
  const body = `<div class="container"><div class="empty empty-404">
      <h1>Algo ha ido mal</h1>
      <p>Ha ocurrido un error en el servidor. Vuelve a intentarlo en unos instantes.</p>
      <p><a class="btn btn-primary" href="/">Volver al inicio</a></p>
    </div></div>`;
  return renderLayout(ctx, { title: `Error del servidor | ${SITE.name}`, description: '', canonical: abs(ctx, ctx.path || '/'), robots: 'noindex,follow', body });
}

/* ----------------------- Historias de profesionales ------------------- */
/* Markdown mínimo y seguro (sin dependencias): primero se escapa todo y luego
   se admiten ## / ### (títulos), listas, citas (>), **negrita**, *cursiva* y
   enlaces [texto](url). Enlaces externos: nofollow, salvo la web del propio
   negocio (enlace editorial) o rel="sponsored" si la historia es de pago. */
function hostOf(u) { try { return new URL(u).host.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function renderStoryBody(md, opts) {
  opts = opts || {};
  const bizHost = opts.website ? hostOf(opts.website) : '';
  const relFor = raw => {
    if (bizHost && hostOf(raw) === bizHost) return opts.sponsored ? 'sponsored noopener' : 'noopener';
    return 'nofollow noopener';
  };
  const inline = t => t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const raw = url.replace(/&amp;/g, '&');
      if (raw.startsWith('/')) return `<a href="${url}">${label}</a>`;
      if (!/^https?:\/\//i.test(raw)) return label;
      return `<a href="${url}" target="_blank" rel="${relFor(raw)}">${label}</a>`;
    });
  const out = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(esc(para.join(' ')))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.t}>${list.items.map(i => `<li>${inline(esc(i))}</li>`).join('')}</${list.t}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote><p>${inline(esc(quote.join(' ')))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  String(md || '').replace(/\r\n?/g, '\n').split('\n').forEach(rawLine => {
    const line = rawLine.replace(/\s+$/, '');
    let m;
    if (!line.trim()) return flushAll();
    if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) { flushAll(); const lvl = m[1].length === 3 ? 3 : 2; out.push(`<h${lvl}>${inline(esc(m[2]))}</h${lvl}>`); return; }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); return; }
    if ((m = /^[-*]\s+(.+)$/.exec(line))) { flushPara(); flushQuote(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); return; }
    if ((m = /^\d+[.)]\s+(.+)$/.exec(line))) { flushPara(); flushQuote(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); return; }
    flushList(); flushQuote(); para.push(line.trim());
  });
  flushAll();
  return out.join('\n');
}
function storyWords(st) { return String(st.body || '').split(/\s+/).filter(Boolean).length; }
function storyBiz(st) { return st.business_id ? DB.getBusiness(st.business_id) : null; }
function storyPrimaryCat(b) { return b ? ((b.categories || []).find(c => !c.parent_id) || (b.categories || [])[0] || null) : null; }
function storyCover(st, b) { return st.cover || (st.photos && st.photos[0]) || svgPlaceholder(b ? b.name : st.title, 'Historia'); }
function storyCard(ctx, st) {
  const b = storyBiz(st);
  const cat = storyPrimaryCat(b);
  const href = '/historias/' + attr(st.id);
  return `<article class="story-card">
      <a class="story-media" href="${href}"><img src="${attr(storyCover(st, b))}" alt="${attr(st.title)}" loading="lazy" /></a>
      <div class="story-body">
        <span class="story-kicker">Historia${cat ? ' · ' + esc(cat.name) : ''}${st.sponsored ? ' · Patrocinado' : ''}</span>
        <h3><a href="${href}">${esc(st.title)}</a></h3>
        ${st.excerpt ? `<p>${esc(st.excerpt)}</p>` : ''}
        ${b ? `<span class="story-biz">${icon('pin')}${esc(b.name)}${b.zone ? ' · ' + esc(b.zone) : ''}</span>` : ''}
      </div>
    </article>`;
}
/* Franja «Historias» (portada, categorías, zonas): hasta 3 tarjetas. */
function storyStrip(ctx, title, stories, moreHref) {
  if (!stories || !stories.length) return '';
  return `<section class="story-strip">
      <div class="section-head"><h2>${esc(title)}</h2>${moreHref ? `<a class="section-link" href="${attr(moreHref)}">Ver todas ${icon('arrow')}</a>` : ''}</div>
      <div class="story-grid">${stories.map(st => storyCard(ctx, st)).join('')}</div>
    </section>`;
}
const STORY_AUTHOR = ctx => ({ '@type': 'Person', name: 'Emanuel', url: abs(ctx, '/sobre-nosotros'), worksFor: { '@id': abs(ctx, '/#organization') } });

function renderStoriesIndex(ctx, page, categoria) {
  const cats = DB.getCategoryTree();
  const cat = categoria ? cats.find(c => c.slug === String(categoria)) : null;
  const filter = { status: 'published', categorySlug: cat ? cat.slug : undefined };
  const total = DB.countStories(filter);
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
  const items = DB.listStories(Object.assign({}, filter, { limit: pageSize, offset: (p - 1) * pageSize }));
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Historias' }];
  const catChips = cats.filter(c => DB.countStories({ status: 'published', categorySlug: c.slug }) > 0)
    .map(c => `<a class="chip${cat && cat.id === c.id ? ' chip-more' : ''}" href="/historias?categoria=${attr(c.slug)}">${esc(c.name)}</a>`).join('');
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <header class="page-head">
        <h1>Historias de profesionales de Madrid${cat ? ': ' + esc(cat.name.toLowerCase()) : ''}</h1>
        <p class="page-intro">Fontaneros, electricistas, cerrajeros o talleres de Madrid contados por ellos mismos: cómo empezaron, un trabajo del que están orgullosos y sus consejos para los clientes.</p>
      </header>
      ${catChips ? `<div class="chips story-filter"><a class="chip${cat ? '' : ' chip-more'}" href="/historias">Todas</a>${catChips}</div>` : ''}
      ${items.length ? `<div class="story-grid story-grid-lg">${items.map(st => storyCard(ctx, st)).join('')}</div>` : `<div class="empty"><p>Pronto publicaremos las primeras historias.</p><p class="empty-sub">¿Tienes un negocio? <a href="/profesionales#historia">Cuéntanos tu historia</a>.</p></div>`}
      ${paginationNav(ctx, { page: p, pages, baseHref: cat ? '/historias?categoria=' + cat.slug : '/historias' })}
      <section class="story-cta"><div><h2>¿Quieres que escribamos sobre tu negocio?</h2><p>Es gratis. Hacemos una entrevista de 15 minutos y publicamos tu historia enlazada a tu ficha.</p></div><a class="btn btn-primary" href="/profesionales#historia">Cuéntanos tu historia</a></section>
    </div>`;
  const onPageN = p > 1;
  return renderLayout(ctx, {
    title: `Historias de profesionales de Madrid${onPageN ? ` — página ${p}` : ''} | ${SITE.name}`,
    description: 'Historias de fontaneros, electricistas, cerrajeros, reformistas y talleres de Madrid: cómo trabajan, sus mejores trabajos y sus consejos.',
    canonical: abs(ctx, onPageN && !cat ? '/historias?page=' + p : '/historias'),
    // Filtros por categoría y listado vacío: no indexar.
    robots: cat || !total ? 'noindex,follow' : undefined,
    body, jsonLd: [jsonLdBreadcrumb(ctx, crumbs)],
  });
}

function renderStory(ctx, st) {
  const b = storyBiz(st);
  const cat = storyPrimaryCat(b);
  const url = abs(ctx, '/historias/' + st.id);
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Historias', href: '/historias' }, { name: st.title }];
  const words = storyWords(st);
  const minutes = Math.max(1, Math.round(words / 200));
  const dateTxt = new Date((st.published_at || st.updated_at || st.created_at) * 1000).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const siteRel = st.sponsored ? 'sponsored noopener' : 'noopener';
  const related = cat ? DB.listStories({ status: 'published', categorySlug: cat.slug, limit: 4 }).filter(x => x.id !== st.id).slice(0, 3) : [];
  const gallery = (st.photos || []).filter(Boolean);
  const bizBox = b ? `<aside class="story-biz-box">
        <span class="story-biz-label">Sobre el negocio</span>
        <b class="story-biz-name">${esc(b.name)}</b>
        ${b.claimed ? verifiedBadge() : ''}
        <span class="story-biz-zone">${icon('pin')}${esc(b.zone || 'Madrid')}</span>
        <div class="story-biz-actions">
          <a class="btn btn-primary btn-sm" href="/negocio/${attr(b.id)}">Ver ficha</a>
          ${b.website ? `<a class="btn btn-ghost btn-sm" href="${attr(b.website)}" target="_blank" rel="${siteRel}">Visitar web</a>` : ''}
        </div>
        ${cat && b.district && covCount('catMun', cat.slug + '|' + b.district.slug) >= MIN_LISTING ? `<a class="story-biz-more" href="/${attr(cat.slug)}/${attr(b.district.slug)}">Más ${esc(cat.name.toLowerCase())} en ${esc(b.district.name)}</a>` : ''}
      </aside>` : '';
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', headline: st.title.slice(0, 110), description: st.excerpt || undefined,
    image: abs(ctx, st.cover && !st.cover.startsWith('data:') ? st.cover : '/assets/img/og-profesionales-madrid.jpg'),
    datePublished: new Date((st.published_at || st.created_at) * 1000).toISOString(),
    dateModified: new Date((st.updated_at || st.published_at || st.created_at) * 1000).toISOString(),
    author: STORY_AUTHOR(ctx), publisher: { '@id': abs(ctx, '/#organization') }, mainEntityOfPage: url,
    about: b ? { '@id': abs(ctx, '/negocio/' + b.id) + '#business' } : undefined,
  };
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="story">
        <header class="story-head">
          ${st.sponsored ? '<p class="story-sponsored">Contenido patrocinado</p>' : ''}
          <span class="story-kicker">Historia${cat ? ' · ' + esc(cat.name) : ''}</span>
          <h1>${esc(st.title)}</h1>
          ${st.excerpt ? `<p class="story-lead">${esc(st.excerpt)}</p>` : ''}
          <p class="story-meta">Por Emanuel, de ${esc(SITE.name)} · ${esc(dateTxt)} · ${minutes} min de lectura</p>
        </header>
        <div class="story-layout">
          <div class="story-main">
            ${st.cover || gallery.length ? `<figure class="story-cover"><img src="${attr(storyCover(st, b))}" alt="${attr(st.title)}" /></figure>` : ''}
            <div class="story-content">${renderStoryBody(st.body, { website: b && b.website, sponsored: st.sponsored })}</div>
            ${gallery.length > (st.cover ? 0 : 1) ? `<section class="story-gallery">${gallery.slice(st.cover ? 0 : 1).map(src => `<a href="${attr(src)}" target="_blank" rel="noopener"><img src="${attr(src)}" alt="${attr((b ? b.name : st.title) + ' — trabajo')}" loading="lazy" /></a>`).join('')}</section>` : ''}
          </div>
          <div class="story-side">
            ${bizBox}
            ${b ? leadForm({ businessId: b.id, context: 'Historia: ' + st.title, compact: true, title: `Pide presupuesto a ${b.name}`, sub: 'Gratis y sin compromiso. Te contactará directamente.' }) : ''}
          </div>
        </div>
      </article>
      ${storyStrip(ctx, 'Más historias', related, '/historias')}
      <section class="story-cta"><div><h2>¿Quieres que escribamos sobre tu negocio?</h2><p>Es gratis. Hacemos una entrevista de 15 minutos y publicamos tu historia enlazada a tu ficha.</p></div><a class="btn btn-primary" href="/profesionales#historia">Cuéntanos tu historia</a></section>
    </div>`;
  return renderLayout(ctx, {
    title: `${st.title} | ${SITE.name}`,
    description: (st.excerpt || st.title).slice(0, 160),
    canonical: url, ogType: 'article',
    ogImage: st.cover && !st.cover.startsWith('data:') ? abs(ctx, st.cover) : undefined,
    bodyClass: 'page-story', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), jsonLd],
  });
}

/* --------------------------- Precios y guías ------------------------- */
function articleJsonLd(ctx, o) {
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline: o.title.slice(0, 110), description: o.description,
    image: abs(ctx, '/assets/img/og-profesionales-madrid.jpg'), datePublished: o.updated + 'T09:00:00+02:00', dateModified: o.updated + 'T09:00:00+02:00',
    author: STORY_AUTHOR(ctx), publisher: { '@id': abs(ctx, '/#organization') }, mainEntityOfPage: abs(ctx, o.path),
  };
}
function topPlaces(catSlug, n) {
  return covered(DB.listDistricts().map(d => ({ name: d.name, href: `/${catSlug}/${d.slug}`, n: covCount('catMun', catSlug + '|' + d.slug) })))
    .sort((a, b) => b.count - a.count).slice(0, n || 8);
}
function renderPreciosIndex(ctx) {
  const cats = DB.getCategoryTree();
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Precios' }];
  const groups = cats.map(c => ({ c, items: PRECIOS.filter(pr => pr.cat === c.slug) })).filter(g => g.items.length);
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <header class="page-head"><h1>Precios orientativos de profesionales en Madrid</h1>
        <p class="page-intro">Cuánto suele costar llamar a un fontanero, abrir una puerta, reformar un baño o hacer una mudanza en la Comunidad de Madrid. Son rangos orientativos con IVA incluido: cada profesional fija sus precios.</p></header>
      <div class="price-index">${groups.map(g => `<section class="price-group"><h2><a href="/${attr(g.c.slug)}">${esc(g.c.name)}</a></h2><ul>${g.items.map(pr => `<li><a href="/precios/${attr(pr.slug)}">${esc(pr.h1)}</a><span>${esc(pr.tabla[0].c)}: <b>${esc(pr.tabla[0].p)}</b></span></li>`).join('')}</ul></section>`).join('')}</div>
      ${authorLine(PRECIOS_UPDATED)}
    </div>`;
  return renderLayout(ctx, {
    title: `Precios de fontanero, electricista, cerrajero y reformas en Madrid | ${SITE.name}`,
    description: 'Precios orientativos en Madrid: fontanero, desatascos, electricista, boletín, cerrajero, reformas de baño y cocina, aire acondicionado, mudanzas, plagas y taller.',
    canonical: abs(ctx, '/precios'), body, jsonLd: [jsonLdBreadcrumb(ctx, crumbs)],
  });
}
function renderPrecio(ctx, pr) {
  const cat = DB.getCategoryBySlug(pr.cat);
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Precios', href: '/precios' }, { name: pr.h1 }];
  const list = (title, items, cls) => items && items.length ? `<section class="price-block"><h2>${esc(title)}</h2><ul class="${cls || ''}">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : '';
  const others = PRECIOS.filter(x => x.slug !== pr.slug && x.cat === pr.cat).concat(PRECIOS.filter(x => x.cat !== pr.cat)).slice(0, 6);
  const places = cat ? topPlaces(cat.slug, 10) : [];
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="content-page">
        <header class="page-head"><h1>${esc(pr.h1)}</h1><p class="page-intro">${esc(pr.lead)}</p>${authorLine(PRECIOS_UPDATED)}</header>
        <div class="content-layout">
          <div class="content-main">
            <section class="price-block">
              <h2>Precios orientativos ${new Date(PRECIOS_UPDATED).getFullYear()}</h2>
              <table class="price-table"><thead><tr><th>Trabajo</th><th>Precio</th></tr></thead><tbody>${pr.tabla.map(r => `<tr><th>${esc(r.c)}${r.n ? `<small>${esc(r.n)}</small>` : ''}</th><td>${esc(r.p)}</td></tr>`).join('')}</tbody></table>
              <p class="price-note">Rangos orientativos en la Comunidad de Madrid, IVA incluido, a partir de presupuestos habituales del sector. Cada profesional fija sus precios: pide siempre presupuesto por escrito.</p>
            </section>
            ${list('Qué hace subir o bajar el precio', pr.factores)}
            ${list('Cómo ahorrar sin arriesgar', pr.ahorro, 'list-ok')}
            ${list('Señales de alerta', pr.alertas, 'list-warn')}
            ${faqSection('Preguntas frecuentes', pr.faq)}
          </div>
          <aside class="content-side">
            ${leadForm({ context: pr.h1, compact: true, title: 'Pide presupuesto gratis', sub: `Te ponemos en contacto con ${cat ? esc(cat.name.toLowerCase()) : 'profesionales'} de tu zona, sin compromiso.` })}
            ${cat ? `<div class="content-links"><h3>${esc(cat.name)} en Madrid</h3><p><a href="/${attr(cat.slug)}">Ver todos los ${esc(cat.name.toLowerCase())} del directorio</a></p>${places.length ? `<div class="chips">${places.map(x => `<a class="chip" href="${attr(x.href)}">${esc(x.name)} <b>${x.count}</b></a>`).join('')}</div>` : ''}</div>` : ''}
            ${guideLinks(pr.guias)}
          </aside>
        </div>
      </article>
      ${chipRow('Otros precios', others.map(x => ({ name: x.h1.replace(/^¿Cuánto (cuesta|cobra) /, '').replace(/\?$/, ''), href: '/precios/' + x.slug })))}
    </div>`;
  const path = '/precios/' + pr.slug;
  return renderLayout(ctx, {
    title: `${pr.h1.replace(/^¿/, '').replace(/\?$/, '')} (precios ${new Date(PRECIOS_UPDATED).getFullYear()}) | ${SITE.name}`,
    description: pr.description, canonical: abs(ctx, path), ogType: 'article', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), articleJsonLd(ctx, { title: pr.h1, description: pr.description, updated: PRECIOS_UPDATED, path }), faqJsonLd(pr.faq)],
  });
}
function renderGuiasIndex(ctx) {
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Guías' }];
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <header class="page-head"><h1>Guías para contratar profesionales en Madrid</h1>
        <p class="page-intro">Qué hacer ante una fuga, cómo evitar abusos de cerrajeros, cuándo necesitas el boletín eléctrico o una licencia de obra, y tus derechos en el taller.</p></header>
      <div class="guide-grid">${GUIAS.map(g => `<a class="guide-card" href="/guias/${attr(g.slug)}"><b>${esc(g.h1)}</b><span>${esc(g.lead)}</span></a>`).join('')}</div>
    </div>`;
  return renderLayout(ctx, {
    title: `Guías para contratar profesionales en Madrid | ${SITE.name}`,
    description: 'Guías prácticas para contratar fontaneros, cerrajeros, electricistas, reformas, mudanzas y talleres en Madrid sin sorpresas.',
    canonical: abs(ctx, '/guias'), body, jsonLd: [jsonLdBreadcrumb(ctx, crumbs)],
  });
}
function renderGuia(ctx, g) {
  const cat = DB.getCategoryBySlug(g.cat);
  const c = cat ? CATEGORIAS[cat.slug] : null;
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Guías', href: '/guias' }, { name: g.h1 }];
  const others = GUIAS.filter(x => x.slug !== g.slug).slice(0, 6);
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="content-page">
        <header class="page-head"><h1>${esc(g.h1)}</h1><p class="page-intro">${esc(g.lead)}</p>${authorLine(g.updated)}</header>
        <div class="content-layout">
          <div class="content-main guide-body">
            ${g.sections.map(sec => `<section><h2>${esc(sec.h2)}</h2>${(sec.p || []).map(t => `<p>${esc(t)}</p>`).join('')}${sec.list ? `<ul>${sec.list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</section>`).join('')}
            ${faqSection('Preguntas frecuentes', g.faq)}
          </div>
          <aside class="content-side">
            ${cat ? leadForm({ context: g.h1, compact: true, title: `¿Necesitas ${esc(cat.name.toLowerCase())}?`, sub: 'Pide presupuesto gratis a profesionales de tu zona.' }) : ''}
            ${cat ? `<div class="content-links"><h3>${esc(cat.name)} en Madrid</h3><p><a href="/${attr(cat.slug)}">Ver ${esc(cat.name.toLowerCase())} del directorio</a></p>${c && precioBySlug(c.precio) ? `<p><a href="/precios/${attr(c.precio)}">Precios orientativos</a></p>` : ''}</div>` : ''}
          </aside>
        </div>
      </article>
      ${chipRow('Más guías', others.map(x => ({ name: x.h1, href: '/guias/' + x.slug })))}
    </div>`;
  const path = '/guias/' + g.slug;
  return renderLayout(ctx, {
    title: `${g.h1} | ${SITE.name}`, description: g.description, canonical: abs(ctx, path), ogType: 'article', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), articleJsonLd(ctx, { title: g.h1, description: g.description, updated: g.updated, path }), faqJsonLd(g.faq)],
  });
}

/* --------------------------- Para profesionales ---------------------- */
const ALTA_OK = 'Recibido. Te llamaremos en las próximas 48 horas laborables para completar tu ficha.';
function altaForm(cats, selected) {
  return proForm({
    kind: 'alta', context: 'Alta de negocio', submit: 'Quiero aparecer gratis', hint: 'Sin coste · Sin permanencia', ok: ALTA_OK,
    fields: [
      { name: 'negocio', label: 'Nombre del negocio', required: true },
      { name: 'oficio', label: 'Servicio', type: 'select', options: cats.map(c => ({ value: c.name, label: c.name, selected: c.slug === selected })).concat([{ value: 'Otro', label: 'Otro servicio' }]) },
      { name: 'name', label: 'Tu nombre', required: true, autocomplete: 'name' },
      { name: 'phone', label: 'Teléfono', type: 'tel', required: true, autocomplete: 'tel', placeholder: '600 000 000' },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'tu@email.com' },
      { name: 'zona', label: 'Municipio o distrito', placeholder: 'Ej.: Getafe, Chamberí…' },
      { name: 'web', label: 'Web (si tienes)', type: 'url', full: true, placeholder: 'https://' },
    ],
  });
}
function historiaForm() {
  return proForm({
    kind: 'historia', context: 'Historia de profesional', submit: 'Quiero mi historia', hint: 'Gratis',
    ok: 'Recibido. Te llamaremos para preparar la entrevista (son 15 minutos).',
    fields: [
      { name: 'negocio', label: 'Nombre del negocio', required: true },
      { name: 'name', label: 'Tu nombre', required: true, autocomplete: 'name' },
      { name: 'phone', label: 'Teléfono', type: 'tel', required: true, autocomplete: 'tel', placeholder: '600 000 000' },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'tu@email.com' },
      { name: 'porque', label: '¿Qué hace especial a tu negocio?', type: 'textarea', rows: 3, full: true, placeholder: 'En dos líneas: cómo empezaste, en qué eres especialista, un trabajo del que estés orgulloso…' },
    ],
  });
}
/* Resultados del buscador «¿ya apareces?» (/profesionales?q=). */
function claimResults(query) {
  if (!query) return '';
  const found = DB.searchBusinessesForClaim(query, 20);
  if (!found.length) return `<div class="empty"><p>No encontramos «${esc(query)}» en el directorio.</p><p class="empty-sub">Prueba con el teléfono de la ficha o <a href="#alta">date de alta gratis</a>.</p></div>`;
  return `<ul class="pro-results">${found.map(b => `<li>
      <div><b>${esc(b.name)}</b><span>${esc(b.zone || 'Madrid')}${(b.categories || []).length ? ' · ' + esc(b.categories.map(c => c.name).join(', ')) : ''}</span></div>
      ${b.claimed ? verifiedBadge() : `<a class="btn btn-primary btn-sm" href="/negocio/${attr(b.id)}#reclamar">Reclamar esta ficha</a>`}
    </li>`).join('')}</ul>`;
}
function proSearchBlock(query, title) {
  return `<section class="container section pro-search" id="buscar-ficha">
      <div class="section-head"><h2>${esc(title || '¿Ya apareces? Búscate')}</h2></div>
      <form class="page-search" action="/profesionales#buscar-ficha" method="get" role="search">
        <input type="search" name="q" value="${attr(query || '')}" placeholder="Nombre del negocio o teléfono" aria-label="Nombre del negocio o teléfono">
        <button class="btn btn-primary">Buscar mi ficha</button>
      </form>
      ${claimResults(query)}
    </section>`;
}
function listo247Box(campaign, path, anchor) {
  return `<section class="container section">
      <div class="pro-listo">
        <h2>¿Quieres salir arriba también en Google Maps?</h2>
        <p>El directorio te da una ficha más. Pero la mayoría de las llamadas se deciden en el mapa de Google, y ahí manda quien tiene la ficha mejor trabajada. De eso se encarga <a href="${attr(listo247Link(campaign, path))}" target="_blank" rel="noopener">Listo247, ${esc(anchor || 'con la gestión de tu ficha de Google en Madrid')}</a>: publica en tu ficha, contesta tus reseñas y te enseña cada mes cuánto has subido en tu barrio.</p>
        <p class="pro-listo-note">Listo247 es la empresa que está detrás de este directorio. Aparecer aquí no te obliga a contratar nada.</p>
      </div>
    </section>`;
}
const BENEFITS = [
  ['check', 'Insignia ✓ Verificado', 'Le dice al cliente que hemos hablado contigo y que el teléfono es tuyo.'],
  ['users', 'Por delante en tu zona', 'En los listados, las fichas verificadas aparecen antes que las demás.'],
  ['doc', 'Solicitudes de presupuesto', 'Los clientes te escriben desde tu ficha. Sin intermediarios y sin comisiones.'],
  ['shield', 'Sello para tu web', 'Te damos la insignia «Verificado en Profesionales Madrid» para tu página.'],
];

function renderProfesionales(ctx, q) {
  const query = String(q || '').trim().slice(0, 80);
  const cats = DB.getCategoryTree();
  const total = DB.countBusinesses();
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Profesionales' }];
  const body = `
    <section class="pro-hero">
      <div class="container pro-hero-inner">
        ${breadcrumb(ctx, crumbs)}
        <p class="hero-eyebrow">Para profesionales</p>
        <h1>Da de alta tu negocio gratis en Madrid</h1>
        <p class="pro-lead">Ya hay ${fmtInt(total)} profesionales en el directorio. Si el tuyo está, reclama la ficha; si no, date de alta. Sin coste y sin permanencia.</p>
        <div class="pro-ctas"><a class="btn btn-primary" href="#buscar-ficha">Buscar mi negocio</a><a class="btn btn-ghost" href="#alta">Alta nueva</a></div>
        ${proContact('Hola, quiero dar de alta mi negocio en Profesionales Madrid.')}
      </div>
    </section>
    <section class="container section">
      <div class="section-head"><h2>Cómo funciona</h2></div>
      <ol class="steps">
        <li><b>Busca tu ficha o date de alta</b><span>Si ya apareces, reclámala. Si no, rellena el alta: son dos minutos.</span></li>
        <li><b>Te llamamos para verificar</b><span>Llamamos al teléfono de la ficha para comprobar que el negocio es tuyo.</span></li>
        <li><b>Publicamos tu ficha verificada</b><span>Con tu descripción, tus servicios y la insignia ✓, por delante de las fichas sin verificar de tu zona.</span></li>
      </ol>
      <div class="benefits">${BENEFITS.map(([ic, t, d]) => `<div class="benefit"><span class="benefit-ic">${icon(ic)}</span><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>
    </section>
    ${proSearchBlock(query)}
    <section class="container section" id="alta">
      <div class="pro-split">
        <div><h2>Alta nueva</h2><p>¿Tu negocio no aparece? Déjanos tus datos y lo publicamos. Te llamamos antes para completar la ficha contigo.</p>${proContact('Hola, quiero dar de alta mi negocio en Profesionales Madrid.')}</div>
        <div class="pro-card">${altaForm(cats)}</div>
      </div>
    </section>
    <section class="container section">
      <div class="section-head"><h2>Información por oficio</h2></div>
      <div class="chips">${cats.filter(c => PRO.OFICIOS[c.slug]).map(c => `<a class="chip" href="/profesionales/${attr(c.slug)}">${esc(c.name)}</a>`).join('')}</div>
    </section>
    <section class="container section" id="historia">
      <div class="pro-split">
        <div><h2>¿Quieres que escribamos sobre tu negocio?</h2><p>Publicamos historias de profesionales de Madrid: cómo empezaron, un trabajo del que están orgullosos y sus consejos para los clientes. La historia va enlazada a tu ficha y puedes compartirla con quien quieras. Es gratis.</p></div>
        <div class="pro-card">${historiaForm()}</div>
      </div>
    </section>
    ${listo247Box('profesionales', '/', 'con la gestión de tu ficha de Google en Madrid')}
    <div class="container">${faqSection('Preguntas frecuentes', PRO.FAQ)}</div>`;
  return renderLayout(ctx, {
    title: `Da de alta tu negocio gratis en Madrid | ${SITE.name}`,
    description: 'Aparece gratis en el directorio de profesionales de Madrid. Reclama tu ficha, verifícala y sal por delante de las fichas sin verificar de tu zona.',
    canonical: abs(ctx, '/profesionales'),
    robots: query ? 'noindex,follow' : undefined,     // resultados del buscador: no indexar
    bodyClass: 'page-pro', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), faqJsonLd(PRO.FAQ)],
  });
}

function renderProfesionalesCategoria(ctx, cat) {
  const c = PRO.OFICIOS[cat.slug];
  const cats = DB.getCategoryTree();
  const n = covCount('cat', cat.slug);
  const places = DB.listDistricts().map(d => ({ name: d.name, href: `/${cat.slug}/${d.slug}`, n: covCount('catMun', cat.slug + '|' + d.slug) }))
    .sort((a, b) => b.n - a.n);
  const top = covered(places).slice(0, 10);
  const h1 = c ? c.h1 : `${cat.name}: aparece gratis en el directorio de Madrid`;
  const faq = (c ? c.faq : []).concat(PRO.FAQ.slice(0, 4));
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Profesionales', href: '/profesionales' }, { name: cat.name }];
  const body = `
    <section class="pro-hero">
      <div class="container pro-hero-inner">
        ${breadcrumb(ctx, crumbs)}
        <p class="hero-eyebrow">Para ${esc(cat.name.toLowerCase())}</p>
        <h1>${esc(h1)}</h1>
        ${c ? `<p class="pro-lead">${esc(c.lead)}</p>` : ''}
        <p class="pro-stat">En el directorio hay <b>${fmtInt(n)}</b> ${esc(cat.name.toLowerCase())} de la Comunidad de Madrid. <a href="/${attr(cat.slug)}">Mira cómo los ve el cliente</a>.</p>
        <div class="pro-ctas"><a class="btn btn-primary" href="#buscar-ficha">Buscar mi ficha</a><a class="btn btn-ghost" href="#alta">Alta nueva</a></div>
        ${proContact(`Hola, tengo un negocio de ${cat.name.toLowerCase()} y quiero aparecer en Profesionales Madrid.`)}
      </div>
    </section>
    ${c ? `<section class="container section">
      <div class="section-head"><h2>Qué mira el cliente antes de llamarte</h2></div>
      <div class="benefits benefits-3">${c.puntos.map(x => `<div class="benefit"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div>`).join('')}</div>
    </section>` : ''}
    ${top.length ? `<section class="container section">${chipRow(`Dónde hay más ${cat.name.toLowerCase()} en el directorio`, top)}</section>` : ''}
    ${proSearchBlock('', `¿Ya apareces entre los ${cat.name.toLowerCase()}? Búscate`)}
    <section class="container section" id="alta">
      <div class="pro-split">
        <div><h2>Alta nueva</h2><p>¿Tu negocio no aparece? Déjanos tus datos y lo publicamos. Te llamamos antes para completar la ficha contigo.</p></div>
        <div class="pro-card">${altaForm(cats, cat.slug)}</div>
      </div>
    </section>
    ${listo247Box('profesionales-' + cat.slug, c && c.listo247 ? '/' + c.listo247 : '/', c ? c.anchor : '')}
    <div class="container">${faqSection('Preguntas frecuentes', faq)}</div>`;
  return renderLayout(ctx, {
    title: `${h1} | ${SITE.name}`,
    description: c ? c.lead.slice(0, 155) : `Da de alta gratis tu negocio de ${cat.name.toLowerCase()} en el directorio de profesionales de Madrid.`,
    canonical: abs(ctx, `/profesionales/${cat.slug}`),
    robots: c ? undefined : 'noindex,follow',          // sin texto propio, no la indexamos
    bodyClass: 'page-pro', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), faqJsonLd(faq)],
  });
}

/* ------------------------- Contacto / Sobre nosotros ------------------ */
function renderContacto(ctx, biz) {
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Contacto' }];
  const motivo = biz ? 'Corregir datos de una ficha' : '';
  const form = proForm({
    kind: 'contacto', businessId: biz ? biz.id : null, context: biz ? 'Contacto sobre: ' + biz.name : 'Contacto',
    submit: 'Enviar mensaje', ok: 'Mensaje recibido. Te responderemos en un máximo de 48 horas laborables.',
    fields: [
      { name: 'name', label: 'Nombre', required: true, autocomplete: 'name' },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'tu@email.com' },
      { name: 'phone', label: 'Teléfono (opcional)', type: 'tel', autocomplete: 'tel' },
      { name: 'motivo', label: 'Motivo', type: 'select', options: ['Corregir datos de una ficha', 'Eliminar una ficha', 'Otra consulta'].map(v => ({ value: v, label: v, selected: v === motivo })) },
      { name: 'negocio', label: 'Ficha a la que te refieres (si aplica)', full: true, value: biz ? biz.name : '' },
      { name: 'message', label: 'Mensaje', type: 'textarea', rows: 5, required: true, full: true, placeholder: 'Cuéntanos qué necesitas.' },
    ],
  });
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <header class="page-head"><h1>Contacto</h1>
        <p class="page-intro">Escríbenos para corregir o eliminar una ficha, o para cualquier otra consulta. También puedes enviarnos un email a <a href="mailto:${attr(SITE.email)}">${esc(SITE.email)}</a>.</p></header>
      <div class="pro-split">
        <div class="pro-card">${form}</div>
        <aside class="pro-aside">
          <h2>¿Tienes un negocio?</h2>
          <p>Para darlo de alta o reclamar tu ficha, entra en <a href="/profesionales">Profesionales</a>.</p>
          ${proContact('Hola, tengo un negocio y quiero aparecer en Profesionales Madrid.')}
        </aside>
      </div>
    </div>`;
  return renderLayout(ctx, {
    title: `Contacto | ${SITE.name}`,
    description: 'Contacta con Profesionales Madrid para corregir o eliminar una ficha, o para cualquier consulta sobre el directorio.',
    canonical: abs(ctx, '/contacto'),
    robots: biz ? 'noindex,follow' : undefined,
    body, jsonLd: [jsonLdBreadcrumb(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'ContactPage', url: abs(ctx, '/contacto'), name: 'Contacto', publisher: { '@id': abs(ctx, '/#organization') } }],
  });
}

function renderSobreNosotros(ctx) {
  const crumbs = [{ name: 'Inicio', href: '/' }, { name: 'Cómo funciona el directorio' }];
  const total = DB.countBusinesses();
  const sections = [
    ['Qué es Profesionales Madrid', `<p>Un directorio de profesionales de la Comunidad de Madrid: ${esc(servicesPhrase())}. Hoy reúne ${fmtInt(total)} negocios de Madrid capital y de los 179 municipios de la Comunidad.</p>`],
    ['De dónde salen los datos', '<p>Partimos de los datos públicos de cada negocio: nombre, teléfono, web, zona y número de reseñas en Google. Los propios negocios pueden reclamar su ficha para completarla o corregirla, o pedirnos que la quitemos.</p>'],
    ['Qué significa «Verificado»', '<p>Una ficha verificada la ha reclamado el propio negocio y la hemos comprobado con una llamada al teléfono que figura en ella. Solo esas fichas llevan la insignia ✓ y una descripción escrita por el negocio.</p>'],
    ['Cómo ordenamos los listados', '<p>Primero aparecen las fichas verificadas. Después, el resto, en un orden que rota de forma automática para no favorecer siempre a los mismos. Los espacios marcados como <strong>Patrocinado</strong> son publicidad contratada por el negocio y siempre se identifican como tal.</p>'],
    ['Lo que no hacemos', '<p>No cobramos comisión por los trabajos ni intervenimos en los presupuestos: el cliente habla directamente con el profesional. Tampoco inventamos valoraciones: el número de reseñas que mostramos es el que el negocio tiene en Google.</p>'],
    ['Corregir o eliminar una ficha', '<p>Si una ficha tiene datos incorrectos, o eres el titular y quieres retirarla, escríbenos desde <a href="/contacto">Contacto</a>. Lo hacemos sin pedir explicaciones.</p>'],
    ['Quién está detrás', `<p>Profesionales Madrid es un proyecto de <a href="${attr(listo247Link('sobre-nosotros'))}" target="_blank" rel="noopener">Listo247</a>, una empresa que gestiona fichas de Google para profesionales en Madrid. El directorio es gratuito para los negocios y para los clientes. Los datos del titular están en el <a href="/aviso-legal">Aviso legal</a>.</p>`],
  ];
  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="legal">
        <header class="page-head"><h1>Cómo funciona Profesionales Madrid</h1>
          <p class="page-intro">Qué es el directorio, de dónde salen los datos, cómo ordenamos los listados y quién está detrás.</p></header>
        ${sections.map(([h, html]) => `<section class="legal-section"><h2>${esc(h)}</h2>${html}</section>`).join('')}
        <p class="legal-links">¿Tienes un negocio? <a href="/profesionales">Aparece gratis o reclama tu ficha</a>.</p>
      </article>
    </div>`;
  return renderLayout(ctx, {
    title: `Cómo funciona el directorio | ${SITE.name}`,
    description: 'Qué es Profesionales Madrid, de dónde salen los datos, qué significa «Verificado», cómo se ordenan los listados y quién está detrás.',
    canonical: abs(ctx, '/sobre-nosotros'), body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'AboutPage', url: abs(ctx, '/sobre-nosotros'), name: 'Cómo funciona Profesionales Madrid', publisher: { '@id': abs(ctx, '/#organization') } }],
  });
}

/* ---------------------------- Sitemap / robots ----------------------- */
/* /sitemap.xml es un ÍNDICE con un sub-sitemap por TIPO de página. Search
   Console informa de la indexación de cada sub-sitemap por separado → se ve
   exactamente qué tipo de página acepta o rechaza Google. Cada URL entra solo
   si la página es indexable (mismos umbrales que el meta robots):
     principales · servicios · distritos · municipios · barrios · metro ·
     historias · negocios-N (45k por archivo, < límite de 50k).
   SITEMAP_TYPES (env, separados por comas) limita los grupos publicados, para
   lanzar por olas en un dominio nuevo. Vacío = todos. */
const SITEMAP_CHUNK = 45000;
const SITEMAP_GROUPS = ['principales', 'servicios', 'distritos', 'municipios', 'barrios', 'metro', 'historias', 'negocios'];
const _sitemapCache = new Map();                // per cheie (origin:grup), TTL 10 min
const SITEMAP_TTL = 10 * 60 * 1000;
function _cachedXml(key, build) {
  const hit = _sitemapCache.get(key);
  if (hit && Date.now() - hit.at < SITEMAP_TTL) return hit.xml;
  const xml = build();
  _sitemapCache.set(key, { xml, at: Date.now() });
  return xml;
}
function urlsetXml(ctx, entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url><loc>${esc(abs(ctx, e.loc))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
}
function sitemapTypesEnabled() {
  const raw = String(process.env.SITEMAP_TYPES || '').trim();
  return new Set(raw ? raw.split(/[\s,]+/).filter(Boolean) : SITEMAP_GROUPS);
}
function isoDay(ts) { return ts ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : null; }

/* Páginas fijas/de contenido indexables (las fases siguientes añaden las suyas). */
const STATIC_PAGES = [];
function sitemapEntries(group) {
  const out = [];
  const add = (loc, lastmod) => out.push({ loc, lastmod: lastmod || null });
  const cats = DB.getCategoryTree();
  const allCats = cats.flatMap(c => [c].concat(c.children));
  switch (group) {
    case 'principales':
      add('/'); add('/zonas');
      if (DB.countPlacement('home') >= MIN_LISTING) add('/destacadas');
      if (hasMetroData()) add('/metro');
      add('/profesionales', PRO.UPDATED);
      cats.forEach(c => { if (PRO.OFICIOS[c.slug]) add(`/profesionales/${c.slug}`, PRO.UPDATED); });
      add('/sobre-nosotros'); add('/contacto');
      add('/precios', PRECIOS_UPDATED); PRECIOS.forEach(pr => add('/precios/' + pr.slug, PRECIOS_UPDATED));
      add('/guias', GUIAS.reduce((m, g) => (g.updated > m ? g.updated : m), '')); GUIAS.forEach(g => add('/guias/' + g.slug, g.updated));
      STATIC_PAGES.forEach(pg => add(pg.loc, pg.lastmod));
      break;
    case 'servicios':
      allCats.forEach(c => { if (covCount('cat', c.slug) >= MIN_LISTING) add(`/${c.slug}`); });
      cats.forEach(c => DB.listZones().forEach(z => { if (covCount('catZona', c.slug + '|' + z.slug) >= MIN_LISTING) add(`/${c.slug}/zona/${z.slug}`); }));
      break;
    case 'distritos':
    case 'municipios': {
      const places = group === 'distritos' ? DB.listDistritos() : DB.listMunicipios();
      places.forEach(d => {
        if (covCount('muni', d.slug) >= MIN_LISTING) add(`/zona/${d.slug}`);
        allCats.forEach(c => { if (covCount('catMun', c.slug + '|' + d.slug) >= MIN_LISTING) add(`/${c.slug}/${d.slug}`); });
      });
      break;
    }
    case 'barrios':
      DB.listDistricts().forEach(d => DB.listNeighborhoods(d.id).forEach(b => {
        if (covCount('bar', d.slug + '|' + b.slug) >= MIN_LISTING) add(`/zona/${d.slug}/${b.slug}`);
        allCats.forEach(c => { if (covCount('catBar', c.slug + '|' + d.slug + '|' + b.slug) >= MIN_LISTING) add(`/${c.slug}/${d.slug}/${b.slug}`); });
      }));
      break;
    case 'metro':
      DB.listMetros().forEach(m => {
        if (covCount('metro', m.slug) >= MIN_LISTING) add(`/metro/${m.slug}`);
        allCats.forEach(c => { if (covCount('catMetro', c.slug + '|' + m.slug) >= MIN_LISTING) add(`/${c.slug}/metro/${m.slug}`); });
      });
      break;
    case 'historias':
      storySitemapEntries().forEach(e => add(e.loc, e.lastmod));
      break;
  }
  return out;
}
/* Historias publicadas + el índice /historias (si hay alguna). */
function storySitemapEntries() {
  const list = DB.listStories({ status: 'published' });
  if (!list.length) return [];
  const day = ts => ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null;
  return [{ loc: '/historias', lastmod: day(list[0].updated_at) }]
    .concat(list.map(st => ({ loc: '/historias/' + st.id, lastmod: day(st.updated_at || st.published_at) })));
}

/* /sitemap.xml → índice: solo los grupos activos y con al menos una URL. */
function renderSitemapIndex(ctx) {
  const enabled = sitemapTypesEnabled();
  const maps = SITEMAP_GROUPS.filter(g => g !== 'negocios' && enabled.has(g) && sitemapEntries(g).length).map(g => `/sitemap-${g}.xml`);
  if (enabled.has('negocios')) {
    const nBiz = Math.ceil(DB.countIndexableBusinesses() / SITEMAP_CHUNK);
    for (let i = 1; i <= nBiz; i++) maps.push(`/sitemap-negocios-${i}.xml`);
  }
  const lastmod = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map(m => `  <sitemap><loc>${esc(abs(ctx, m))}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`;
}
/* /sitemap-<grupo>.xml y /sitemap-negocios-<n>.xml. null → 404 (grupo
   desconocido, desactivado o vacío). Cache 10 min por origen. */
function renderSitemapGroup(ctx, name) {
  const enabled = sitemapTypesEnabled();
  const origin = (ctx && ctx.origin) || '';
  const mBiz = /^negocios-(\d+)$/.exec(String(name || ''));
  if (mBiz) {
    if (!enabled.has('negocios')) return null;
    const p = Math.max(1, parseInt(mBiz[1], 10) || 1);
    const rows = DB.listBusinessSitemap((p - 1) * SITEMAP_CHUNK, SITEMAP_CHUNK);
    if (!rows.length) return null;
    return _cachedXml(origin + ':negocios:' + p, () => urlsetXml(ctx, rows.map(b => ({ loc: `/negocio/${b.id}`, lastmod: isoDay(b.lastmod) }))));
  }
  if (!SITEMAP_GROUPS.includes(name) || name === 'negocios' || !enabled.has(name)) return null;
  const entries = sitemapEntries(name);
  if (!entries.length) return null;
  return _cachedXml(origin + ':' + name, () => urlsetXml(ctx, entries));
}

/* robots.txt: los bots de IA van permitidos a propósito (queremos que ChatGPT,
   Perplexity o Claude citen el directorio), con las mismas exclusiones. */
function renderRobots(ctx) {
  const rules = `Allow: /
Disallow: /admin.html
Disallow: /login.html
Disallow: /api/
Disallow: /buscar`;
  return `# ${abs(ctx, '/')}
User-agent: *
${rules}

User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: PerplexityBot
User-agent: ClaudeBot
User-agent: Google-Extended
${rules}

Sitemap: ${abs(ctx, '/sitemap.xml')}
`;
}

module.exports = {
  SITE,
  renderHome, renderCategory, renderCategoryZona, renderDistrict, renderBarrio, renderCategoryMetro,
  renderZoneDistrict, renderZoneBarrio, renderZonesIndex, renderMetroIndex, renderMetroHub,
  renderBusiness, renderDestacadas, renderSearch, renderLegal, render404, render500,
  renderProfesionales, renderProfesionalesCategoria, renderContacto, renderSobreNosotros, renderBadgeSvg, badgeSnippet,
  renderStoriesIndex, renderStory, renderStoryBody,
  renderPreciosIndex, renderPrecio, renderGuiasIndex, renderGuia, precioBySlug, guiaBySlug,
  renderSitemapIndex, renderSitemapGroup, renderRobots,
  MIN_LISTING, SITEMAP_GROUPS, sitemapEntries,
};
