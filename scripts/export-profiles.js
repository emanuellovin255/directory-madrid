#!/usr/bin/env node
/* =========================================================================
   export-profiles.js — CSV con la URL pública de cada ficha, para importarlo
   en GHL (campo personalizado «URL ficha», cruzando por teléfono) y llamar a
   los negocios: «Su negocio ya aparece en Profesionales Madrid, ¿quiere
   reclamar la ficha gratis?».

   IMPORTANTE (LSSI art. 21): en España no se pueden enviar comunicaciones
   comerciales por email/WhatsApp sin consentimiento previo, tampoco a
   empresas. Primero la llamada; el enlace se envía solo si dicen que sí.
   Guion en docs/outreach.md.

   Uso:
     node scripts/export-profiles.js [opciones] > fichas.csv
       --site=https://profesionalesmadrid.es   dominio de las URLs (por defecto SITE_URL o ese)
       --categoria=fontaneros                  solo una categoría (incluye subcategorías)
       --sin-verificar                         solo fichas aún no reclamadas (por defecto: todas)
       --min-resenas=10                        solo negocios con al menos N reseñas en Google

   Orden: más reseñas primero (negocios activos = más probabilidad de respuesta).
   Con DATABASE_URL lee de Supabase; sin él, de server/data.db.
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

const args = process.argv.slice(2);
const opt = name => { const a = args.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : null; };
const SITE = (opt('site') || process.env.SITE_URL || 'https://profesionalesmadrid.es').replace(/\/+$/, '');
const CAT = opt('categoria');
const ONLY_UNCLAIMED = args.includes('--sin-verificar');
const MIN_REVIEWS = parseInt(opt('min-resenas'), 10) || 0;

const csvCell = v => {
  const s = String(v == null ? '' : v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

async function main() {
  await DB.initPersistence();
  const filter = CAT ? { categorySlug: CAT, sort: 'reviews' } : { sort: 'reviews' };
  if (CAT && !DB.getCategoryBySlug(CAT)) { console.error(`✗ Categoría desconocida: ${CAT}`); process.exit(1); }
  const light = DB.listBusinessesLight(filter);
  const header = ['nombre', 'telefono', 'web', 'zona', 'categorias', 'resenas', 'verificada', 'url_ficha'];
  const lines = [header.join(',')];
  let n = 0;
  for (const row of light) {
    const b = DB.getBusiness(row.id);
    if (!b) continue;
    if (ONLY_UNCLAIMED && b.claimed) continue;
    if ((b.reviews || 0) < MIN_REVIEWS) continue;
    lines.push([
      b.name, b.phone, b.website, b.zone, (b.categories || []).map(c => c.name).join(' / '),
      b.reviews || 0, b.claimed ? 'si' : 'no', `${SITE}/negocio/${b.id}`,
    ].map(csvCell).join(','));
    n++;
  }
  process.stdout.write(lines.join('\n') + '\n');
  console.error(`✓ ${n} fichas exportadas${CAT ? ` (${CAT})` : ''}.`);
  process.exit(0);
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
