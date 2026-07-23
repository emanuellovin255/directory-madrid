# Deploy „Reformas Madrid" (Directory) pe Vercel — ghid pas cu pas

> ⏳ **OPȚIONAL — pentru viitor.** Acum totul rulează **local** (dublu-click pe
> `Pornește aplicațiile.command`), fără cloud, cu date permanente pe disc. Acest
> ghid e aici pentru când vei vrea să pui Directory-ul online (public, accesibil
> de oriunde). Până atunci, nu trebuie să faci nimic din ce scrie mai jos.

Când vei vrea online: **Directory pe Vercel** (site public, mereu online) +
**CRM local** pe Mac (rămâne pe `Pornește aplicațiile.command`).

> De ce ai nevoie de o bază de date: Vercel nu are disc permanent, deci fișierul
> SQLite local nu supraviețuiește acolo. Aplicația știe deja să folosească un
> **Postgres gratuit** (setezi `DATABASE_URL`) — datele tale din Directory devin
> permanente și independente de CRM.

Durează ~5–10 minute. Ai nevoie de 2 conturi gratuite: **Supabase** (baza de
date — pe care deja o ai de la CRM) și **Vercel** (hosting).

---

## Pasul 1 — Bază de date gratuită (Supabase, ~2 min)

Aplicația e construită special pentru Supabase (SSL pe pooler-ul lor gestionat
automat), iar tu **ai deja cont** de la CRM.

1. Intră pe **https://supabase.com** → Dashboard.
2. **New project** (ex. „reformas-madrid"). Alege o **parolă de bază de date** și
   ține-o minte. Regiune: Europa (Frankfurt/Ireland).
3. După ce se creează (~1 min): **Project Settings → Database → Connection string
   → „Transaction pooler"**. Copiază string-ul — arată așa:
   ```
   postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
4. Înlocuiește `[YOUR-PASSWORD]` cu parola de la pasul 2. Ăsta e `DATABASE_URL`.
   > Folosește **„Transaction pooler" (portul 6543)** — e cel potrivit pentru
   > serverless (Vercel). NU „Direct connection".

> Notă plan gratuit: dacă site-ul stă complet fără trafic ~1 săptămână, Supabase
> „adoarme" proiectul și trebuie să apeși o dată „Restore" în dashboard. La un
> site public cu vizitatori nu se întâmplă.

(Dacă vreodată vrei fără cloud deloc: nu seta `DATABASE_URL` și rulezi Directory
local ca acum — datele stau în `server/data.db`.)

---

## Pasul 2 — Deploy pe Vercel

### Varianta A — cu Vercel CLI (cea mai simplă, fără GitHub)

În Terminal (o singură dată):
```bash
npm i -g vercel
cd ~/Desktop/Directory
vercel        # prima dată: se deschide browserul → login. Răspunde Enter la întrebări.
```
Prima rulare face un deploy de test. Nu e gata până nu pui variabilele de la Pasul 3.

### Varianta B — cu GitHub (dacă preferi din browser)

1. Pune folderul `Directory` într-un repo GitHub (nou, privat e ok).
2. Pe **https://vercel.com** → „Add New → Project" → importă repo-ul.
3. Framework preset: **Other**. Build command: gol. Output: gol. → Deploy.

---

## Pasul 3 — Variabile de mediu pe Vercel (obligatoriu)

Pe **vercel.com → proiectul tău → Settings → Environment Variables**, adaugă:

| Nume | Valoare |
|---|---|
| `DATABASE_URL` | connection string-ul de la Supabase, Transaction pooler (Pasul 1) |
| `ADMIN_USERNAME` | user-ul tău de admin (ex. `admin`) |
| `ADMIN_PASSWORD` | o parolă bună (nu lăsa `admin`) |
| `SESSION_SECRET` | ceva lung/aleator — generează: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `API_TOKEN` | **aceeași valoare** ca `DIRECTORY_API_TOKEN` din `prospectquest/.env.local` |

> `API_TOKEN` e legătura CRM → Directory. Trebuie identic în ambele locuri, altfel
> push-ul din CRM primește 401.

După ce le adaugi: **Deployments → ultimul deploy → Redeploy** (ca să prindă
variabilele). Sau, la CLI: `vercel --prod`.

La prima pornire cu `DATABASE_URL` setat, aplicația își creează singură tabelele
și seed-ul (distritos, barrios, categorii) în Postgres.

---

## Pasul 4 — Conectează CRM-ul la Directory-ul online

În `prospectquest/.env.local`, schimbă `DIRECTORY_URL` cu URL-ul de pe Vercel:
```
DIRECTORY_URL=https://numele-tau.vercel.app
DIRECTORY_API_TOKEN=... (rămâne același)
```
Repornește CRM-ul (închide și redeschide `Pornește aplicațiile.command`).

---

## Gata 🎯

- **Directory**: public la `https://numele-tau.vercel.app` — mereu online, datele
  în Postgres (permanente).
- **CRM**: dublu-click pe `Pornește aplicațiile.command` → se deschide în browser pe
  `localhost:3001`. Leadurile tale rămân locale și private pe Mac.
- Butonul „Adaugă în Directory" din CRM trimite acum leadurile direct pe site-ul
  public de pe Vercel.

**Ce salvezi în Directory NU se șterge** dacă ștergi contactul din CRM — sunt baze
de date separate, iar legătura e într-un singur sens (CRM trimite; nu șterge nimic
din Directory).
