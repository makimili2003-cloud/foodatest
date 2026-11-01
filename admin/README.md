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
- **Upiti:** svaki upit sa kontakt forme sajta se čuva u panelu (stranica **Upiti**) i stiže mejlom na
  **ar@foodar.org**, sa kopijom na milan@foodar.org i mateja@foodar.org. U panelu upit dodeliš (AR, Milan, Mateja),
  menjaš mu status (Novo, U obradi, Završeno, Arhiva), dodaješ interne beleške i **odgovaraš klijentu mejlom** na adresu
  koju je upisao u formi, sa ar@, milan@ ili mateja@ adrese (šabloni: demonstracija, ponuda, poziv).
  „Napravi pretplatu“ prenosi podatke klijenta u novu pretplatu.
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
| `GMAIL_AR_PASS` | za mejlove | App password naloga **ar@foodar.org**: obaveštenja o upitima i odgovori sa ar@ |
| `GMAIL_MILAN_PASS` | ne | App password naloga **milan@foodar.org**. Bez njega Milan šalje preko ar@ naloga (vidi ispod) |
| `GMAIL_MATEJA_PASS` | ne | App password naloga **mateja@foodar.org**. Bez njega Mateja šalje preko ar@ naloga |
| `WEBHOOK_SECRET` | ne | Za buduće automatsko upisivanje online uplata |
| `SESSION_MINUTES` | ne | Posle koliko minuta neaktivnosti se panel sam odjavi (podrazumevano 10) |
| `SESSION_SECRET` | ne | Dodatna tajna za prijavu; kad je promeniš, svi uređaji se odjave |

### Kako da promeniš lozinku
1. Netlify → **Site configuration → Environment variables** → `ADMIN_PASSWORD` → **Edit** → upiši novu → **Save**.
2. **Deploys → Trigger deploy → Deploy site** (1–2 minuta).
3. Promena lozinke **odjavljuje sve uređaje**, pa se ponovo prijaviš novom lozinkom.

Posle 8 pogrešnih pokušaja prijava se zaključava na 15 minuta (zaštita od pogađanja).
**Automatska odjava:** posle **10 minuta bez aktivnosti** panel se sam odjavi (minut ranije pojavi se upozorenje sa dugmetom
„Ostani prijavljen“). To važi i na serveru: ako zatvoriš tab ili telefon zaspi duže od 10 minuta, traži se lozinka.
Vreme se menja promenljivom `SESSION_MINUTES`. Ručna odjava: link **Odjava** gore desno.

### Mejlovi (Google Workspace App password)
Za svaki nalog sa kog šaljete (ar@, milan@, mateja@):
1. Prijavi se na taj nalog i uključi **2-Step Verification**: <https://myaccount.google.com/signinoptions/twosv>
   (ako u Workspace-u nije dozvoljeno, administrator to uključuje u admin.google.com → Security → 2-Step Verification).
2. Otvori <https://myaccount.google.com/apppasswords>, upiši ime npr. `FoodAR admin` → **Create**.
3. Kopiraj lozinku od 16 slova u Netlify kao `GMAIL_AR_PASS` (odnosno `GMAIL_MILAN_PASS`, `GMAIL_MATEJA_PASS`),
   pa **Trigger deploy**.

Poslati odgovori se vide u „Poslato“ tog Gmail naloga, a kad klijent odgovori, poruka stiže u njegov inbox.

**Milan i Mateja bez App password-a:** dovoljan je samo `GMAIL_AR_PASS`. Njihovi odgovori se tada šalju **preko ar@
naloga, u njihovo ime**: „Od“ je Milan/Mateja, klijentov odgovor ide njima (Reply-To), a oni dobijaju skrivenu kopiju.
Da bi klijent u polju „Od“ video baš milan@foodar.org (a ne ar@), u Gmail-u naloga **ar@foodar.org** jednom dodaj adrese:
**Settings (⚙) → See all settings → Accounts → Send mail as → Add another email address** → `Milan`, `milan@foodar.org`
(štikliraj *Treat as an alias*) → Gmail pošalje potvrdu na milan@ → Milan klikne link. Isto za mateja@.
Dok `GMAIL_AR_PASS` nije podešen, upiti se i dalje čuvaju u panelu, a mejl na ar@foodar.org ide preko FormSubmit-a
(prvi put stiže mejl „Activate Form“ na ar@, klikni da potvrdiš).

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
- `netlify/lib/`: zajednička logika (prijava, GitHub, Netlify domeni, pretplate, upiti, mejl, skladište).
- Upiti: `POST /api/upit` (javno, najviše 5 upita na 10 minuta po IP adresi, zamka za botove) → Netlify Blobs ključ `upiti`; mejl preko Gmail SMTP-a (`netlify/lib/mail.mjs`).
- Pretplate: Netlify Blobs, skladište `foodar-admin`, ključ `pretplate`. Dnevna rezervna kopija ide pod `rezervne-kopije/`
  (čuva se poslednjih 30), a dugme **Rezervna kopija** u panelu preuzima sve kao JSON.
