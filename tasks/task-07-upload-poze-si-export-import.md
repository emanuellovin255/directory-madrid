# Task 07 — Upload poze & export/import

**Status:** ✅ Gata

## Obiectiv
Adăugare/înlocuire poze din admin (fără server) și backup/mutare a datelor.

## Fișiere
- `assets/js/admin.js` (resize, export, import)
- `assets/js/store.js` (exportJSON / importJSON)

## Checklist
- [x] Upload imagine → **redimensionare pe client** (max 900px, JPEG) → data-URL în localStorage
- [x] Preview live + buton „Quitar" (revine la placeholder cu monogram)
- [x] **Exportar**: descarcă tot ca `clinicas-madrid.json`
- [x] **Importar**: încarcă un JSON (validat) și repopulează directorul
- [x] **Restaurar demo**: revine la cele 3 clinici seed
- [x] Tratare eroare la stocare plină (mesaj clar)

## Note
localStorage ~5MB. Redimensionarea ține pozele mici; pentru multe poze mari → backend (Storage).
