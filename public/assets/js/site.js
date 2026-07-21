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

  /* ------------------------------ Analítica ---------------------------- */
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
