# Pravi SEO stranice sajta (ar-meni, 3d-prikaz-jela, kako-radi, cene, pitanja). Pokretanje iz korena repozitorijuma: python3 scripts/strane.py .
# Cene u PLANS moraju biti iste kao const PLANS u index.html.
import json, os, sys, html

ROOT = sys.argv[1]
SITE = 'https://foodar.org'
TODAY = '2026-11-07'

PAGES = [  # (putanja, kratak naziv za meni i breadcrumb)
    ('/ar-meni/', 'AR meni'),
    ('/3d-prikaz-jela/', '3D prikaz jela'),
    ('/kako-radi/', 'Kako radi'),
    ('/cene/', 'Cene'),
    ('/pitanja/', 'Pitanja'),
]
DESC_LINK = {
    '/ar-meni/': 'Šta je AR meni i kako gost vidi jelo na svom stolu.',
    '/3d-prikaz-jela/': 'Kako nastaje 3D model jela i zašto je bolji od fotografije.',
    '/kako-radi/': 'Od izbora jela do QR koda pored jela na Vašem meniju.',
    '/cene/': 'Paketi, jednokratno implementiranje i godišnje plaćanje.',
    '/pitanja/': 'Odgovori na pitanja koja restorani najčešće postavljaju.',
}

# Isti cenovnik kao na početnoj strani (index.html, const PLANS)
PLANS = [
    dict(name='Starter', za='Za manje restorane i kafiće', m=4490, y=3810, yt=45798, setup=11990,
         f=['Do 30 jela u AR', '3D jelo ispred gosta, pre porudžbine', 'Do 5 novih 3D jela mesečno'], no=['Prioritetna podrška']),
    dict(name='Pro', za='Najbolji izbor za većinu restorana', m=10790, y=9170, yt=110058, setup=28990, top=True,
         f=['Do 100 jela u AR', '3D jelo ispred gosta, pre porudžbine', 'Do 20 novih 3D jela mesečno', 'Prioritetna podrška'], no=[]),
    dict(name='Elite', za='Za lance i veće restorane', m=21590, y=18350, yt=220218, setup=57990,
         f=['Neograničen broj jela u AR', 'Vaš logo i boje (brendiranje)', '3D jelo ispred gosta, pre porudžbine', 'Do 40 novih 3D jela mesečno', 'Prioritetna podrška'], no=[]),
]
din = lambda n: f'{n:,}'.replace(',', '.')

FAQ_ALL = {
    'app': ('Da li gost mora da instalira aplikaciju?', 'Ne. Gost skenira QR kod običnom kamerom telefona i jelo se otvara u browseru. Nema aplikacije, naloga ni registracije.'),
    'meni': ('Da li FoodAR pravi digitalni meni?', 'Ne. FoodAR ne pravi digitalni meni ni listu jela na telefonu. Vi birate jela koja želite da istaknete; za njih pravimo 3D prikaz, a QR kod stoji pored tih jela na Vašem postojećem štampanom meniju.'),
    'telefoni': ('Na kojim telefonima radi?', '3D prikaz radi na svakom modernom telefonu. Postavljanje jela na sto (AR) radi na iPhone uređajima u Safariju i na Android telefonima koji podržavaju Google Play Services for AR, a to je većina telefona iz poslednjih nekoliko godina.'),
    'velicina': ('Da li je jelo zaista u stvarnoj veličini?', 'Da. Jela snimamo sa stvarnim dimenzijama, pa se na stolu prikazuju u razmeri 1:1, onoliko velika koliko stižu iz kuhinje.'),
    'promena': ('Šta ako promenim izgled jela ili dodam novo?', 'Izmenjeno jelo ponovo snimimo i zamenimo. Link i QR kod ostaju isti, pa ne morate ništa da štampate ponovo.'),
    'kasa': ('Da li moram da menjam meni ili sistem za porudžbine?', 'Ne. FoodAR radi uz Vaš postojeći meni. Pored izabranih jela se dodaju samo QR kodovi, kao nalepnice ili u sledećem izdanju menija. Kasa i način naručivanja ostaju isti.'),
    'koja': ('Koja jela ima smisla prikazati u 3D?', 'Najviše smisla imaju specijaliteti, nova jela, porcije za više osoba i jela za koja gosti najčešće pitaju koliko su velika. Ne morate da prikažete ceo meni; birate onoliko jela koliko Vam paket dozvoljava.'),
    'instagram': ('Šta ako gost otvori link iz Instagrama ili Facebooka?', 'Ugrađeni browser tih aplikacija ne podržava prikaz na stolu. FoodAR to prepozna i gostu pokaže kako da stranicu otvori u Safariju ili Chrome-u, gde prikaz radi.'),
    'qr_trajan': ('Da li QR kod može da prestane da radi?', 'QR kod vodi na stalnu adresu jela na foodar.org i ostaje isti i kad jelo ponovo snimimo. Ako jelo privremeno sklonite iz ponude, gost umesto greške vidi poruku da jelo trenutno nije dostupno.'),
    'cena': ('Koliko košta?', f'Paketi počinju od {din(PLANS[0]["m"])} dinara mesečno, uz jednokratno implementiranje od {din(PLANS[0]["setup"])} dinara. Godišnjim plaćanjem mesečne pretplate štedite 15%.'),
    'implementiranje': ('Šta obuhvata implementiranje?', 'Implementiranje se plaća jednom i obuhvata 3D snimanje i obradu izabranih jela, njihove linkove i QR kodove spremne za štampu ili nalepnice. Posle toga plaćate mesečno održavanje po izabranom paketu.'),
    'godisnje': ('Koliko se štedi godišnjim plaćanjem?', 'Godišnjim plaćanjem mesečne pretplate štedite 15%. Na primer, Starter tada izlazi 3.810 dinara mesečno umesto 4.490 dinara.'),
    'otkaz': ('Mogu li da otkažem?', 'Mesečna pretplata se plaća mesečno i može da se otkaže bilo kada.'),
    'demo': ('Mogu li da vidim kako izgleda pre odluke?', 'Da. Na početnoj strani možete da isprobate demo jela, a demonstracija u Vašem restoranu je besplatna i bez obaveze.'),
}

def faq_html(keys):
    return '<div class="faq">' + ''.join(f'<details><summary>{html.escape(FAQ_ALL[k][0])}</summary><p>{html.escape(FAQ_ALL[k][1])}</p></details>' for k in keys) + '</div>'

def faq_ld(keys):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': FAQ_ALL[k][0], 'acceptedAnswer': {'@type': 'Answer', 'text': FAQ_ALL[k][1]}} for k in keys]}

def plans_html():
    out = []
    for p in PLANS:
        out.append(f'''<div class="plan{' top' if p.get('top') else ''}">
  {'<span class="badge">Preporučeno</span>' if p.get('top') else ''}<h3>{p['name']}</h3>
  <p class="for">{p['za']}</p>
  <div class="price">{din(p['m'])} <small>din / mesečno</small></div>
  <p class="sub">Godišnje: {din(p['y'])} din mesečno ({din(p['yt'])} din godišnje)</p>
  <p class="setup">+ <b>{din(p['setup'])} din</b> jednokratno implementiranje</p>
  <ul>{''.join(f'<li>{x}</li>' for x in p['f'])}{''.join(f'<li class="no">{x}</li>' for x in p['no'])}</ul>
  <a class="btn{'' if p.get('top') else ' ghost'}" href="/#kontakt">Izaberite {p['name']}</a>
</div>''')
    return '<div class="plans">' + ''.join(out) + '</div>'

LOGO = '<a class="logo" href="/"><i>AR</i>FoodAR</a>'

def page(path, short, title, desc, h1, eyebrow, lead, body, faq_keys=None, shot=None, extra_ld=None):
    url = SITE + path
    cur = ' aria-current="page"'
    nav = ''.join(f'<a href="{p}"{cur if p == path else ""}>{n}</a>' for p, n in PAGES)
    graph = [
        {'@type': 'WebPage', '@id': url + '#page', 'url': url, 'name': title, 'description': desc, 'inLanguage': 'sr',
         'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#service'}, 'dateModified': TODAY},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'FoodAR', 'item': SITE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': short, 'item': url}]},
    ]
    if faq_keys: graph.append(faq_ld(faq_keys))
    if extra_ld: graph.append(extra_ld)
    ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False)
    more = ''.join(f'<li><a href="{p}"><b>{n}</b><span>{DESC_LINK[p]}</span></a></li>' for p, n in PAGES if p != path)
    shot_html = f'<figure class="shot"><img src="{shot[0]}" alt="{shot[1]}" width="{shot[2]}" height="{shot[3]}" loading="eager" decoding="async" /></figure>' if shot else ''
    doc = f'''<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}" />
  <link rel="canonical" href="{url}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:title" content="{html.escape(title)}" />
  <meta property="og:description" content="{html.escape(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="FoodAR" />
  <meta property="og:url" content="{url}" />
  <meta property="og:locale" content="sr_RS" />
  <meta property="og:image" content="{SITE}/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{html.escape(title)}" />
  <meta name="twitter:description" content="{html.escape(desc)}" />
  <meta name="twitter:image" content="{SITE}/og-image.jpg" />
  <meta name="theme-color" content="#1f1a17" />
  <link rel="icon" href="/favicon.ico" sizes="48x48" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/strane.css?v=1" />
  <script type="application/ld+json">{ld}</script>
</head>
<body>
<header><div class="wrap nav">
  {LOGO}
  <nav class="nav-links" aria-label="Glavni meni">{nav}<a class="btn" href="/#kontakt">Kontakt</a></nav>
</div></header>
<main class="wrap">
  <nav class="crumbs" aria-label="Putanja"><a href="/">FoodAR</a><span>/</span>{short}</nav>
  <div class="intro{'' if shot else ' solo'}">
    <div>
      <span class="eyebrow">{eyebrow}</span>
      <h1>{h1}</h1>
      <p class="lead">{lead}</p>
      <div class="ctas"><a class="btn" href="/#kontakt">Zakažite besplatnu demonstraciju</a><a class="btn ghost" href="/#demo">Isprobajte demo</a></div>
    </div>
    {shot_html}
  </div>
  <article class="prose">
{body}
{('<h2>Česta pitanja</h2>' + faq_html(faq_keys)) if faq_keys else ''}
  </article>
  <aside class="cta">
    <h2>Pogledajte kako bi izgledalo u Vašem restoranu</h2>
    <p>Pokažite nam jela koja želite da istaknete. Demonstracija je besplatna i bez obaveze, a ponudu pravimo prema broju jela.</p>
    <a class="btn" href="/#kontakt">Pošaljite upit</a>
  </aside>
  <nav class="more" aria-label="Saznajte više"><h2>Saznajte više</h2><ul>{more}</ul></nav>
</main>
<footer><div class="wrap row">
  {LOGO}
  <nav aria-label="Stranice"><a href="/">Početna</a>{''.join(f'<a href="{p}">{n}</a>' for p, n in PAGES)}</nav>
  <span><a href="https://www.instagram.com/foodar.rs/" rel="noopener">@foodar.rs</a> · <a href="mailto:ar@foodar.org">ar@foodar.org</a></span>
</div></footer>
</body>
</html>
'''
    d = os.path.join(ROOT, path.strip('/'))
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w').write(doc)

# ---------------------------------------------------------------- AR meni
page('/ar-meni/', 'AR meni',
     'AR meni za restorane – jelo na stolu gosta u stvarnoj veličini | FoodAR',
     'AR meni prikazuje jelo na stolu gosta u stvarnoj veličini, pre porudžbine. Gost skenira QR kod pored jela na Vašem meniju, bez aplikacije. FoodAR za restorane u Srbiji.',
     'AR meni za restorane', 'Proširena stvarnost za restorane',
     'Gost skenira QR kod pored jela na Vašem postojećem meniju i vidi to jelo na svom stolu, u stvarnoj veličini, pre nego što ga poruči. Bez aplikacije.',
     '''<h2>Šta je AR meni?</h2>
<p>AR je skraćenica od „augmented reality“, odnosno proširena stvarnost. Telefon kroz kameru prikazuje sto ispred gosta i na njega postavlja 3D model jela. Gost na ekranu vidi tanjir pored svoje čaše i pribora, može da ga obiđe sa svih strana i odmah proceni koliko je porcija velika.</p>
<p>Kod FoodAR-a „AR meni“ ne znači novi meni. Vaš štampani meni ostaje isti, a pored jela koja izaberete stoji mali QR kod koji otvara baš to jelo u 3D i na stolu.</p>
<div class="note"><b>FoodAR ne pravi digitalni meni.</b> Ne pravimo listu jela na telefonu, ne menjamo kasu ni način naručivanja. Prikazujemo u 3D samo jela koja Vi izaberete.</div>
<h2>Kako AR meni radi u Vašem restoranu</h2>
<ol class="steps">
<li><b>Vi birate jela</b>Specijalitete, nova jela, porcije za više osoba: ona za koja gosti najčešće pitaju.</li>
<li><b>Snimamo ih u 3D</b>Dolazimo u restoran i snimamo jela onako kako ih Vaša kuhinja servira, sa stvarnim dimenzijama.</li>
<li><b>QR kod pored jela</b>Svako izabrano jelo dobija svoj link i QR kod, koji stoji pored tog jela na Vašem meniju.</li>
<li><b>Gost vidi jelo na stolu</b>Gost skenira kod kamerom telefona, dodirne ekran i jelo se pojavi na stolu u razmeri 1:1.</li>
</ol>
<h2>Šta gost dobija</h2>
<ul>
<li><b>Pravu veličinu porcije.</b> Jelo je na stolu onoliko veliko koliko stiže iz kuhinje.</li>
<li><b>Pravi izgled.</b> Ne crtež i ne obična fotografija, već 3D snimak Vašeg jela.</li>
<li><b>Sigurniju odluku.</b> Gost zna šta poručuje, pa ima manje iznenađenja kada jelo stigne.</li>
</ul>
<h2>Šta restoran dobija</h2>
<ul>
<li>Manje ponavljanja istih pitanja tipa „koliko je velika porcija?“.</li>
<li>Lakše predstavljanje novih jela i specijaliteta koje gost ne poznaje.</li>
<li>Utisak koji gosti pamte i pokazuju drugima.</li>
<li>Rad uz postojeći meni, bez nove štampe i bez promene kase.</li>
</ul>
<h2>Na kojim telefonima radi</h2>
<p>Prikaz na stolu radi na iPhone uređajima u Safariju i na Android telefonima sa Google Play Services for AR, što je većina telefona iz poslednjih nekoliko godina. Na ostalim telefonima gost i dalje vidi jelo u 3D i može da ga okreće i zumira. Više o samom 3D modelu pročitajte na stranici <a href="/3d-prikaz-jela/">3D prikaz jela</a>.</p>''',
     faq_keys=['app', 'meni', 'telefoni', 'velicina', 'instagram'],
     shot=('/media/foodar-9x16.jpg', 'Gost skenira QR kod pored jela na štampanom meniju u restoranu', 720, 1280))

# ---------------------------------------------------------------- 3D prikaz jela
page('/3d-prikaz-jela/', '3D prikaz jela',
     'Interaktivni 3D prikaz jela za restorane – 3D meni | FoodAR',
     'Interaktivni 3D prikaz jela: gost okreće i zumira pravo jelo iz Vašeg restorana i postavlja ga na sto u stvarnoj veličini. Kako nastaju 3D modeli jela i zašto su bolji od fotografije.',
     'Interaktivni 3D prikaz jela', '3D meni za restorane',
     'Umesto fotografije, gost vidi 3D snimak jela koje ste izabrali: okreće ga, zumira i postavlja na svoj sto u stvarnoj veličini.',
     '''<h2>Šta je interaktivni 3D prikaz jela?</h2>
<p>To je 3D model stvarnog jela iz Vašeg restorana, napravljen snimanjem, a ne crtanjem. Gost ga otvara na telefonu skeniranjem QR koda pored jela, okreće ga prstom, zumira detalje i jednim dodirom ga postavlja na sto u AR prikazu. Isti model služi i za 3D prikaz na ekranu i za <a href="/ar-meni/">AR meni</a> na stolu.</p>
<h2>3D prikaz ili fotografija?</h2>
<div class="tbl"><table>
<thead><tr><th></th><th>Fotografija na meniju</th><th>3D prikaz jela</th></tr></thead>
<tbody>
<tr><th scope="row">Ugao gledanja</th><td>Jedan, unapred izabran</td><td>Gost okreće jelo sa svih strana</td></tr>
<tr><th scope="row">Veličina porcije</th><td>Teško se procenjuje</td><td>Prikaz u razmeri 1:1 na stolu</td></tr>
<tr><th scope="row">Mesto na meniju</th><td>Zauzima prostor na papiru</td><td>Potreban je samo mali QR kod pored jela</td></tr>
<tr><th scope="row">Promena jela</th><td>Često znači novu štampu</td><td>Model se zameni, QR kod ostaje isti</td></tr>
</tbody></table></div>
<h2>Kako nastaje 3D model jela</h2>
<ol class="steps">
<li><b>Snimanje u restoranu</b>Jelo snimamo onako kako ga Vaša kuhinja servira, sa svih strana.</li>
<li><b>Obrada modela</b>Model obrađujemo da izgleda realno, kao pravo jelo, i da se brzo učitava na mobilnom internetu.</li>
<li><b>Stvarne dimenzije</b>Model zadržava stvarnu veličinu jela, pa je na stolu prikazan u razmeri 1:1.</li>
<li><b>Link i QR kod</b>Svako izabrano jelo dobija stalni link i QR kod za Vaš meni.</li>
</ol>
<h2>Koja jela prvo prikazati u 3D</h2>
<ul>
<li>Specijalitete kuće i jela koja najviše želite da prodate.</li>
<li>Nova jela koja gosti još ne poznaju.</li>
<li>Porcije za više osoba, daske i plate, gde je veličina najvažnija.</li>
<li>Jela za koja konobari najčešće dobijaju pitanje „koliko je to veliko?“.</li>
</ul>
<p>Ne morate da prikažete ceo meni. Broj jela zavisi od paketa, pogledajte <a href="/cene/">cene</a>.</p>''',
     faq_keys=['koja', 'promena', 'velicina', 'telefoni'])

# ---------------------------------------------------------------- Kako radi
page('/kako-radi/', 'Kako radi',
     'Kako radi FoodAR – od izbora jela do QR koda na Vašem meniju | FoodAR',
     'Kako FoodAR radi: birate jela, snimamo ih u 3D u Vašem restoranu, QR kod ide pored jela na postojećem meniju, a gost vidi jelo na stolu u stvarnoj veličini. Bez nove štampe i bez promene kase.',
     'Kako radi FoodAR', 'Za restorane',
     'Vi nastavljate da radite kao i do sada. Mi snimamo jela koja izaberete i pripremamo QR kodove, a gost ih vidi na svom stolu pre porudžbine.',
     '''<h2>Za restoran: četiri koraka</h2>
<ol class="steps">
<li><b>Demonstracija i izbor jela</b>Pokazujemo Vam kako izgleda na Vašem stolu i zajedno biramo jela koja vredi istaći.</li>
<li><b>3D snimanje u restoranu</b>Snimamo izabrana jela onako kako ih kuhinja servira i obrađujemo modele.</li>
<li><b>QR kodovi za meni</b>Dobijate QR kodove spremne za štampu ili nalepnice; svaki stoji pored svog jela na postojećem meniju.</li>
<li><b>Održavanje</b>Nova i izmenjena jela dodajemo prema paketu, a linkovi i QR kodovi ostaju isti.</li>
</ol>
<h2>Za gosta: šta se dešava za stolom</h2>
<ol class="steps">
<li><b>Skenira kod pored jela</b>Kamerom telefona, sa Vašeg štampanog menija. Bez aplikacije i bez naloga.</li>
<li><b>Otvara se stranica jela</b>Jelo se prikaže u 3D, a jedan dodir na ekran pokreće prikaz na stolu.</li>
<li><b>Vidi jelo na svom stolu</b>U stvarnoj veličini, sa svih strana. Zna šta dobija pre nego što poruči.</li>
</ol>
<div class="note">Telefon traži taj jedan dodir zbog pravila browsera; prikaz na stolu ne može da se pokrene sam od sebe.</div>
<h2>Šta se ne menja</h2>
<ul>
<li>Vaš meni: ne pravimo novi ni digitalni meni, samo dodajemo QR kodove pored izabranih jela.</li>
<li>Kasa i način naručivanja.</li>
<li>Rad osoblja: gost se o jelu informiše sam, dok čeka.</li>
</ul>
<h2>Šta kada promenite jelo</h2>
<p>Kada promenite izgled jela, ponovo ga snimimo i zamenimo model. Link i QR kod ostaju isti, pa ne štampate ništa ponovo. Ako jelo privremeno sklonite iz ponude, gost umesto greške vidi poruku da jelo trenutno nije dostupno.</p>''',
     faq_keys=['kasa', 'qr_trajan', 'app', 'instagram', 'demo'],
     shot=('/media/foodar-4x5.jpg', 'Gost u restoranu skenira QR kod pored jela na meniju', 864, 1080))

# ---------------------------------------------------------------- Cene
page('/cene/', 'Cene',
     'Cene AR menija – paketi i implementiranje | FoodAR',
     f'Cene FoodAR AR menija: paketi od {din(PLANS[0]["m"])} din mesečno, uz jednokratno implementiranje od {din(PLANS[0]["setup"])} din. Godišnjim plaćanjem štedite 15%. Starter, Pro i Elite.',
     'Cene AR menija', 'Cene',
     'Jednokratno implementiranje, zatim mesečno održavanje. Birate paket prema broju jela koja želite da prikažete u AR-u.',
     f'''<h2>Paketi</h2>
{plans_html()}
<p>Cene su u dinarima. Mesečna pretplata se plaća mesečno i može da se otkaže bilo kada; godišnjim plaćanjem štedite 15%.</p>
<h2>Šta obuhvata implementiranje</h2>
<ul>
<li>3D snimanje izabranih jela u Vašem restoranu.</li>
<li>Obradu modela za realan izgled i brzo učitavanje na telefonu.</li>
<li>Stalni link i QR kod za svako izabrano jelo, spreman za štampu ili nalepnice.</li>
</ul>
<h2>Šta obuhvata mesečno održavanje</h2>
<ul>
<li>Hosting 3D jela i stranica jela na foodar.org.</li>
<li>Nova 3D jela mesečno, prema paketu.</li>
<li>Zamenu modela kada promenite jelo, uz isti link i QR kod.</li>
</ul>
<p>Za veći broj lokala ili posebne potrebe pošaljite upit i napravićemo ponudu po meri.</p>''',
     faq_keys=['cena', 'implementiranje', 'godisnje', 'otkaz', 'demo'],
     extra_ld={'@type': 'OfferCatalog', 'name': 'FoodAR paketi', 'itemListElement': [
         {'@type': 'Offer', 'name': p['name'], 'price': p['m'], 'priceCurrency': 'RSD', 'description': f"{p['f'][0]}. Mesečno; jednokratno implementiranje {din(p['setup'])} din.",
          'itemOffered': {'@id': SITE + '/#service'}} for p in PLANS]})

# ---------------------------------------------------------------- Pitanja
ALLQ = ['meni', 'app', 'telefoni', 'velicina', 'kasa', 'koja', 'promena', 'qr_trajan', 'instagram', 'cena', 'implementiranje', 'godisnje', 'otkaz', 'demo']
page('/pitanja/', 'Pitanja',
     'Česta pitanja o AR meniju i 3D prikazu jela | FoodAR',
     'Odgovori na pitanja restorana o FoodAR-u: da li gost treba aplikaciju, na kojim telefonima radi, da li je jelo u stvarnoj veličini, šta se dešava kada promenite jelo i koliko košta.',
     'Česta pitanja', 'Pitanja i odgovori',
     'Sve što restorani najčešće pitaju o AR meniju, 3D prikazu jela, QR kodovima i cenama.',
     '', faq_keys=ALLQ)

print('ok')
