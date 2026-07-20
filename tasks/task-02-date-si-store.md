# Task 02 — Date demo & strat store

**Status:** ✅ Gata

## Obiectiv
Modelul de date pentru o clinică, cele 3 clinici demo (ES) și un strat de persistență peste localStorage,
pregătit să fie mutat ușor pe o bază de date reală.

## Fișiere
- `assets/js/data.js` — seed, catalog servicii, zile, generator placeholder SVG
- `assets/js/store.js` — CRUD + export/import
- `data/clinics.seed.json` — copie de referință

## Model
`id, name, zone, address, about, services[], hours{7 zile}, phone, email, website, social{}, rating, reviews, featured, photo`

## Checklist
- [x] 3 clinici demo fictive (Salamanca, Chamberí, Malasaña) complet populate
- [x] Generator de imagini placeholder (gradient + monogram, SVG data-URL)
- [x] `Store`: getAll/get/add/update/remove/toggleFeatured/resetToSeed
- [x] `exportJSON` / `importJSON` (validare + slug unic)
- [x] `slugify` fără diacritice; seed copiat în localStorage la prima rulare

## Note
Datele demo au telefoane/email/web `example` — sunt fictive intenționat.
