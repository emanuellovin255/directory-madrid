# Task 05 — Modal detalii clinică

**Status:** ✅ Gata

## Obiectiv
La click pe o clinică → popup (modal) cu toate detaliile. Plus deep-link ca „o pagină".

## Fișiere
- `index.html` (containerul modalului)
- `assets/js/app.js` (build + open/close + deep-link)

## Checklist
- [x] Foto mare, rating, nume, zonă
- [x] Butoane: **Llamar** (tel:), **Visitar web**, **Email**
- [x] Secțiuni: Sobre nosotros, Servicios, **Horario** (evidențiază ziua curentă), Contacto, Redes sociales
- [x] Deep-link `index.html#clinica=slug` (deschide direct, partajabil)
- [x] Închidere: buton X, click pe fundal, tasta Esc; blochează scroll-ul paginii
- [x] Tracking: click pe telefon/web → statistici

## Verificare
Deschide o clinică, copiază URL-ul cu `#clinica=…`, redeschide-l într-un tab nou.
