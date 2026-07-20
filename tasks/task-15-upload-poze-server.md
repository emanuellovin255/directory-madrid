# Task 15 — Upload poze pe server ✅

**Status:** ✅ Gata

## Obiectiv
Pozele încărcate din admin se salvează pe server (pe disc), nu în localStorage.

## Fișiere
- `server/server.js`
- folderul `uploads/`

## Checklist
- [ ] `POST /api/upload` (protejat) primește imaginea (dataURL redimensionat pe client)
- [ ] Validare tip/dimensiune; scrie fișier unic în `uploads/`
- [ ] Întoarce `{ url: "/uploads/…" }`, folosit ca `photo` la clinică
- [ ] Fișierele din `uploads/` sunt servite public
