# Task 21 — Poze per client: logo + galerie de servicii ✅

**Status:** ✅ Gata · **Faza 4 (clasament + poze)**

## Obiectiv
Fiecare negocio poate avea un **logo** separat + o **galerie de poze de la servicii** (mai multe).
Se afișează pe card (logo suprapus + copertă) și pe ficha (logo în header + galerie „Trabajos y servicios").

## Implementat
- **Randare (`server/render.js`)**
  - Helperi noi `bizCover(b)` = `photos[0] || photo || placeholder`; `bizLogo(b)` = `logo`.
  - `businessCard`: imaginea = `bizCover` + avatar-logo suprapus (`.card-logo`) dacă există logo.
  - `renderBusiness`: logo în `biz-head` (`.biz-logo`), copertă = `bizCover`, secțiune nouă
    **„Trabajos y servicios"** (`.biz-gallery`) cu grid de poze; JSON-LD `image`/`logo` + `ogImage`
    folosesc `logo || photos[0] || photo`.
- **Admin (`public/admin.html` + `admin.js`)**
  - Drawer: câmp **Logo** dedicat + **Foto de portada** (opțional) + **Fotos de servicios** (multi-upload,
    grid de thumbnails cu buton „×" per poză, tile „+" de adăugare).
  - State `formLogo`, `formPhotos[]`; `setLogoPreview()`, `renderGallery()`; `gather()`/`openDrawer()`
    extinse; `prefillFromExtract` setează și logo din poza extrasă.
  - Refolosește `resizeImage` + `POST /api/upload` (logo la 480px, poze la 1000px).
- **CSS (`public/assets/css/styles.css`)**: `.card-logo`, `.biz-logo`, `.biz-gallery`, `.photo-gallery`,
  `.pg-thumb`, `.pg-add-tile`.

## Verificat
- PUT negocio cu `logo` + `photos` → ficha afișează `biz-logo` + galeria; cardul de listă afișează `card-logo`.
- Upload-ul serverless păstrează pozele inline (data URL) în Postgres — se recomandă galerii mici
  (resize + cap 1.5MB/poză).
