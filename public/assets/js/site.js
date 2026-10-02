/* =========================================================================
   site.js — Comportamiento de las páginas públicas (SSR):
   menú móvil + mega-menús, búsqueda inteligente del hero (rutea a la
   página SEO), cascada distrito→barrio, y analítica (visita/vista/contacto).
   ========================================================================= */
(function () {
  'use strict';
  var api = window.DDM && window.DDM.api;
  var RM = window.__RM__ || {};
  var esc = (window.DDM && window.DDM.esc) || function (s) { return String(s == null ? '' : s); };
  var isMobile = function () { return window.matchMedia('(max-width: 860px)').matches; };
  /* Eventos de conversión para Plausible o GA4 (solo existen si el visitante
     aceptó las cookies analíticas; si no, no se envía nada). */
  var trackEvent = function (name, props) {
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props: props || {} });
      if (typeof window.gtag === 'function') window.gtag('event', name, props || {});
    } catch (e) { /* analítica opcional */ }
  };

  /* ----------------------------- Navegación ---------------------------- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // Mega-menús: en móvil, el primer toque abre el submenú en lugar de navegar.
  document.querySelectorAll('.nav-item.has-mega > .nav-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (!isMobile()) return;
      var item = link.parentElement;
      if (!item.classList.contains('open')) { e.preventDefault(); item.classList.add('open'); }
    });
  });

  /* -------------------------- Búsqueda del hero ------------------------ */
  var form = document.getElementById('heroSearch');
  var selService = document.getElementById('hsService');
  var selDistrict = document.getElementById('hsDistrict');
  var selBarrio = document.getElementById('hsBarrio');
  var selMetro = document.getElementById('hsMetro');

  if (selDistrict && selBarrio) {
    selDistrict.addEventListener('change', function () {
      var dist = (RM.districts || []).filter(function (d) { return d.slug === selDistrict.value; })[0];
      var hasBarrios = !!(dist && dist.barrios && dist.barrios.length);
      var whole = dist && dist.kind === 'municipio' ? 'Todo el municipio' : 'Todo el distrito';
      var opts = '<option value="">' + whole + '</option>';
      if (hasBarrios) opts += dist.barrios.map(function (b) { return '<option value="' + esc(b.slug) + '">' + esc(b.name) + '</option>'; }).join('');
      selBarrio.innerHTML = opts;
      selBarrio.disabled = !hasBarrios;
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = selService && selService.value;
      var d = selDistrict && selDistrict.value;
      var b = selBarrio && selBarrio.value;
      var m = selMetro && selMetro.value;
      var url;
      if (s && d && b) url = '/' + s + '/' + d + '/' + b;
      else if (s && d) url = '/' + s + '/' + d;
      else if (s && m) url = '/' + s + '/metro/' + m;
      else if (s) url = '/' + s;
      else if (d && b) url = '/zona/' + d + '/' + b;
      else if (d) url = '/zona/' + d;
      else if (m) url = '/metro/' + m;
      else url = '/buscar';
      window.location.href = url;
    });
  }

  /* ------------- Formularios (presupuesto, reclamar, alta, contacto) ------------- */
  /* name/phone/email/message/businessId/context/kind/hp van como campos del lead;
     cualquier otro campo con `name` va en `payload` (checkbox marcado → "si"). */
  var TOP = { name: 1, phone: 1, email: 1, message: 1, businessId: 1, context: 1, kind: 1, hp: 1 };
  function leadFeedback(fb, kind, msg) {
    if (!fb) return;
    fb.hidden = false;
    fb.className = 'lead-feedback lead-feedback-' + kind;
    fb.textContent = msg;
  }
  // Contador de caracteres en las descripciones con mínimo (data-min).
  document.querySelectorAll('textarea[data-min]').forEach(function (ta) {
    var counter = ta.parentElement && ta.parentElement.querySelector('.lead-counter');
    var min = parseInt(ta.getAttribute('data-min'), 10) || 0;
    var upd = function () {
      if (!counter) return;
      var n = ta.value.trim().length;
      counter.textContent = n + ' / ' + min + ' caracteres mínimo';
      counter.classList.toggle('is-ok', n >= min);
    };
    ta.addEventListener('input', upd); upd();
  });
  // «¿Es tu negocio?»: el enlace /negocio/x#reclamar abre el bloque directamente.
  var claim = document.getElementById('reclamar');
  if (claim && location.hash === '#reclamar') { claim.open = true; setTimeout(function () { claim.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }

  document.querySelectorAll('form[data-lead-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fb = f.querySelector('.lead-feedback');
      var btn = f.querySelector('button[type="submit"]');
      var payload = { sourceUrl: location.href, payload: {} };
      Array.prototype.forEach.call(f.elements, function (el) {
        if (!el.name) return;
        if (el.type === 'checkbox') { if (el.checked) payload.payload[el.name] = el.value || 'si'; return; }
        var v = String(el.value || '').trim();
        if (TOP[el.name]) payload[el.name] = v; else if (v) payload.payload[el.name] = v;
      });
      // Validación mínima en el navegador (el servidor valida de nuevo).
      var missing = Array.prototype.filter.call(f.querySelectorAll('[required]'), function (el) {
        return el.type === 'checkbox' ? !el.checked : !String(el.value || '').trim();
      })[0];
      if (missing) {
        var lbl = missing.closest('label');
        var txt = lbl ? (lbl.querySelector('span') || lbl).textContent.replace(/\*$/, '').trim() : '';
        leadFeedback(fb, 'error', missing.type === 'checkbox' ? 'Marca la casilla para continuar.' : 'Completa: ' + txt + '.');
        missing.focus(); return;
      }
      var short = Array.prototype.filter.call(f.querySelectorAll('textarea[data-min]'), function (ta) {
        return ta.value.trim().length < (parseInt(ta.getAttribute('data-min'), 10) || 0);
      })[0];
      if (short) { leadFeedback(fb, 'error', 'La descripción necesita al menos ' + short.getAttribute('data-min') + ' caracteres.'); short.focus(); return; }
      if (!payload.kind || payload.kind === 'quote') {
        if ((payload.name || '').length < 2) { leadFeedback(fb, 'error', 'Indica tu nombre.'); return; }
        if (!payload.phone && !payload.email) { leadFeedback(fb, 'error', 'Indica un teléfono o un email de contacto.'); return; }
      }
      if (!api) { leadFeedback(fb, 'error', 'No se pudo enviar. Recarga la página e inténtalo de nuevo.'); return; }
      leadFeedback(fb, 'pending', 'Enviando…');
      if (btn) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.disabled = true; btn.textContent = 'Enviando…'; }
      api.submitLead(payload).then(function () {
        Array.prototype.forEach.call(f.querySelectorAll('.lead-row, .lead-field-full, .lead-actions, .lead-note'), function (x) { x.hidden = true; });
        leadFeedback(fb, 'ok', f.getAttribute('data-ok') || '¡Gracias! Hemos recibido tu solicitud. Te contactaremos lo antes posible.');
        var extra = f.querySelector('.lead-ok-extra'); if (extra) extra.hidden = false;
        trackEvent('lead_' + (payload.kind || 'quote'), { page: location.pathname });
      }).catch(function (err) {
        leadFeedback(fb, 'error', (err && err.message) || 'No se pudo enviar. Inténtalo de nuevo.');
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Enviar'; }
      });
    });
  });

  /* ------------------------------ Analítica ---------------------------- */
  // Clics hacia Listo247 (la oferta de pago): mide cuánto empuja el directorio.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="listo247.es"]');
    if (a) trackEvent('click_listo247', { page: location.pathname });
  });
  if (api) {
    api.trackVisit();
    if (RM.trackId) api.trackView(RM.trackId);
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-track]');
      if (!el) return;
      api.trackContact(el.getAttribute('data-track') === 'web' ? 'web' : 'phone');
    });
  }
})();
