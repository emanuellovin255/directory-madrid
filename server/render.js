/* =========================================================================
   render.js — SSR cu template literals (fără dependențe). Generează paginile
   publice indexabile (SEO): home, categorie, distrito, barrio, metro, ficha
   de negocio, căutare, sitemap, robots. Reutilizează stilurile din
   /assets/css/styles.css. Fiecare pagină: <title>/meta/canonical/H1/JSON-LD
   unice + internal linking dens.
   ========================================================================= */
'use strict';
const DB = require('./db');

const SITE = {
  name: 'Reformas Madrid',
  brandA: 'Reformas',
  brandB: 'Madrid',
  phone: process.env.SITE_PHONE || '+34 911 234 567',
  tagline: 'El directorio de profesionales de reformas y servicios para el hogar en Madrid',
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

function svgPlaceholder(name, label) {
  const initials = String(name || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8102e"/><stop offset="1" stop-color="#7a0a1c"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><text x="50%" y="46%" fill="rgba(255,255,255,.95)" font-family="Arial,Helvetica,sans-serif" font-size="120" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(initials)}</text><text x="50%" y="73%" fill="rgba(255,255,255,.72)" font-family="Arial,Helvetica,sans-serif" font-size="24" letter-spacing="3" text-anchor="middle">${esc(String(label || SITE.name).toUpperCase())}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function bizPhoto(b) {
  if (b.photo) return b.photo;
  const primary = (b.categories || []).find(c => !c.parent_id) || (b.categories || [])[0];
  return svgPlaceholder(b.name, primary ? primary.name : SITE.name);
}

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
  };
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
function trustBadge(ic, title, sub) {
  return `<div class="trust-badge"><span class="trust-ic">${icon(ic)}</span><span class="trust-txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`;
}

function businessCard(ctx, b) {
  const tags = (b.categories || []).slice(0, 3).map(c => `<span class="tag">${esc(c.name)}</span>`).join('');
  const more = (b.categories || []).length > 3 ? `<span class="tag tag-more">+${b.categories.length - 3}</span>` : '';
  const href = '/negocio/' + attr(b.id);
  return `<article class="card">
      <a class="card-media" href="${href}">
        ${b.featured ? `<span class="badge-featured">${icon('star')}Destacado</span>` : ''}
        ${b.rating ? `<span class="card-rating">${icon('star')}${b.rating.toFixed(1)}</span>` : ''}
        <img src="${attr(bizPhoto(b))}" alt="${attr(b.name)}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3 class="card-title"><a href="${href}">${esc(b.name)}</a></h3>
        <span class="card-zone">${icon('pin')}${esc(b.zone || 'Madrid')}</span>
        <div class="card-tags">${tags}${more}</div>
        <div class="card-foot"><a class="card-cta" href="${href}">Ver ficha ${icon('arrow')}</a></div>
      </div>
    </article>`;
}
function grid(ctx, businesses, emptyMsg) {
  if (!businesses.length) return `<div class="empty"><p>${esc(emptyMsg || 'Aún no hay empresas listadas en esta zona.')}</p><p class="empty-sub">¿Eres profesional? Pronto podrás aparecer aquí.</p></div>`;
  return `<div class="grid">${businesses.map(b => businessCard(ctx, b)).join('')}</div>`;
}
function chipRow(title, links) {
  links = (links || []).filter(Boolean);
  if (!links.length) return '';
  return `<section class="linkset"><h2 class="linkset-title">${esc(title)}</h2><div class="chips">${links.map(l => `<a class="chip" href="${attr(l.href)}">${esc(l.name)}${l.count != null ? ` <b>${l.count}</b>` : ''}</a>`).join('')}</div></section>`;
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
  const districts = DB.listDistricts();
  const flagship = cats[0] ? cats[0].slug : 'reformas';
  const megaServicios = cats.map(c => `
      <div class="mega-col">
        <a class="mega-head" href="/${attr(c.slug)}">${esc(c.name)}</a>
        <ul>${c.children.map(s => `<li><a href="/${attr(s.slug)}">${esc(s.name)}</a></li>`).join('')}</ul>
      </div>`).join('');
  const megaZonas = districts.map(d => `<a href="/zona/${attr(d.slug)}">${esc(d.name)}</a>`).join('');
  return `<header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="${attr(SITE.name)} — inicio">
        <span class="brand-logo"><svg viewBox="0 0 24 24" class="brand-mark" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/></svg></span>
        <span class="brand-name">${esc(SITE.brandA)}<b> ${esc(SITE.brandB)}</b><span class="brand-sub">Profesionales de confianza</span></span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Menú" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav" id="mainNav">
        <div class="nav-item has-mega">
          <a class="nav-link" href="/${attr(flagship)}" aria-haspopup="true">Servicios</a>
          <div class="mega"><div class="mega-grid">${megaServicios}</div></div>
        </div>
        <div class="nav-item has-mega">
          <a class="nav-link" href="/zona/${attr(districts[0] ? districts[0].slug : 'centro')}" aria-haspopup="true">Zonas</a>
          <div class="mega mega-zonas"><div class="zonas-grid">${megaZonas}</div></div>
        </div>
        <a class="nav-link" href="/metro">Metro</a>
      </nav>
      <div class="header-actions">
        <a class="header-phone" href="tel:${attr(tel(SITE.phone))}">${icon('phone')}<span>${esc(SITE.phone)}</span></a>
      </div>
    </div>
  </header>`;
}
function renderFooter(ctx) {
  const cats = DB.getCategoryTree();
  const districts = DB.listDistricts().slice(0, 12);
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-col footer-brand">
        <span class="brand-name">${esc(SITE.brandA)}<b> ${esc(SITE.brandB)}</b></span>
        <p>${esc(SITE.tagline)}.</p>
        <a class="header-phone" href="tel:${attr(tel(SITE.phone))}">${icon('phone')}<span>${esc(SITE.phone)}</span></a>
      </div>
      <div class="footer-col"><h4>Servicios</h4><ul>${cats.map(c => `<li><a href="/${attr(c.slug)}">${esc(c.name)} en Madrid</a></li>`).join('')}</ul></div>
      <div class="footer-col"><h4>Zonas</h4><ul>${districts.map(d => `<li><a href="/zona/${attr(d.slug)}">${esc(d.name)}</a></li>`).join('')}</ul></div>
      <div class="footer-col"><h4>Directorio</h4><ul>
        <li><a href="/metro">Buscar por metro</a></li>
        <li><a href="/buscar">Búsqueda</a></li>
        <li><a href="/admin.html">Acceso profesionales</a></li>
      </ul></div>
    </div>
    <div class="container footer-trust">
      ${trustBadge('shield', 'Profesionales verificados', 'Datos y contacto revisados')}
      ${trustBadge('doc', 'Presupuesto sin compromiso', 'Solicítalo sin coste')}
      ${trustBadge('clock', 'Respuesta 24–48 h', 'Atención rápida en Madrid')}
      ${trustBadge('lock', 'Cumplimiento del RGPD', 'Tus datos protegidos')}
    </div>
    <div class="container footer-legal">
      <p>© ${new Date().getFullYear()} ${esc(SITE.name)}. Todos los derechos reservados.</p>
      <nav class="footer-legal-links" aria-label="Legal">
        <a href="/aviso-legal">Aviso legal</a>
        <a href="/privacidad">Política de privacidad</a>
        <a href="/cookies">Política de cookies</a>
        <a href="/condiciones">Condiciones de uso</a>
      </nav>
    </div>
  </footer>`;
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
  <script>(function(){try{var K='rm_cookie_consent',b=document.getElementById('cookieBanner');if(!b)return;if(!localStorage.getItem(K))b.hidden=false;b.addEventListener('click',function(e){var t=e.target.closest('[data-cookie]');if(!t)return;localStorage.setItem(K,t.getAttribute('data-cookie'));b.hidden=true;});}catch(e){}})();</script>`;
}

/* ------------------------------ Layout ------------------------------- */
function renderLayout(ctx, page) {
  const canonical = page.canonical || abs(ctx, ctx.path || '/');
  const jsonLd = [].concat(page.jsonLd || []).filter(Boolean);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${attr(page.description || '')}">
<link rel="canonical" href="${attr(canonical)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:title" content="${attr(page.title)}">
<meta property="og:description" content="${attr(page.description || '')}">
<meta property="og:url" content="${attr(canonical)}">
${page.ogImage ? `<meta property="og:image" content="${attr(page.ogImage)}">` : ''}
<meta name="theme-color" content="#c8102e">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E🛠️%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="/assets/css/styles.css">
${jsonLd.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body class="${page.bodyClass || ''}">
${renderHeader(ctx)}
<main id="contenido">${page.body}</main>
${renderFooter(ctx)}
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
  const body = `
    <div class="container">
      ${breadcrumb(ctx, opts.crumbs)}
      <header class="page-head">
        <h1>${esc(opts.h1)}</h1>
        ${opts.intro ? `<p class="page-intro">${esc(opts.intro)}</p>` : ''}
        <p class="page-count">${businesses.length} ${businesses.length === 1 ? 'empresa' : 'empresas'}</p>
      </header>
      ${opts.subchips || ''}
      ${grid(ctx, businesses, opts.emptyMsg)}
      ${(opts.related || []).join('')}
    </div>`;
  return renderLayout(ctx, {
    title: opts.title, description: opts.description, canonical: opts.canonical,
    jsonLd: [jsonLdBreadcrumb(ctx, opts.crumbs), businesses.length ? jsonLdItemList(ctx, businesses) : null].concat(opts.jsonLd || []),
    body,
  });
}

function renderCategory(ctx, category) {
  const businesses = DB.listBusinesses({ categorySlug: category.slug });
  const districts = DB.listDistricts();
  const subs = DB.getCategory(category.id) && DB.getCategoryTree().find(c => c.id === category.id);
  const subChildren = subs ? subs.children : [];
  const keyMetros = DB.listMetros().slice(0, 10);
  const related = [
    chipRow(`${category.name} por distrito`, districts.map(d => ({ name: d.name, href: `/${category.slug}/${d.slug}` }))),
    chipRow(`${category.name} cerca del metro`, keyMetros.map(m => ({ name: m.name, href: `/${category.slug}/metro/${m.slug}` }))),
  ];
  const subchips = subChildren.length ? chipRow('Especialidades', subChildren.map(s => ({ name: s.name, href: `/${s.slug}` }))) : '';
  const crumbs = [{ name: 'Inicio', href: '/' }];
  if (category.parent_id) { const p = DB.getCategory(category.parent_id); if (p) crumbs.push({ name: p.name, href: `/${p.slug}` }); }
  crumbs.push({ name: category.name });
  return listingPage(ctx, {
    title: `${category.name} en Madrid — presupuestos y opiniones | ${SITE.name}`,
    description: category.intro || `Encuentra ${category.name.toLowerCase()} en Madrid por distrito, barrio y estación de metro. Compara profesionales, opiniones y contacto directo.`,
    canonical: abs(ctx, `/${category.slug}`),
    h1: `${category.name} en Madrid`,
    intro: category.intro,
    crumbs,
    businesses, subchips, related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados. Vuelve pronto.`,
  });
}

function renderDistrict(ctx, category, district) {
  const businesses = DB.listBusinesses({ categorySlug: category.slug, districtSlug: district.slug });
  const barrios = DB.listNeighborhoods(district.id);
  const related = [
    chipRow(`${category.name} por barrio en ${district.name}`, barrios.map(b => ({ name: b.name, href: `/${category.slug}/${district.slug}/${b.slug}` }))),
    chipRow(`${category.name} en otros distritos`, DB.listDistricts().filter(d => d.id !== district.id).slice(0, 12).map(d => ({ name: d.name, href: `/${category.slug}/${d.slug}` }))),
  ];
  return listingPage(ctx, {
    title: `${category.name} en ${district.name} (Madrid) | ${SITE.name}`,
    description: `${category.name} en el distrito de ${district.name}, Madrid. Profesionales cercanos con opiniones y contacto directo, por barrios.`,
    canonical: abs(ctx, `/${category.slug}/${district.slug}`),
    h1: `${category.name} en ${district.name}`,
    intro: `Profesionales de ${category.name.toLowerCase()} en el distrito de ${district.name}. Elige tu barrio para afinar la búsqueda.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: district.name }],
    businesses, related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados en ${district.name}.`,
  });
}

function renderBarrio(ctx, category, district, barrio) {
  const businesses = DB.listBusinesses({ categorySlug: category.slug, districtSlug: district.slug, barrioSlug: barrio.slug });
  const siblings = DB.listNeighborhoods(district.id).filter(b => b.id !== barrio.id);
  const related = [
    chipRow(`Otros barrios de ${district.name}`, siblings.map(b => ({ name: b.name, href: `/${category.slug}/${district.slug}/${b.slug}` }))),
  ];
  return listingPage(ctx, {
    title: `${category.name} en ${barrio.name}, ${district.name} (Madrid) | ${SITE.name}`,
    description: `${category.name} en ${barrio.name} (${district.name}, Madrid). Encuentra un profesional cerca de casa con opiniones y contacto.`,
    canonical: abs(ctx, `/${category.slug}/${district.slug}/${barrio.slug}`),
    h1: `${category.name} en ${barrio.name}`,
    intro: `${category.name} en el barrio de ${barrio.name} (${district.name}). Profesionales de proximidad.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: district.name, href: `/${category.slug}/${district.slug}` }, { name: barrio.name }],
    businesses, related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados en ${barrio.name}.`,
  });
}

function renderCategoryMetro(ctx, category, metro) {
  const businesses = DB.listBusinesses({ categorySlug: category.slug, metroSlug: metro.slug });
  const otherCats = DB.getCategoryTree().filter(c => c.id !== category.id);
  const related = [
    chipRow(`Otros servicios cerca de ${metro.name}`, otherCats.map(c => ({ name: c.name, href: `/${c.slug}/metro/${metro.slug}` }))),
    chipRow(`${category.name} cerca de otras estaciones`, DB.listMetros().filter(m => m.id !== metro.id).slice(0, 12).map(m => ({ name: m.name, href: `/${category.slug}/metro/${m.slug}` }))),
  ];
  const lines = (metro.lines || []).length ? ` (líneas ${metro.lines.join(', ')})` : '';
  return listingPage(ctx, {
    title: `${category.name} cerca de ${metro.name} (metro) | ${SITE.name}`,
    description: `${category.name} cerca de la estación de metro ${metro.name}${lines} en Madrid. Encuentra un profesional a pocos minutos.`,
    canonical: abs(ctx, `/${category.slug}/metro/${metro.slug}`),
    h1: `${category.name} cerca de ${metro.name}`,
    intro: `Profesionales de ${category.name.toLowerCase()} cerca de la estación de metro ${metro.name}${lines}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: category.name, href: `/${category.slug}` }, { name: 'Metro ' + metro.name }],
    businesses, related,
    emptyMsg: `Aún no hay ${category.name.toLowerCase()} listados cerca de ${metro.name}.`,
  });
}

function renderZoneDistrict(ctx, district) {
  const businesses = DB.listBusinesses({ districtSlug: district.slug });
  const cats = DB.getCategoryTree();
  const barrios = DB.listNeighborhoods(district.id);
  const related = [
    chipRow(`Servicios en ${district.name}`, cats.map(c => ({ name: c.name, href: `/${c.slug}/${district.slug}` }))),
    chipRow(`Barrios de ${district.name}`, barrios.map(b => ({ name: b.name, href: `/zona/${district.slug}/${b.slug}` }))),
  ];
  return listingPage(ctx, {
    title: `Empresas y profesionales en ${district.name} (Madrid) | ${SITE.name}`,
    description: `Directorio de fontaneros, electricistas, cerrajeros, climatización y reformas en el distrito de ${district.name}, Madrid.`,
    canonical: abs(ctx, `/zona/${district.slug}`),
    h1: `Profesionales en ${district.name}`,
    intro: `Todos los servicios para el hogar en el distrito de ${district.name}: reformas, fontaneros, electricistas, climatización y cerrajeros.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: 'Zonas', href: `/zona/${district.slug}` }, { name: district.name }],
    businesses, related,
    emptyMsg: `Aún no hay empresas listadas en ${district.name}.`,
  });
}

function renderZoneBarrio(ctx, district, barrio) {
  const businesses = DB.listBusinesses({ districtSlug: district.slug, barrioSlug: barrio.slug });
  const cats = DB.getCategoryTree();
  const related = [
    chipRow(`Servicios en ${barrio.name}`, cats.map(c => ({ name: c.name, href: `/${c.slug}/${district.slug}/${barrio.slug}` }))),
    chipRow(`Otros barrios de ${district.name}`, DB.listNeighborhoods(district.id).filter(b => b.id !== barrio.id).map(b => ({ name: b.name, href: `/zona/${district.slug}/${b.slug}` }))),
  ];
  return listingPage(ctx, {
    title: `Empresas y profesionales en ${barrio.name}, ${district.name} | ${SITE.name}`,
    description: `Profesionales de reformas y servicios para el hogar en ${barrio.name} (${district.name}, Madrid).`,
    canonical: abs(ctx, `/zona/${district.slug}/${barrio.slug}`),
    h1: `Profesionales en ${barrio.name}`,
    intro: `Servicios para el hogar en el barrio de ${barrio.name} (${district.name}).`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: district.name, href: `/zona/${district.slug}` }, { name: barrio.name }],
    businesses, related,
    emptyMsg: `Aún no hay empresas listadas en ${barrio.name}.`,
  });
}

function renderMetroIndex(ctx) {
  const metros = DB.listMetros();
  const cats = DB.getCategoryTree();
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Metro' }])}
      <header class="page-head"><h1>Buscar profesionales por estación de metro</h1>
      <p class="page-intro">Elige tu estación de metro en Madrid y encuentra fontaneros, electricistas, cerrajeros, climatización o reformas cerca de ti.</p></header>
      ${chipRow('Estaciones de metro', metros.map(m => ({ name: m.name, href: `/metro/${m.slug}` })))}
      ${chipRow('Servicios', cats.map(c => ({ name: c.name, href: `/${c.slug}` })))}
    </div>`;
  return renderLayout(ctx, {
    title: `Buscar por metro en Madrid | ${SITE.name}`,
    description: 'Encuentra profesionales de reformas y servicios para el hogar cerca de tu estación de metro en Madrid.',
    canonical: abs(ctx, '/metro'), body,
    jsonLd: [jsonLdBreadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Metro' }])],
  });
}

function renderMetroHub(ctx, metro) {
  const businesses = DB.listBusinesses({ metroSlug: metro.slug });
  const cats = DB.getCategoryTree();
  const lines = (metro.lines || []).length ? ` (líneas ${metro.lines.join(', ')})` : '';
  const related = [chipRow(`Servicios cerca de ${metro.name}`, cats.map(c => ({ name: c.name, href: `/${c.slug}/metro/${metro.slug}` })))];
  return listingPage(ctx, {
    title: `Profesionales cerca de ${metro.name} (metro Madrid) | ${SITE.name}`,
    description: `Empresas de reformas, fontaneros, electricistas, cerrajeros y climatización cerca de la estación ${metro.name}${lines}.`,
    canonical: abs(ctx, `/metro/${metro.slug}`),
    h1: `Profesionales cerca de ${metro.name}`,
    intro: `Servicios para el hogar cerca de la estación de metro ${metro.name}${lines}.`,
    crumbs: [{ name: 'Inicio', href: '/' }, { name: 'Metro', href: '/metro' }, { name: metro.name }],
    businesses, related,
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

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name,
    description: b.about || undefined, telephone: b.phone || undefined, url: b.website || abs(ctx, '/negocio/' + b.id),
    image: b.photo ? abs(ctx, b.photo) : undefined,
    address: { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: 'Madrid', addressRegion: 'Madrid', addressCountry: 'ES' },
    areaServed: b.zone || 'Madrid',
    aggregateRating: b.rating ? { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviews || 0 } : undefined,
  };

  const body = `<div class="container">
      ${breadcrumb(ctx, crumbs)}
      <article class="biz">
        <div class="biz-media">
          ${b.featured ? `<span class="badge-featured">${icon('star')}Destacado</span>` : ''}
          <img src="${attr(bizPhoto(b))}" alt="${attr(b.name)}" />
        </div>
        <div class="biz-head">
          <h1>${esc(b.name)}</h1>
          <p class="biz-zone">${icon('pin')}${esc(b.address || b.zone || 'Madrid')}</p>
          ${b.rating ? `<p class="biz-rating">${icon('star')}<b>${b.rating.toFixed(1)}</b> · ${b.reviews || 0} opiniones</p>` : ''}
          <div class="biz-actions">
            ${b.phone ? `<a class="btn btn-primary" href="tel:${attr(tel(b.phone))}" data-track="phone">${icon('phone')} Llamar</a>` : ''}
            ${b.website ? `<a class="btn btn-ghost" href="${attr(b.website)}" target="_blank" rel="noopener nofollow" data-track="web">Visitar web</a>` : ''}
          </div>
        </div>
      </article>

      <div class="biz-grid">
        <div class="biz-main">
          ${b.about ? `<section class="biz-section"><h2>Sobre ${esc(b.name)}</h2><p>${esc(b.about)}</p></section>` : ''}
          ${b.categories && b.categories.length ? `<section class="biz-section"><h2>Servicios</h2><div class="chips">${catLinks}</div></section>` : ''}
          ${b.metros && b.metros.length ? `<section class="biz-section"><h2>Metro cercano</h2><div class="chips">${metroLinks}</div></section>` : ''}
        </div>
        <aside class="biz-aside">
          <section class="biz-card">
            <h2>Horario</h2>
            <table class="hours">${DAYS.map(([k, lbl]) => `<tr><th>${lbl}</th><td>${esc((b.hours && b.hours[k]) || 'Cerrado')}</td></tr>`).join('')}</table>
          </section>
          <section class="biz-card">
            <h2>Contacto</h2>
            <ul class="contact-list">
              ${b.phone ? `<li>${icon('phone')}<a href="tel:${attr(tel(b.phone))}" data-track="phone">${esc(b.phone)}</a></li>` : ''}
              ${b.email ? `<li><a href="mailto:${attr(b.email)}">${esc(b.email)}</a></li>` : ''}
              ${b.website ? `<li><a href="${attr(b.website)}" target="_blank" rel="noopener nofollow" data-track="web">Sitio web</a></li>` : ''}
              ${b.district ? `<li>${icon('pin')}<a href="/zona/${attr(b.district.slug)}">${esc(b.zone)}</a></li>` : ''}
            </ul>
            ${social.length ? `<div class="chips">${social.map(([k, v]) => `<a class="chip" href="${attr(v)}" target="_blank" rel="noopener nofollow">${esc(k)}</a>`).join('')}</div>` : ''}
          </section>
        </aside>
      </div>
    </div>`;

  return renderLayout(ctx, {
    title: `${b.name} — ${primary ? primary.name : 'Servicios'} en ${b.zone || 'Madrid'} | ${SITE.name}`,
    description: (b.about ? b.about.slice(0, 155) : `${b.name}, ${primary ? primary.name.toLowerCase() : 'servicios'} en ${b.zone || 'Madrid'}.`),
    canonical: abs(ctx, '/negocio/' + b.id), ogType: 'business.business', ogImage: b.photo ? abs(ctx, b.photo) : undefined,
    bodyClass: 'page-biz', body,
    jsonLd: [jsonLdBreadcrumb(ctx, crumbs), jsonLd],
    inlineData: { trackId: b.id },
  });
}

/* --------------------------- Home / Search --------------------------- */
function renderHome(ctx) {
  const cats = DB.getCategoryTree();
  const districts = DB.listDistricts();
  const metros = DB.listMetros();
  const featured = DB.listBusinesses({ featured: true, limit: 6 });
  const featList = featured.length ? featured : DB.listBusinesses({ limit: 6 });
  const total = DB.countBusinesses();

  const inlineData = {
    categories: cats.map(c => ({ slug: c.slug, name: c.name })),
    districts: districts.map(d => ({ slug: d.slug, name: d.name, barrios: DB.listNeighborhoods(d.id).map(b => ({ slug: b.slug, name: b.name })) })),
    metros: metros.map(m => ({ slug: m.slug, name: m.name })),
  };

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
        <h1 class="hero-title">Encuentra profesionales de <span>reformas</span> en Madrid</h1>
        <p class="hero-lead">Fontaneros, electricistas, cerrajeros, climatización y reformas — cerca de tu barrio o estación de metro.</p>
        <form class="hero-search" id="heroSearch" role="search">
          <div class="hs-field">
            <label>Servicio</label>
            <select id="hsService"><option value="">¿Qué necesitas?</option>${cats.map(c => `<option value="${attr(c.slug)}">${esc(c.name)}</option>`).join('')}</select>
          </div>
          <div class="hs-field">
            <label>Distrito</label>
            <select id="hsDistrict"><option value="">Toda la ciudad</option>${districts.map(d => `<option value="${attr(d.slug)}">${esc(d.name)}</option>`).join('')}</select>
          </div>
          <div class="hs-field">
            <label>Barrio</label>
            <select id="hsBarrio" disabled><option value="">Selecciona distrito</option></select>
          </div>
          <div class="hs-field">
            <label>Metro</label>
            <select id="hsMetro"><option value="">Cualquiera</option>${metros.map(m => `<option value="${attr(m.slug)}">${esc(m.name)}</option>`).join('')}</select>
          </div>
          <button class="btn btn-primary hs-go" type="submit">Buscar</button>
        </form>
        <form class="searchbar hero-keyword" action="/buscar" method="get" role="search">
          ${icon('search')}
          <input type="search" name="q" placeholder="Busca: fontanero, cerrajero…" aria-label="Buscar por palabra clave">
          <button class="btn btn-primary" type="submit">Buscar</button>
        </form>
        <div class="hero-stats">
          <div><b>${total}</b><span>Empresas</span></div>
          <div><b>${districts.length}</b><span>Distritos</span></div>
          <div><b>${cats.length}</b><span>Servicios</span></div>
        </div>
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>Servicios destacados</h2></div>
      <div class="cat-tiles">${catTiles}</div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head"><h2>Empresas destacadas</h2><a class="section-link" href="/${attr(cats[0] ? cats[0].slug : 'reformas')}">Ver todas ${icon('arrow')}</a></div>
        ${grid(ctx, featList)}
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>Explora por zona</h2></div>
      <div class="chips">${districts.map(d => `<a class="chip" href="/zona/${attr(d.slug)}">${esc(d.name)}</a>`).join('')}</div>
    </section>`;

  return renderLayout(ctx, {
    title: `${SITE.name} — fontaneros, electricistas, cerrajeros y reformas en Madrid`,
    description: `${SITE.tagline}. Encuentra fontaneros, electricistas, cerrajeros, climatización y reformas por distrito, barrio y metro.`,
    canonical: abs(ctx, '/'), bodyClass: 'page-home', body, inlineData,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: abs(ctx, '/'), potentialAction: { '@type': 'SearchAction', target: abs(ctx, '/buscar?q={search_term_string}'), 'query-input': 'required name=search_term_string' } }],
  });
}

function renderSearch(ctx, q) {
  const query = String(q || '').trim();
  const businesses = query ? DB.listBusinesses({ q: query }) : [];
  const body = `<div class="container">
      ${breadcrumb(ctx, [{ name: 'Inicio', href: '/' }, { name: 'Búsqueda' }])}
      <header class="page-head"><h1>${query ? `Resultados para “${esc(query)}”` : 'Buscar'}</h1>
      <form class="page-search" action="/buscar" method="get"><input type="search" name="q" value="${attr(query)}" placeholder="Fontanero, cerrajero, Salamanca…" autofocus><button class="btn btn-primary">Buscar</button></form>
      ${query ? `<p class="page-count">${businesses.length} ${businesses.length === 1 ? 'resultado' : 'resultados'}</p>` : ''}</header>
      ${query ? grid(ctx, businesses, `No hemos encontrado resultados para “${esc(query)}”. Prueba con otro término o explora por servicio.`) : chipRow('Servicios', DB.getCategoryTree().map(c => ({ name: c.name, href: `/${c.slug}` })))}
    </div>`;
  return renderLayout(ctx, {
    title: query ? `“${query}” | ${SITE.name}` : `Buscar | ${SITE.name}`,
    description: `Busca profesionales de reformas y servicios para el hogar en Madrid.`,
    canonical: abs(ctx, '/buscar'), body,
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
function waLink() { return 'https://wa.me/' + String(SITE.phone).replace(/\D/g, ''); }
function legalDocs() {
  const E = LEGAL_ENTITY;
  const wa = waLink();
  const nifPart = E.nif ? `, con código de identificación fiscal (CUI) ${esc(E.nif)}` : '';
  const contacto = `WhatsApp <a href="${attr(wa)}" target="_blank" rel="noopener nofollow">${esc(SITE.phone)}</a> y teléfono <a href="tel:${attr(tel(SITE.phone))}">${esc(SITE.phone)}</a>`;
  const titular = `<strong>${esc(E.razon)}</strong> (en adelante, «${esc(SITE.name)}»)${nifPart}, con domicilio en ${esc(E.domicilio)}, y contacto por ${contacto}`;
  return {
    'aviso-legal': {
      title: `Aviso legal | ${SITE.name}`,
      h1: 'Aviso legal',
      description: 'Información legal del titular del sitio web conforme a la LSSI-CE.',
      sections: [
        ['1. Titular del sitio web', `<p>En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el titular de este sitio web es ${titular}.</p>`],
        ['2. Objeto', `<p>${esc(SITE.name)} es un directorio en línea que facilita el contacto entre usuarios y profesionales o empresas de reformas y servicios para el hogar en Madrid. ${esc(SITE.name)} no ejecuta directamente las obras ni los servicios anunciados: actúa únicamente como plataforma de intermediación e información.</p>`],
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
        ['6. Tus derechos', `<p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad contactando por WhatsApp al <a href="${attr(wa)}" target="_blank" rel="noopener nofollow">${esc(SITE.phone)}</a>, indicando el derecho que deseas ejercer. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener nofollow">www.aepd.es</a>).</p>`],
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
        ['2. Uso del directorio', `<p>La información publicada tiene carácter orientativo. El usuario es responsable de verificar los datos de cada profesional y de acordar directamente con él las condiciones del servicio.</p>`],
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

/* ---------------------------- Sitemap / robots ----------------------- */
function renderSitemap(ctx) {
  const urls = ['/'];
  urls.push('/metro', '/buscar');
  urls.push('/aviso-legal', '/privacidad', '/cookies', '/condiciones');
  const cats = DB.getCategoryTree();
  const districts = DB.listDistricts();
  const metros = DB.listMetros();
  districts.forEach(d => urls.push(`/zona/${d.slug}`));
  cats.forEach(c => {
    urls.push(`/${c.slug}`);
    c.children.forEach(s => urls.push(`/${s.slug}`));
    districts.forEach(d => {
      urls.push(`/${c.slug}/${d.slug}`);
      DB.listNeighborhoods(d.id).forEach(b => urls.push(`/${c.slug}/${d.slug}/${b.slug}`));
    });
    metros.forEach(m => urls.push(`/${c.slug}/metro/${m.slug}`));
  });
  metros.forEach(m => urls.push(`/metro/${m.slug}`));
  DB.listBusinesses().forEach(b => urls.push(`/negocio/${b.id}`));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(abs(ctx, u))}</loc></url>`).join('\n')}
</urlset>`;
  return body;
}
function renderRobots(ctx) {
  return `User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /login.html
Disallow: /api/

Sitemap: ${abs(ctx, '/sitemap.xml')}
`;
}

module.exports = {
  SITE,
  renderHome, renderCategory, renderDistrict, renderBarrio, renderCategoryMetro,
  renderZoneDistrict, renderZoneBarrio, renderMetroIndex, renderMetroHub,
  renderBusiness, renderSearch, renderLegal, render404, renderSitemap, renderRobots,
};
