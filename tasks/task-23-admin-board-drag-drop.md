# Task 23 — Admin: board de clasament (drag & drop) ✅

**Status:** ✅ Gata · **Faza 4 (clasament + poze)**

## Obiectiv
O vedere nouă în admin unde ordonezi empresas **drag & drop**, organizat în **pagini de 20**, per context
(home / nișă / nișă×zonă / nișă×municipiu). Implicit ordinea e aleatorie; doar ce fixezi aici se salvează.

## Implementat
- **`public/admin.html`**: buton nou în sidebar `data-view="orden"` + secțiunea `#view-orden` cu selector
  de context (tip Home/Por servicio → servicio + ámbito: Toda la Comunidad / Por zona / Por municipio),
  board `#ord-board`, panou „Añadir empresas" (doar pentru home), butoane „Guardar orden" /
  „Restablecer a aleatorio".
- **`public/assets/js/admin.js`** (modul Orden):
  - `ordResolveContext` compune cheia; `ordSyncFields` arată/ascunde selectoarele; `ordFillSelectors`
    (nișe, municipii, zone din `api.zones`).
  - `ordRenderBoard`: blocuri „Página N" (max 20 sloturi), fiecare slot = poziție + thumbnail
    (logo/cover) + nume + zonă + acțiuni (▲ ▼, iar la home și „Quitar").
  - **Drag & drop vanilla** (zero dependințe) pe `#ord-board`: `dragstart/dragover/drop`, reordonează
    array-ul plat `ordItems` (inserare înainte/după în funcție de poziția mouse-ului), funcționează și
    **între pagini**. Fallback: butoane sus/jos.
  - Home: „Añadir" din `available` (inserare **random**), căutare, „Quitar".
  - `ordSave` → `api.setPlacements`; `ordReset` → `api.clearPlacements`. Board-ul = ordinea publică (WYSIWYG).
  - Cârligat în `switchView('orden')` + `bindOrden()` în `boot()`.
- **CSS**: `.ord-toolbar`, `.ord-board`, `.ord-page`, `.ord-slot` (+ `.dragging`/`.drop-target`),
  `.ord-add*`.

## Verificat (browser)
Login → „Orden": Home arată lista + panoul de adăugare; adaug 2 → board „Página 1: 2 empresas" →
„Guardar orden" → persistă pe `/destacadas` în ordinea corectă. „Por servicio → Electricistas" arată
2 empresas reorderabile, fără panou de adăugare (membership automat). Selectoarele zonă/municipiu apar
corect. Fără erori în consolă.
