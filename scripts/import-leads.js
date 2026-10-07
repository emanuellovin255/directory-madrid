#!/usr/bin/env node
/* =========================================================================
   import-leads.js — Importa los leads de contractors (CSV de GHL, uno por
   servicio: «Reformas_GHL_….csv», «Plagas_GHL_….csv»…) al directorio.

   Solo se importan: nombre de la empresa, teléfono, web, zona y nº de reseñas.
   Nada más (ni nombre de contacto, ni tier, ni estado de llamada…): eso se
   añade a mano desde el panel cuando haga falta.

   • Servicio  → por el nombre del archivo (Plagas → control-de-plagas, …).
   • Zona      → la columna «Area» se resuelve a distrito/municipio (+ barrio si
                 existe); si es una urbanización se guarda tal cual en `area`
                 (se muestra «El Montecillo · Las Rozas de Madrid»).
   • Duplicados → la misma empresa (nombre + teléfono) en varios CSV = UN negocio
                 con varias categorías.
   • Idempotente: si la empresa ya existe, solo se le añaden las categorías que
                 falten (no se tocan descripción, fotos, etc. editados a mano).
   • Fuera de Madrid → se omiten (fijo de otra provincia, etiqueta de fuera de la
                 Comunidad…); misma regla que scripts/prune-outside.js.

   Uso:
     node scripts/import-leads.js <carpeta | archivo.zip | archivo.csv …> [opciones]
       --dry-run     simula (no guarda nada) e imprime el informe
       --keep-demo   no borra los 9 negocios de demostración (*.example.com)

   Local escribe en server/data.db (con copia de seguridad previa). Con
   DATABASE_URL (Supabase) hidrata, importa y vuelca a Postgres.
   ========================================================================= */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/* .env igual que server.js (DATABASE_URL debe existir ANTES de cargar db.js). */
(function loadEnv(file) {
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch { /* sin .env */ }
})(path.join(__dirname, '..', '.env'));

const DB = require('../server/db');
const { outsideMadrid } = require('./prune-outside');
const { seedIfEmpty, ensureCategories, ensureMunicipios, DEMO_BUSINESSES } = require('../server/seed');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const KEEP_DEMO = args.includes('--keep-demo');
const inputs = args.filter(a => !a.startsWith('--'));

/* ------------------------------ Utilidades ------------------------------ */
const strict = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'urbanizacion', 'urb', 'zona', 'barrio']);
const loose = s => strict(s).split(' ').filter(w => w && !STOP.has(w)).join('');
const digits = s => String(s || '').replace(/\D/g, '');

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

/* +34630017921 → «+34 630 017 921» (formato de los negocios ya existentes). */
function formatPhone(p) {
  const d = digits(p);
  const nat = d.length === 11 && d.startsWith('34') ? d.slice(2) : (d.length === 9 ? d : null);
  if (!nat) return String(p || '').trim();
  return `+34 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`;
}
/* Quita los utm_* que añade Google Maps; deja el resto de la URL intacta. */
function cleanUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : 'http://' + u);
    [...url.searchParams.keys()].filter(k => /^utm_/i.test(k)).forEach(k => url.searchParams.delete(k));
    return url.toString();
  } catch { return u; }
}

/* Servicio por prefijo del archivo («Plagas_GHL_Paige_OPP.csv» → plagas). */
const FILE_CATEGORY = {
  plagas: 'control-de-plagas', 'control-de-plagas': 'control-de-plagas',
  electricistas: 'electricistas', mudanzas: 'mudanzas', cerrajeros: 'cerrajeros',
  talleres: 'talleres', fontaneros: 'fontaneros', reformas: 'reformas',
  climatizacion: 'climatizacion',
};
function categoryFor(file, row) {
  const pref = DB.slugify(path.basename(file).split(/[_.]/)[0]);
  if (FILE_CATEGORY[pref]) return FILE_CATEGORY[pref];
  if (DB.getCategoryBySlug(pref)) return pref;
  const tag = String(row.Tags || '').split(',').map(t => DB.slugify(t)).find(t => t && !t.startsWith('tier'));
  if (tag && (FILE_CATEGORY[tag] || DB.getCategoryBySlug(tag))) return FILE_CATEGORY[tag] || tag;
  return null;
}

/* ------------------------------ Entradas -------------------------------- */
function collectCsvFiles(list) {
  const out = [];
  for (const p of list) {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) { console.error(`✗ No existe: ${p}`); process.exit(1); }
    if (fs.statSync(abs).isDirectory()) {
      fs.readdirSync(abs, { withFileTypes: true }).forEach(e => {
        if (e.name.startsWith('.') || e.name === '__MACOSX') return;
        out.push(...collectCsvFiles([path.join(abs, e.name)]).filter(f => /\.csv$/i.test(f)));
      });
    } else if (/\.zip$/i.test(abs)) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leads-'));
      execFileSync('unzip', ['-o', '-q', abs, '-d', tmp]);
      out.push(...collectCsvFiles([tmp]));
    } else if (/\.csv$/i.test(abs)) out.push(abs);
  }
  return out;
}

/* ===================== Resolución de zona (Area → geo) ===================== */
/* Etiquetas genéricas: existen en muchos municipios («Centro», «Pueblo»…) →
   NUNCA se asignan por nombre; solo por pista (nombre/web) o mayoría. */
const GENERIC = new Set([
  'centro', 'pueblo', 'casco antiguo', 'casco historico', 'zona centro', 'zona pueblo',
  'norte', 'sur', 'este', 'oeste', 'noreste', 'noroeste', 'sureste', 'suroeste',
  'zona norte', 'zona sur', 'zona este', 'zona oeste', 'golf', 'parque empresarial',
  'poligono industrial', 'urbanizacion la serna',
]);
/* Urbanizaciones / pedanías conocidas → municipio (y barrio si existe).
   Solo las seguras; el resto lo decide la pista o queda solo con la etiqueta. */
const MANUAL = {
  'parque de coimbra': { d: 'mostoles', b: 'Parque Coimbra' },
  'monterrozas': { d: 'las-rozas-de-madrid', b: 'Monte Rozas' },
  'el pinar punta galea': { d: 'las-rozas-de-madrid' },
  'molino de la hoz': { d: 'las-rozas-de-madrid' },
  'la marazuela': { d: 'las-rozas-de-madrid' },
  'el montecillo': { d: 'las-rozas-de-madrid' },
  'roza martin': { d: 'majadahonda' },
  'monteprincipe': { d: 'boadilla-del-monte' },
  'el olivar de mirabal': { d: 'boadilla-del-monte' },
  'montegancedo': { d: 'pozuelo-de-alarcon' },
  'prado de somosaguas': { d: 'pozuelo-de-alarcon', b: 'Somosaguas' },
  'la finca': { d: 'pozuelo-de-alarcon' },
  'avenida de europa': { d: 'pozuelo-de-alarcon' },
  'soto de vinuelas': { d: 'tres-cantos' },
  'villafranca del castillo': { d: 'villanueva-de-la-canada' },
  'dominio de fontenebro': { d: 'collado-villalba' },
  'fontenebro': { d: 'collado-villalba' },
  'cerceda': { d: 'el-boalo' },
  'mataelpino': { d: 'el-boalo' },
  'chozas de la sierra': { d: 'soto-del-real' },
  'la pedriza': { d: 'manzanares-el-real' },
  'valle de los caidos': { d: 'san-lorenzo-de-el-escorial' },
  'abantos': { d: 'san-lorenzo-de-el-escorial' },
  'la jarosa': { d: 'guadarrama' },
  'puerto de navacerrada': { d: 'navacerrada' },
  'las suertes': { d: 'villa-de-vallecas', b: 'Ensanche de Vallecas' },
  'valdecarros': { d: 'villa-de-vallecas' },
  'los ahijones': { d: 'vicalvaro' },
  'los berrocales': { d: 'vicalvaro' },
  'villaverde alto': { d: 'villaverde', b: 'San Andrés' },
  'villaco': { d: 'villaconejos', label: '' },   // «Villacoコネ» = Villaconejos (texto corrupto en el CSV)
  /* Errores del scraper (municipio con nombre parecido), comprobados con los
     fijos: 91 845/846 = Colmenar Viejo; 949 = provincia de Guadalajara. */
  'colmenar del arroyo': { d: 'colmenar-viejo', label: '' },
  'cabanillas de la sierra': { d: null, label: 'Guadalajara' },
};
/* Alias cortos de municipios para detectar pistas en el nombre o la web. */
const HINT_ALIASES = {
  pozuelo: 'pozuelo-de-alarcon', 'las rozas': 'las-rozas-de-madrid', 'las matas': 'las-rozas-de-madrid',
  alcala: 'alcala-de-henares', torrejon: 'torrejon-de-ardoz', 'san sebastian': 'san-sebastian-de-los-reyes',
  sanse: 'san-sebastian-de-los-reyes', villalba: 'collado-villalba', boadilla: 'boadilla-del-monte',
  villaviciosa: 'villaviciosa-de-odon', rivas: 'rivas-vaciamadrid', arganda: 'arganda-del-rey',
  'san fernando': 'san-fernando-de-henares', 'la moraleja': 'alcobendas', aravaca: 'moncloa-aravaca',
  moncloa: 'moncloa-aravaca', fuencarral: 'fuencarral-el-pardo', 'san blas': 'san-blas-canillejas',
  canillejas: 'san-blas-canillejas', 'san lorenzo': 'san-lorenzo-de-el-escorial', humanes: 'humanes-de-madrid',
  daganzo: 'daganzo-de-arriba', mejorada: 'mejorada-del-campo', velilla: 'velilla-de-san-antonio',
  becerril: 'becerril-de-la-sierra', 'san agustin': 'san-agustin-del-guadalix', sanchinarro: 'hortaleza',
};
const HINT_BLOCK = new Set(['centro', 'salamanca', 'retiro', 'madrid']);

function buildGeo() {
  const districts = DB.listDistricts();
  const byId = new Map(districts.map(d => [d.id, d]));
  const bySlug = new Map(districts.map(d => [d.slug, d]));
  const distByKey = new Map();
  districts.forEach(d => { distByKey.set('s:' + strict(d.name), d); if (loose(d.name)) distByKey.set('l:' + loose(d.name), d); });
  const barByKey = new Map();
  const addBar = (k, v) => { if (!barByKey.has(k)) barByKey.set(k, []); const a = barByKey.get(k); if (!a.some(x => x.n.id === v.n.id)) a.push(v); };
  DB.listNeighborhoods().forEach(n => {
    const d = byId.get(n.district_id); if (!d) return;
    addBar('s:' + strict(n.name), { d, n });
    if (loose(n.name)) addBar('l:' + loose(n.name), { d, n });
  });
  const aliases = [];
  districts.forEach(d => { const a = strict(d.name); if (!HINT_BLOCK.has(a)) aliases.push([a, d.slug]); });
  Object.entries(HINT_ALIASES).forEach(([a, s]) => { if (bySlug.has(s)) aliases.push([a, s]); });
  return { districts, byId, bySlug, distByKey, barByKey, aliases };
}

/* Municipios mencionados en el nombre o la web (p. ej. «Fontaneros Pozuelo»,
   reformasmajadahonda.es). Si dos alias se solapan («el escorial» ⊂ «san
   lorenzo de el escorial») gana el más largo. */
function hintsFor(geo, name, website) {
  const text = ' ' + strict(name + ' ' + website) + ' ';
  let host = '';
  try { host = new URL(/^https?:/i.test(website) ? website : 'http://' + website).hostname.replace(/^www\./, '').split('.')[0]; } catch { /* sin web */ }
  const hits = [];
  for (const [a, slug] of geo.aliases) {
    const compact = a.replace(/ /g, '');
    if (text.includes(' ' + a + ' ') || (compact.length >= 6 && host.includes(compact))) hits.push([a, slug]);
  }
  const kept = hits.filter(([a, s]) => !hits.some(([b, t]) => t !== s && b.length > a.length && b.includes(a)));
  return [...new Set(kept.map(([, s]) => s))];
}

function barrioIn(geo, district, label) {
  if (!label) return null;
  const k1 = 's:' + strict(label), k2 = 'l:' + loose(label);
  const hit = [...(geo.barByKey.get(k1) || []), ...(geo.barByKey.get(k2) || [])].find(x => x.d.id === district.id);
  return hit ? hit.n : null;
}

/* Clasificación estática de una etiqueta (sin pistas). */
function classify(geo, label) {
  const s = strict(label);
  if (!s) return { kind: 'none' };
  if (MANUAL[s]) return { kind: 'manual', m: MANUAL[s] };
  if (GENERIC.has(s)) return { kind: 'generic' };
  const d = geo.distByKey.get('s:' + s) || geo.distByKey.get('l:' + loose(label));
  if (d) return { kind: 'district', d };
  const cands = [...(geo.barByKey.get('s:' + s) || [])];
  (geo.barByKey.get('l:' + loose(label)) || []).forEach(x => { if (!cands.some(c => c.n.id === x.n.id)) cands.push(x); });
  if (cands.length === 1) return { kind: 'barrio', d: cands[0].d, n: cands[0].n };
  if (cands.length > 1) return { kind: 'ambiguous', cands };
  // Municipio dentro de la propia etiqueta («Puerto de Galapagar», «Parque Galapagar»).
  const inLabel = hintsFor(geo, label, '');
  if (inLabel.length === 1) return { kind: 'district', d: geo.bySlug.get(inLabel[0]), viaLabel: true };
  return { kind: 'unknown' };
}

/* Resuelve un negocio: { districtId, neighborhoodId, area, via }. `priors` =
   municipio mayoritario por etiqueta según las pistas de todo el CSV. */
function resolve(geo, label, hints, priors) {
  const s = strict(label);
  const out = (d, n, via, area) => ({ districtId: d ? d.id : null, neighborhoodId: n ? n.id : null, area: area != null ? area : label, via });
  const c = classify(geo, label);
  if (c.kind === 'none') return out(null, null, 'sin-zona', '');
  if (c.kind === 'manual') {
    if (!c.m.d) return out(null, null, 'fuera', c.m.label);
    const d = geo.bySlug.get(c.m.d);
    if (d) return out(d, c.m.b ? barrioIn(geo, d, c.m.b) : null, 'manual', c.m.label != null ? c.m.label : label);
  }
  if (c.kind === 'district') return out(c.d, barrioIn(geo, c.d, label), c.viaLabel ? 'etiqueta' : 'municipio');
  if (c.kind === 'barrio') return out(c.d, c.n, 'barrio');

  // Genérica / ambigua / desconocida → pista del propio negocio, luego mayoría.
  const allowed = c.kind === 'ambiguous' ? new Set(c.cands.map(x => x.d.slug)) : null;
  const ok = slug => !allowed || allowed.has(slug);
  const pick = (slug, via) => { const d = geo.bySlug.get(slug); return out(d, barrioIn(geo, d, label), via); };
  const own = hints.filter(ok);
  if (own.length === 1) return pick(own[0], 'pista');
  const prior = priors.get(s);
  if (prior && ok(prior) && (!own.length || own.includes(prior))) return pick(prior, 'mayoria');
  if (c.kind === 'ambiguous') {
    // Varias opciones y una es de Madrid capital → la capital (barrios oficiales).
    const cap = c.cands.filter(x => x.d.kind === 'distrito');
    if (cap.length === 1) return out(cap[0].d, cap[0].n, 'capital');
  }
  return out(null, null, 'sin-resolver');
}

/* ================================ Main ================================== */
async function main() {
  if (!inputs.length) {
    console.log('Uso: node scripts/import-leads.js <carpeta|archivo.zip|archivo.csv …> [--dry-run] [--keep-demo]');
    process.exit(1);
  }
  const files = collectCsvFiles(inputs);
  if (!files.length) { console.error('✗ No se encontraron archivos .csv'); process.exit(1); }

  await DB.initPersistence();
  seedIfEmpty(); ensureCategories(); ensureMunicipios();
  const geo = buildGeo();

  /* 1) Leer + fusionar duplicados (nombre + teléfono). */
  const records = new Map();
  let rowsRead = 0;
  const skippedFiles = [];
  for (const file of files) {
    const rows = parseCSV(fs.readFileSync(file, 'utf8'));
    for (const r of rows) {
      const name = String(r['Business Name'] || r.Name || '').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const cat = categoryFor(file, r);
      if (!cat) { if (!skippedFiles.includes(path.basename(file))) skippedFiles.push(path.basename(file)); continue; }
      rowsRead++;
      const key = strict(name) + '|' + digits(r.Phone).slice(-9);
      let rec = records.get(key);
      if (!rec) { rec = { key, name, phone: formatPhone(r.Phone), website: cleanUrl(r.Website), reviews: 0, areas: [], cats: new Set() }; records.set(key, rec); }
      rec.cats.add(cat);
      const rv = parseInt(r.Reviews, 10) || 0;
      if (rv > rec.reviews) rec.reviews = rv;
      if (!rec.website && r.Website) rec.website = cleanUrl(r.Website);
      rec.areas.push({ label: String(r.Area || '').trim(), reviews: rv });
    }
  }
  if (skippedFiles.length) console.log(`⚠️  Sin servicio reconocible (omitidos): ${skippedFiles.join(', ')}`);

  /* 2) Pistas + mayoría por etiqueta (≥3 negocios con pista y ≥65% de acuerdo). */
  const tally = new Map();
  for (const rec of records.values()) {
    rec.hints = hintsFor(geo, rec.name, rec.website);
    if (rec.hints.length !== 1) continue;
    for (const a of new Set(rec.areas.map(x => strict(x.label)))) {
      if (!tally.has(a)) tally.set(a, new Map());
      const t = tally.get(a); t.set(rec.hints[0], (t.get(rec.hints[0]) || 0) + 1);
    }
  }
  const priors = new Map();
  for (const [label, t] of tally) {
    const total = [...t.values()].reduce((a, b) => a + b, 0);
    const [top, n] = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total >= 3 && n / total >= 0.65) priors.set(label, top);
  }

  /* 3) Resolver la zona: la etiqueta del registro con más reseñas que se resuelva. */
  for (const rec of records.values()) {
    const labels = rec.areas.sort((a, b) => b.reviews - a.reviews).map(x => x.label);
    let best = null;
    for (const label of [...new Set(labels)]) {
      const r = resolve(geo, label, rec.hints, priors);
      if (!best) best = r;
      if (r.districtId) { best = r; break; }
    }
    rec.geo = best || { districtId: null, neighborhoodId: null, area: '', via: 'sin-zona' };
  }

  /* 3b) Fuera de la Comunidad de Madrid → no se importan (el scraper empareja
     «Salamanca», «La Acebeda»… con negocios de otras provincias). */
  const outside = outsideMadrid([...records.values()].map(rec => {
    const d = rec.geo.districtId ? geo.byId.get(rec.geo.districtId) : null;
    const label = strict(rec.geo.area);
    return { id: rec.key, phone: rec.phone, zone: d ? d.slug : (label ? 'area:' + label : null), label: d ? '' : label };
  }));

  /* 4) Escribir (transacción; en --dry-run se deshace). */
  if (!DRY && !DB.persistenceEnabled()) {
    const file = DB.db.prepare('PRAGMA database_list').all().find(x => x.name === 'main');
    if (file && file.file) {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
      const backup = file.file + '-backup-' + stamp;
      if (!fs.existsSync(backup)) DB.db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
      console.log(`💾 Copia de seguridad: ${path.relative(process.cwd(), backup)}`);
    }
  }
  const catIdBySlug = new Map(DB.listCategories().map(c => [c.slug, c.id]));
  const existing = new Map(DB.db.prepare('SELECT id, name, phone FROM businesses').all()
    .map(b => [strict(b.name) + '|' + digits(b.phone).slice(-9), b.id]));
  const linkCat = DB.db.prepare('INSERT OR IGNORE INTO business_categories (business_id, category_id) VALUES (?, ?)');
  const stats = { inserted: 0, merged: 0, catLinksAdded: 0, demoRemoved: 0, via: {} };
  const unresolved = new Map();

  DB.db.exec('BEGIN');
  try {
    if (!KEEP_DEMO) {
      for (const d of DEMO_BUSINESSES) {
        const b = DB.db.prepare('SELECT website FROM businesses WHERE id=?').get(d.id);
        if (b && /example\.com/i.test(b.website || '')) { DB.removeBusiness(d.id); stats.demoRemoved++; }
      }
    }
    for (const rec of records.values()) {
      if (outside.has(rec.key)) { stats.outside = (stats.outside || 0) + 1; continue; }
      const catIds = [...rec.cats].map(s => catIdBySlug.get(s)).filter(Boolean);
      stats.via[rec.geo.via] = (stats.via[rec.geo.via] || 0) + 1;
      if (!rec.geo.districtId && rec.geo.area) unresolved.set(rec.geo.area, (unresolved.get(rec.geo.area) || 0) + 1);
      const id = existing.get(rec.key);
      if (id) {
        // Ya existe → solo añadimos las categorías que falten (no pisamos ediciones manuales).
        catIds.forEach(cid => { stats.catLinksAdded += linkCat.run(id, cid).changes; });
        stats.merged++;
        continue;
      }
      const b = DB.insertBusiness({
        name: rec.name, phone: rec.phone, website: rec.website, reviews: rec.reviews,
        area: rec.geo.area, districtId: rec.geo.districtId, neighborhoodId: rec.geo.neighborhoodId,
        categoryIds: catIds,
      });
      existing.set(rec.key, b.id);
      stats.inserted++;
    }
    DB.db.exec(DRY ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { try { DB.db.exec('ROLLBACK'); } catch { /* ignora */ } throw e; }

  if (!DRY && DB.persistenceEnabled()) {
    console.log('☁️  Guardando en Postgres (Supabase)…');
    await DB.persist();
  }

  /* 5) Informe. */
  const VIA = {
    municipio: 'municipio/distrito por nombre', barrio: 'barrio por nombre', manual: 'urbanización conocida',
    etiqueta: 'municipio dentro de la etiqueta', pista: 'pista en nombre/web', mayoria: 'mayoría de la etiqueta',
    capital: 'barrio de Madrid capital (ambiguo)', fuera: 'fuera de la Comunidad (corregido)', 'sin-resolver': 'SIN municipio (solo etiqueta)', 'sin-zona': 'sin zona en el CSV',
  };
  console.log(`\n${DRY ? '🧪 SIMULACIÓN (no se ha guardado nada)' : '✅ Importación completada'}`);
  console.log(`   Archivos: ${files.length} · filas: ${rowsRead} · empresas únicas: ${records.size}`);
  console.log(`   Nuevas: ${stats.inserted} · ya existían: ${stats.merged} (+${stats.catLinksAdded} categorías) · demo eliminados: ${stats.demoRemoved}`);
  if (stats.outside) console.log(`   Omitidas por estar fuera de la Comunidad de Madrid: ${stats.outside}`);
  console.log('   Zona resuelta por:');
  Object.entries(stats.via).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`     ${String(n).padStart(6)}  ${VIA[k] || k}`));
  const top = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (top.length) console.log('   Etiquetas sin municipio (se muestran tal cual; asígnalas a mano si quieres):\n     ' + top.map(([l, n]) => `${l} (${n})`).join(', '));
  console.log(`   Total negocios en el directorio: ${DB.countBusinesses()}\n`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('✗ Error:', e); process.exit(1); });
}
module.exports = { parseCSV, strict, loose, buildGeo, hintsFor, classify, resolve, categoryFor, collectCsvFiles };
