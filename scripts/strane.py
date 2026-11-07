# Pravi SEO stranice sajta (ar-meni, 3d-prikaz-jela, kako-radi, cene, pitanja). Pokretanje iz korena repozitorijuma: python3 scripts/strane.py .
# Cene u PLANS moraju biti iste kao const PLANS u index.html.
import json, os, sys, html

ROOT = sys.argv[1]
SITE = 'https://foodar.org'
TODAY = '2026-11-08'

PAGES = [  # (putanja, kratak naziv za meni i breadcrumb)
    ('/ar-meni/', 'AR meni'),
    ('/3d-prikaz-jela/', '3D prikaz jela'),
    ('/kako-radi/', 'Kako radi'),
    ('/cene/', 'Cene'),
    ('/pitanja/', 'Pitanja'),
    ('/vodic/', 'Vodič'),
]
DESC_LINK = {
    '/ar-meni/': 'Šta je AR meni i kako gost vidi jelo na svom stolu.',
    '/3d-prikaz-jela/': 'Kako nastaje 3D model jela i zašto je bolji od fotografije.',
    '/kako-radi/': 'Od izbora jela do QR koda pored jela na Vašem meniju.',
    '/cene/': 'Paketi, jednokratno implementiranje i godišnje plaćanje.',
    '/pitanja/': 'Odgovori na pitanja koja restorani najčešće postavljaju.',
    '/vodic/': 'Tekstovi o AR meniju, 3D meniju i interaktivnom meniju za restorane.',
}

# Tekstovi u vodiču: (putanja, naslov u listi, kratak opis, datum objave)
ARTICLES = [
    ('/vodic/interaktivni-meni-za-restorane/', 'Interaktivni meni za restorane: vrste i šta izabrati',
     'Digitalni QR meni, 3D meni i AR meni: po čemu se razlikuju i šta kome odgovara.', '2026-11-08'),
    ('/vodic/kako-ar-meni-pomaze-prodaji/', 'Kako AR meni pomaže restoranu da proda više',
     'Zašto gost koji vidi jelo lakše poručuje specijalitete i veće porcije.', '2026-11-08'),
    ('/vodic/3d-meni-sa-qr-kodom/', '3D meni sa QR kodom: jelo na stolu bez aplikacije',
     'Kako gost jednim skeniranjem vidi 3D jelo i šta restoranu treba da to radi.', '2026-11-08'),
]

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

def page(path, short, title, desc, h1, eyebrow, lead, body, faq_keys=None, shot=None, extra_ld=None, parent=None, more_items=None, nav_path=None):
    nav_path = nav_path or path
    url = SITE + path
    cur = ' aria-current="page"'
    nav = ''.join(f'<a href="{p}"{cur if p == nav_path else ""}>{n}</a>' for p, n in PAGES)
    trail = [('FoodAR', SITE + '/')] + ([(parent[1], SITE + parent[0])] if parent else []) + [(short, url)]
    graph = [
        {'@type': 'WebPage', '@id': url + '#page', 'url': url, 'name': title, 'description': desc, 'inLanguage': 'sr',
         'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#service'}, 'dateModified': TODAY},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(trail)]},
    ]
    if faq_keys: graph.append(faq_ld(faq_keys))
    if extra_ld: graph.append(extra_ld)
    ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False)
    items = more_items or [(p, n, DESC_LINK[p]) for p, n in PAGES if p != path]
    more = ''.join(f'<li><a href="{p}"><b>{n}</b><span>{d}</span></a></li>' for p, n, d in items)
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
  <link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/strane.css?v=2" />
  <script type="application/ld+json">{ld}</script>
</head>
<body>
<header><div class="wrap nav">
  {LOGO}
  <nav class="nav-links" aria-label="Glavni meni">{nav}<a class="btn" href="/#kontakt">Kontakt</a></nav>
</div></header>
<main class="wrap">
  <nav class="crumbs" aria-label="Putanja"><a href="/">FoodAR</a><span>/</span>{(f'<a href="{parent[0]}">{parent[1]}</a><span>/</span>') if parent else ''}{short}</nav>
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

# ================================================================ VODIČ
def article_ld(path, headline, date):
    return {'@type': 'Article', '@id': SITE + path + '#article', 'headline': headline, 'inLanguage': 'sr',
            'datePublished': date, 'dateModified': TODAY, 'image': SITE + '/og-image.jpg',
            'author': {'@id': SITE + '/#org'}, 'publisher': {'@id': SITE + '/#org'},
            'mainEntityOfPage': {'@id': SITE + path + '#page'}}

def more_for(path):
    return [(a[0], a[1], a[2]) for a in ARTICLES if a[0] != path] + [('/ar-meni/', 'AR meni', DESC_LINK['/ar-meni/']), ('/cene/', 'Cene', DESC_LINK['/cene/'])]

VODIC = ('/vodic/', 'Vodič')

page('/vodic/', 'Vodič',
     'Vodič: AR meni, 3D meni i interaktivni meni za restorane | FoodAR',
     'Tekstovi FoodAR-a (Food AR) o AR meniju, interaktivnom 3D meniju i QR kodovima za restorane: kako rade, šta donose i kako izabrati pravo rešenje za Vaš restoran.',
     'Vodič za restorane', 'AR meni · 3D meni · interaktivni meni',
     'Sve o AR meniju, 3D prikazu jela i interaktivnim menijima, jednostavnim jezikom i bez tehničkog žargona.',
     '<ul class="cards">' + ''.join(f'<li><a href="{a[0]}"><b>{a[1]}</b><span>{a[2]}</span></a></li>' for a in ARTICLES) + '</ul>'
     + '<p>FoodAR (piše se i Food AR) je usluga iz Srbije koja jela iz Vašeg restorana snima u 3D i prikazuje ih gostu na stolu, u stvarnoj veličini. Više o usluzi pročitajte na stranicama <a href="/ar-meni/">AR meni</a> i <a href="/3d-prikaz-jela/">3D prikaz jela</a>.</p>',
     more_items=[('/ar-meni/', 'AR meni', DESC_LINK['/ar-meni/']), ('/3d-prikaz-jela/', '3D prikaz jela', DESC_LINK['/3d-prikaz-jela/']), ('/kako-radi/', 'Kako radi', DESC_LINK['/kako-radi/']), ('/cene/', 'Cene', DESC_LINK['/cene/'])],
     extra_ld={'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE + a[0], 'name': a[1]} for i, a in enumerate(ARTICLES)]})

# ---------------------------------------------------------------- 1. Interaktivni meni
P, T, D, DT = ARTICLES[0]
page(P, 'Interaktivni meni', 'Interaktivni meni za restorane: vrste, razlike i šta izabrati | FoodAR',
     'Interaktivni meni za restorane može biti digitalni QR meni, 3D meni ili AR meni. Objašnjavamo razlike, prednosti i kako da izaberete pravo rešenje za Vaš restoran ili kafić.',
     'Interaktivni meni za restorane: vrste i šta izabrati', 'Vodič',
     'Pod „interaktivnim menijem“ restorani misle na različite stvari. Evo po čemu se razlikuju digitalni QR meni, 3D meni i AR meni, i šta kome odgovara.',
     """<h2>Šta je interaktivni meni?</h2>
<p>Interaktivni meni je svaki meni sa kojim gost može nešto da uradi, a ne samo da ga pročita: da otvori jelo, pogleda detalje, promeni jezik ili vidi jelo iz više uglova. Najčešće se otvara na telefonu gosta, preko QR koda na stolu ili na štampanom meniju.</p>
<p>U praksi se pod tim nazivom kriju tri različita rešenja. Razlikuju se po tome šta gost vidi i koliko mu pomažu da odluči šta će poručiti.</p>
<h2>1. Digitalni QR meni</h2>
<p>Gost skenira QR kod na stolu i na telefonu dobija listu jela sa cenama, opisima i ponekad fotografijama. To je u suštini štampani meni prebačen na ekran.</p>
<ul>
<li><b>Dobro je za:</b> brzu promenu cena i ponude bez nove štampe, menije na više jezika.</li>
<li><b>Ograničenje:</b> gost i dalje vidi samo tekst i fotografiju, pa ne zna koliko je porcija velika niti kako jelo izgleda iz drugog ugla.</li>
</ul>
<h2>2. 3D meni</h2>
<p>Umesto fotografije, gost vidi 3D model jela koji okreće prstom i zumira. Jelo vidi sa svih strana, kao da je ispred njega. Dobar 3D meni koristi pravi 3D snimak jela iz Vašeg restorana, a ne nacrtan model.</p>
<ul>
<li><b>Dobro je za:</b> specijalitete, jela koja gosti ne poznaju i jela koja je teško opisati rečima.</li>
<li><b>Ograničenje:</b> na ekranu telefona i dalje je teško proceniti stvarnu veličinu porcije.</li>
</ul>
<h2>3. AR meni</h2>
<p>AR meni (meni sa proširenom stvarnošću) ide korak dalje: isti 3D model se kroz kameru telefona postavlja na sto ispred gosta, u stvarnoj veličini. Gost vidi tanjir pored svoje čaše i pribora i odmah zna koliko je jelo veliko. Više o tome na stranici <a href="/ar-meni/">AR meni za restorane</a>.</p>
<ul>
<li><b>Dobro je za:</b> porcije za više osoba, skuplja jela, nova jela i sve gde gost pita „koliko je to veliko?“.</li>
<li><b>Ograničenje:</b> svako jelo mora da se snimi u 3D, pa ima smisla za izabrana jela, a ne obavezno za ceo meni.</li>
</ul>
<h2>Uporedni pregled</h2>
<div class="tbl"><table>
<thead><tr><th></th><th>Digitalni QR meni</th><th>3D meni</th><th>AR meni</th></tr></thead>
<tbody>
<tr><th scope="row">Šta gost vidi</th><td>Listu jela i fotografije</td><td>3D model jela</td><td>3D jelo na svom stolu</td></tr>
<tr><th scope="row">Veličina porcije</th><td>Ne vidi se</td><td>Delimično</td><td>Stvarna, 1:1</td></tr>
<tr><th scope="row">Pogled sa svih strana</th><td>Ne</td><td>Da</td><td>Da</td></tr>
<tr><th scope="row">Aplikacija</th><td>Nije potrebna</td><td>Nije potrebna</td><td>Nije potrebna</td></tr>
<tr><th scope="row">Najbolje za</th><td>Ceo meni i cene</td><td>Izabrana jela</td><td>Izabrana jela</td></tr>
</tbody></table></div>
<h2>Šta izabrati za Vaš restoran</h2>
<p>Ova rešenja se ne isključuju. Mnogi restorani zadrže štampani ili digitalni meni za kompletnu ponudu, a 3D i AR prikaz dodaju samo za jela koja žele da istaknu.</p>
<ul>
<li>Ako Vam je glavni problem promena cena, dovoljan je digitalni QR meni.</li>
<li>Ako gosti stalno pitaju kako jelo izgleda i koliko je veliko, pravi izbor je AR meni sa 3D prikazom.</li>
<li>Ako želite da prodate više specijaliteta i skupljih jela, gostu je potrebno da ta jela vidi pre porudžbine.</li>
</ul>
<div class="note"><b>Kako to radi FoodAR:</b> ne pravimo digitalni meni. Jela koja izaberete snimamo u 3D, a QR kod stoji pored njih na Vašem postojećem meniju. Gost skenira kod i vidi jelo u 3D i na svom stolu.</div>""",
     faq_keys=['meni', 'app', 'koja', 'cena'], parent=VODIC, nav_path='/vodic/', more_items=more_for(P), extra_ld=article_ld(P, T, DT))

# ---------------------------------------------------------------- 2. Prodaja
P, T, D, DT = ARTICLES[1]
page(P, 'AR meni i prodaja', 'Kako AR meni pomaže restoranu da proda više | FoodAR',
     'Kako AR meni i 3D prikaz jela pomažu restoranu: gost lakše poručuje specijalitete, nova i skuplja jela, konobari štede vreme, a ima manje reklamacija. Praktični saveti za restorane u Srbiji.',
     'Kako AR meni pomaže restoranu da proda više', 'Vodič',
     'Gost poručuje ono što razume. Kada jelo vidi na svom stolu pre porudžbine, lakše se odluči i za ono što ne poznaje.',
     """<h2>Zašto gosti biraju uvek ista jela</h2>
<p>Većina gostiju bira ono što već zna: pljeskavicu, pastu, piletinu. Nije razlog to što ih ostala jela ne zanimaju, već to što ne znaju šta će dobiti. Naziv i spisak sastojaka ne govore koliko je porcija velika, kako jelo izgleda niti da li je dovoljno za dve osobe.</p>
<p>Svaka takva nesigurnost je razlog da gost izabere nešto poznato i jeftinije. AR meni tu nesigurnost uklanja pre nego što gost odluči.</p>
<h2>1. Lakše prodajete specijalitete i nova jela</h2>
<p>Specijalitet kuće je obično jelo na kojem restoran najviše zarađuje i po kojem želi da ga pamte. Kada gost vidi to jelo na svom stolu, sa svih strana i u pravoj veličini, rizik da mu se ne dopadne je manji, pa se lakše odluči da ga proba. Isto važi za nova jela na meniju koja još niko ne poznaje.</p>
<h2>2. Veće porcije i jela za više osoba</h2>
<p>Plate za dvoje, roštilj za društvo i velike pice gosti često ne poručuju jer ne znaju da li će biti dovoljno ili previše. U AR prikazu vide tačnu veličinu, pa mogu da procene da li jedna porcija pokriva celo društvo.</p>
<h2>3. Konobari štede vreme</h2>
<p>„Koliko je velika porcija?“ i „Šta je tačno u tome?“ su pitanja koja konobar čuje desetine puta dnevno. Kada gost to sam pogleda dok čeka, konobar ima više vremena za ostale stolove, posebno u špicu.</p>
<h2>4. Manje razočaranja i reklamacija</h2>
<p>Najčešći razlog nezadovoljstva je razlika između očekivanja i onoga što stigne na sto. Kada je gost jelo već video u stvarnoj veličini, dobija tačno ono što je očekivao. To znači manje vraćenih jela i bolje recenzije.</p>
<h2>5. Besplatna reklama</h2>
<p>Jelo koje se pojavi na stolu kroz kameru telefona je nešto što gosti snimaju i šalju prijateljima ili objavljuju na Instagramu. Za restoran je to reklama koja ne košta ništa.</p>
<h2>Kako da izvučete najviše iz AR menija</h2>
<ol class="steps">
<li><b>Krenite od jela koja želite da prodate</b>Specijaliteti, nova jela i porcije za više osoba donose najviše. Ne morate da prikažete ceo meni.</li>
<li><b>Neka QR kod bude vidljiv</b>Kod treba da stoji tik uz jelo, sa kratkim pozivom tipa „Pogledaj jelo na svom stolu“.</li>
<li><b>Recite konobarima</b>Kada gost pita za veličinu porcije, konobar ga uputi na QR kod. Tako gost isproba prikaz i sledeći put to radi sam.</li>
<li><b>Pokažite to na mrežama</b>Kratak snimak jela na stolu je odličan sadržaj za Instagram i privlači nove goste.</li>
</ol>
<div class="note">FoodAR snima jela koja izaberete i isporučuje gotove QR kodove za Vaš postojeći meni. Pogledajte <a href="/cene/">cene paketa</a> ili isprobajte <a href="/#demo">demo</a>.</div>""",
     faq_keys=['koja', 'kasa', 'demo', 'cena'], parent=VODIC, nav_path='/vodic/', more_items=more_for(P), extra_ld=article_ld(P, T, DT))

# ---------------------------------------------------------------- 3. 3D meni + QR
P, T, D, DT = ARTICLES[2]
page(P, '3D meni sa QR kodom', '3D meni sa QR kodom – jelo na stolu bez aplikacije | FoodAR',
     '3D meni sa QR kodom: gost skenira kod kamerom telefona i vidi 3D jelo, pa ga postavlja na sto u stvarnoj veličini. Bez aplikacije, na iPhone i Android telefonima. Šta restoranu treba da to radi.',
     '3D meni sa QR kodom: jelo na stolu bez aplikacije', 'Vodič',
     'Jedan QR kod pored jela na Vašem meniju dovoljan je da gost vidi to jelo u 3D i na svom stolu. Evo kako to radi i šta Vam je za to potrebno.',
     """<h2>Kako gost koristi 3D meni sa QR kodom</h2>
<ol class="steps">
<li><b>Skenira QR kod</b>Običnom kamerom telefona, sa koda koji stoji pored jela na meniju.</li>
<li><b>Vidi 3D jelo</b>Otvara se stranica jela u browseru. Gost može da ga okreće prstom i zumira.</li>
<li><b>Postavi ga na sto</b>Jednim dodirom pokreće AR prikaz i jelo se pojavi na stolu u stvarnoj veličini.</li>
</ol>
<p>Nema instaliranja aplikacije, pravljenja naloga ni čekanja. Ceo postupak traje nekoliko sekundi.</p>
<h2>Zašto bez aplikacije</h2>
<p>Gost u restoranu neće da preuzima aplikaciju da bi pogledao jedno jelo. Zato 3D meni mora da radi direktno u browseru: u Safariju na iPhone-u i u Chrome-u na Android telefonima. Tako ga koristi svaki gost, a ne samo onaj koji je spreman da instalira nešto novo.</p>
<h2>Na kojim telefonima radi</h2>
<ul>
<li><b>3D prikaz</b> (okretanje i zumiranje) radi na svakom modernom telefonu.</li>
<li><b>Prikaz na stolu (AR)</b> radi na iPhone uređajima u Safariju i na Android telefonima sa Google Play Services for AR, što je većina telefona iz poslednjih nekoliko godina.</li>
<li>Ako gost otvori link iz Instagrama ili Facebooka, dobije uputstvo kako da ga otvori u pravom browseru, gde prikaz na stolu radi.</li>
</ul>
<h2>Šta je restoranu potrebno</h2>
<ul>
<li><b>Izbor jela.</b> Birate jela koja želite da prikažete u 3D, ne mora ceo meni.</li>
<li><b>3D snimak svakog jela.</b> Jelo se snima onako kako ga Vaša kuhinja servira, sa stvarnim dimenzijama, i obrađuje da se brzo učitava na telefonu.</li>
<li><b>QR kod po jelu.</b> Svako jelo ima svoj stalni link i QR kod, kao nalepnicu ili u sledećem izdanju menija.</li>
</ul>
<p>Nije potreban novi meni, nova kasa ni tablet na stolu. Više o tome kako nastaje model pročitajte na stranici <a href="/3d-prikaz-jela/">3D prikaz jela</a>.</p>
<h2>QR kod koji ne zastareva</h2>
<p>Kada promenite izgled jela, ono se ponovo snimi i model se zameni, a link i QR kod ostaju isti. Ne morate ništa da štampate ponovo.</p>
<div class="note">FoodAR radi celu pripremu: snimanje, obradu, hosting i QR kodove spremne za štampu. Pogledajte <a href="/kako-radi/">kako radi</a> ili isprobajte <a href="/#demo">demo jela</a>.</div>""",
     faq_keys=['app', 'telefoni', 'qr_trajan', 'instagram'], parent=VODIC, nav_path='/vodic/', more_items=more_for(P), extra_ld=article_ld(P, T, DT))

print('ok')
