# FoodAR admin – dodavanje jela sa telefona

Lokalni panel koji radi na **tvom računaru**. Otvaraš ga sa telefona (na istoj Wi-Fi mreži) i za svako jelo:

1. **uploaduješ 3D model** (`.glb`, npr. iz Polycam / Luma / Scaniverse),
2. model se **automatski obradi da dobro izgleda i na Androidu i na iPhone-u**:
   - teksture se smanje na najviše 2048×2048 (veće Android zamuti ili odbije),
   - dodaju se glatke normale ako ih model nema (bez njih jelo izgleda ravno i „kockasto“),
   - mreža se pojednostavi ako ima više od 100.000 trouglova,
   - model se centrira i spusti na sto, a po želji se podesi na stvarnu širinu u cm,
3. **pregledaš** ga na telefonu, upišeš naziv i adresu (npr. `cevapi`),
4. klikneš **Objavi**: model i spisak jela (`dishes.json`) idu u jedan commit na GitHub, Netlify sam objavi sajt,
   a poddomen `cevapi.foodar.org` se doda na Netlify (ako je povezan),
5. preuzmeš **QR kod** (PNG ili SVG za štampu) i staviš ga na meni.

U kartici **Sva jela** vidiš sva jela, preuzimaš QR kodove, stavljaš ih u demo na sajtu ili ih brišeš.

> Panel se ne objavljuje na sajtu (`/admin` na foodar.org vraća 404). Radi samo na tvom računaru.

---

## Podešavanje (jednom)

### 1. Instaliraj Node.js
Preuzmi **LTS** verziju sa <https://nodejs.org> i instaliraj je.

### 2. Preuzmi repo na računar
Na GitHubu: **foodatest → Code → Download ZIP**, pa raspakuj. Ili `git clone https://github.com/makimili2003-cloud/foodatest.git`.

### 3. Napravi GitHub token
1. Otvori <https://github.com/settings/personal-access-tokens/new>
2. **Token name:** `foodar-admin`, **Expiration:** npr. 1 godina
3. **Repository access → Only select repositories →** `foodatest`
4. **Permissions → Repository permissions → Contents → Read and write**
5. **Generate token** i kopiraj ga (vidi se samo jednom).

### 4. (Opciono) Netlify token za automatske poddomene
1. <https://app.netlify.com/user/applications#personal-access-tokens> → **New access token** → kopiraj.
2. `NETLIFY_SITE_ID` može da ostane `foodar.org`, ili upiši Site ID iz **Site configuration → Site details**.

Bez ovoga, poddomen svakog novog jela dodaješ ručno: Netlify → **Domain management → Add domain alias** → `ime.foodar.org`.

> Ako je `foodar.org` na **Netlify DNS-u**, Netlify sam napravi DNS zapis i HTTPS sertifikat za svaki novi poddomen.
> Ako je DNS kod registrara domena, tamo jednom dodaj **wildcard** zapis: `CNAME  *  ime-sajta.netlify.app`.

### 5. Pokreni
- **Windows:** dupli klik na `admin/Pokreni-admin.bat`
- **Mac:** dupli klik na `admin/Pokreni-admin.command` (prvi put: desni klik → Open)

Prvi put se instaliraju paketi i napravi se fajl `admin/.env`. Otvori ga i upiši:

```
ADMIN_PIN=tvoj-pin
GITHUB_TOKEN=github_pat_...
NETLIFY_TOKEN=...        (opciono)
```

Pa pokreni ponovo. U prozoru piše adresa za telefon (npr. `http://192.168.1.20:3000`) i QR kod: skeniraj ga telefonom.

> **Windows:** ako telefon ne može da otvori stranicu, dozvoli Node.js u Windows Firewall-u
> (pojavi se pitanje pri prvom pokretanju → **Allow access** za privatne mreže).

---

## Saveti za snimanje jela
- Snimaj jelo na tanjiru, na stolu, pri ravnomernom svetlu bez jakih senki.
- Izvezi kao **GLB** (Polycam: Export → GLB, Luma: Download → GLB).
- Ako je model pogrešne veličine (npr. tanjir od 1 m), upiši stvarnu širinu u cm pri uploadu.
- `.usdz` za iPhone nije obavezan: ako ga ne pošalješ, iPhone verzija se pravi automatski iz obrađenog modela.

## Fajlovi
- `server.js` – lokalni server (upload, obrada, objava, QR)
- `optimize.js` – obrada 3D modela
- `github.js` – objava na GitHub (jedan commit po jelu)
- `netlify.js` – dodavanje poddomena
- `public/index.html` – izgled panela
- `../dishes.json` – spisak jela koji koriste sajt (`index.html`) i AR stranica (`ar.html`)
