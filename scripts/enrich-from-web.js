#!/usr/bin/env node
/* =========================================================================
   enrich-from-web.js — Completa fichas con DATOS (no textos) de la web de
   cada negocio: dirección, horario y redes sociales. Usa el extractor de
   server/extract.js (sin IA, respeta robots.txt).

   NO copia la descripción de su web: sería contenido duplicado y no haría la
   ficha indexable (la regla de indexación pide descripción propia o reclamar).
   Solo rellena campos VACÍOS; nunca toca nombre, teléfono ni web.

   Uso:
     node scripts/enrich-from-web.js [opciones]
       --limit=50            nº de negocios a procesar (por defecto 50)
       --categoria=reformas  solo una categoría
       --max-pages=3         páginas por web (por defecto 3: portada + contacto)
       --delay=1500          ms de pausa entre negocios (por defecto 1500)
       --apply               guarda los cambios (sin esto: simulación)

   Orden: más reseñas primero. Con DATABASE_URL lee/escribe en Supabase.
   ========================================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

(function loadEnv(file) {
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch { /* sin .env */ }
})(path.join(__dirname, '..', '.env'));

const DB = require('../server/db');
const { extractFromUrl } = require('../server/extract');

const args = process.argv.slice(2);
const opt = (name, fb) => { const a = args.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : fb; };
const LIMIT = Math.max(1, parseInt(opt('limit', '50'), 10) || 50);
const CAT = opt('categoria', null);
const MAX_PAGES = Math.min(10, Math.max(1, parseInt(opt('max-pages', '3'), 10) || 3));
const DELAY = Math.max(0, parseInt(opt('delay', '1500'), 10) || 0);
const APPLY = args.includes('--apply');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const hasHours = h => !!h && Object.values(h).some(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'cerrado');

async function main() {
  await DB.initPersistence();
  if (CAT && !DB.getCategoryBySlug(CAT)) { console.error(`✗ Categoría desconocida: ${CAT}`); process.exit(1); }
  const candidates = [];
  for (const row of DB.listBusinessesLight(CAT ? { categorySlug: CAT, sort: 'reviews' } : { sort: 'reviews' })) {
    const b = DB.getBusiness(row.id);
    if (!b || !b.website || b.claimed) continue;
    if (b.address && hasHours(b.hours) && Object.keys(b.social || {}).length) continue;   // ya completa
    candidates.push(b);
    if (candidates.length >= LIMIT) break;
  }
  console.log(`${APPLY ? 'APLICANDO' : 'SIMULACIÓN'} · ${candidates.length} negocios · máx. ${MAX_PAGES} páginas por web\n`);
  let changed = 0;
  for (const [i, b] of candidates.entries()) {
    let res;
    try { res = await extractFromUrl(b.website, { maxPages: MAX_PAGES, concurrency: 1, delayMs: 400 }); }
    catch (e) { console.log(`${i + 1}. ${b.name} — ✗ ${e.message}`); continue; }
    const f = res.fields || {};
    const patch = {};
    if (!b.address && f.address) patch.address = f.address;
    if (!hasHours(b.hours) && hasHours(f.hours)) patch.hours = f.hours;
    const social = Object.assign({}, b.social || {});
    let addedSocial = 0;
    Object.entries(f.social || {}).forEach(([k, v]) => { if (v && !social[k]) { social[k] = v; addedSocial++; } });
    if (addedSocial) patch.social = social;
    const keys = Object.keys(patch);
    console.log(`${i + 1}. ${b.name} — ${keys.length ? '+ ' + keys.join(', ') : 'sin datos nuevos'}${res.notes && res.notes.length ? ' · ' + res.notes[0] : ''}`);
    if (keys.length && APPLY) {
      DB.updateBusiness(b.id, patch);
      await DB.persistBusiness(b.id);
      changed++;
    }
    if (DELAY) await sleep(DELAY);
  }
  console.log(`\n${APPLY ? `✓ ${changed} fichas actualizadas.` : 'Simulación terminada. Repite con --apply para guardar.'}`);
  process.exit(0);
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
