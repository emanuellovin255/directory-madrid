# Task 17 — Frontend pe API ✅

**Status:** ✅ Gata

## Obiectiv
Frontend-ul folosește API-ul real (fetch) în loc de localStorage.

## Fișiere
- `public/assets/js/ui.js` (modul comun: icons, helpers, placeholder)
- `public/assets/js/api.js` (wrapper fetch)
- `public/assets/js/app.js` (home, async)
- `public/assets/js/admin.js` (admin, async, auth reală)
- `public/index.html`, `public/admin.html`, `public/login.html`

## Checklist
- [x] Home încarcă clinicile din API, search/filtre/modal funcționează
- [x] Tracking vizită/view/contact prin API
- [x] Admin: CRUD, upload, export/import prin API; redirect la login dacă nu ești autentificat
- [x] Statistici trase din `GET /api/stats`
