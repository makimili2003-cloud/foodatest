# FoodAR admin – na internetu (foodar.org/admin)

Admin panel radi direktno na sajtu: **https://foodar.org/admin/**, sa telefona ili računara, bilo gde.
Cela admin stranica je zaključana lozinkom: bez nje se vidi samo ekran za prijavu (ni stranice ni njihov kod).

- **Jela:** uploaduješ 3D model (`.glb`). Model se **obradi na tvom uređaju** da dobro izgleda na Androidu i iPhone-u:
  - teksture najviše 2048×2048;
  - glatke normale ako ih nema;
  - mreža pojednostavljena iznad 100.000 trouglova;
  - model spušten na sto, a po želji podešen na stvarnu širinu u cm.

  Posle pregleda klikneš **Objavi**: model ide na GitHub, Netlify objavi sajt i dodaje poddomen (`ime.foodar.org`).
  Preuzmeš QR kod (PNG ili SVG za štampu).
- **Pretplate:** klijenti, uplate, ko kasni, koliko novca očekuješ ovog meseca, grafikon prihoda, izvoz CSV i rezervna kopija.
  Podaci se čuvaju u **Netlify Blobs** (privatno skladište sajta), **ne** na GitHub-u.

---

## Podešavanje (jednom): promenljive u Netlify-ju

Netlify → tvoj sajt → **Site configuration → Environment variables → Add a variable**.
Posle dodavanja ili izmene promenljive: **Deploys → Trigger deploy → Deploy site**.

| Promenljiva | Obavezno | Šta je |
|---|---|---|
| `ADMIN_PASSWORD` | **da** | Lozinka za admin panel. **Ovde je menjaš.** Neka bude duga (npr. 4 nasumične reči). |
| `GITHUB_TOKEN` | da, za objavu jela | GitHub token sa dozvolom *Contents: Read and write* za repo `foodatest` |
| `NETLIFY_TOKEN` | ne | Za automatsko dodavanje poddomena (`ime.foodar.org`) |
| `WEBHOOK_SECRET` | ne | Za buduće automatsko upisivanje online uplata |
| `SESSION_SECRET` | ne | Dodatna tajna za prijavu; kad je promeniš, svi uređaji se odjave |

### Kako da promeniš lozinku
1. Netlify → **Site configuration → Environment variables** → `ADMIN_PASSWORD` → **Edit** → upiši novu → **Save**.
2. **Deploys → Trigger deploy → Deploy site** (1–2 minuta).
3. Promena lozinke **odjavljuje sve uređaje**, pa se ponovo prijaviš novom lozinkom.

Posle 8 pogrešnih pokušaja prijava se zaključava na 15 minuta (zaštita od pogađanja). Prijava traje 30 dana po uređaju.
Odjava: link **Odjava** gore desno.

### GitHub token
1. <https://github.com/settings/personal-access-tokens/new>
2. **Repository access → Only select repositories →** `foodatest`
3. **Permissions → Repository permissions → Contents → Read and write**
4. **Generate token**, kopiraj ga u Netlify kao `GITHUB_TOKEN`.

### Netlify token (opciono, za automatske poddomene)
<https://app.netlify.com/user/applications#personal-access-tokens> → **New access token** → kopiraj u `NETLIFY_TOKEN`.
Bez njega, poddomen novog jela dodaješ ručno: **Domain management → Add domain alias** → `ime.foodar.org`.

---

## Kako je napravljeno (za programera)

- `admin/`: stranice panela (`index.html` + `jela.js` za jela, `pretplate.html`) i `common.js` (prijava, pozivi ka API-ju).
- `admin/vendor/optimize.js`: obrada modela u browseru, spakovana iz `admin-src/optimize.js`
  (`npm install && npm run build:optimizer`).
- `netlify/edge-functions/admin-gate.js`: čuva sve pod `/admin` (traži važeći kolačić prijave).
- `netlify/functions/api.mjs`: API panela (`/api/*`): prijava, upload modela u delovima (Netlify prima najviše ~6 MB
  po zahtevu), objava na GitHub, pretplate.
- `netlify/functions/uplata.mjs`: `POST /integracije/uplata` za buduće online plaćanje (zaglavlje `X-Webhook-Secret`).
  Pretplatu napravi ili produži, a isti `paymentId` ne upisuje dva puta.
- `netlify/lib/`: zajednička logika (prijava, GitHub, Netlify domeni, pretplate, skladište).
- Pretplate: Netlify Blobs, skladište `foodar-admin`, ključ `pretplate`. Dnevna rezervna kopija ide pod `rezervne-kopije/`
  (čuva se poslednjih 30), a dugme **Rezervna kopija** u panelu preuzima sve kao JSON.
