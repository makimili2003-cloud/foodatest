// FoodAR admin: bočni meni i gornja traka za sve stranice panela (uključuje se na kraju <body>).
(function () {
  var path = location.pathname.replace(/index\.html$/, '');
  var I = {
    pregled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></svg>',
    upiti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    pretplate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg>',
    jela: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>',
    sajt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    odjava: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };
  var nav = [['/admin/', 'Pregled', 'pregled'], ['/admin/upiti.html', 'Upiti', 'upiti'], ['/admin/pretplate.html', 'Pretplate', 'pretplate'], ['/admin/jela.html', 'Jela', 'jela']];
  var link = function (n) { return '<a class="sb-i' + (path === n[0] ? ' on' : '') + '" href="' + n[0] + '">' + I[n[2]] + '<span>' + n[1] + '</span></a>'; };

  var sb = document.createElement('aside'); sb.className = 'sb'; sb.setAttribute('aria-label', 'Meni panela');
  sb.innerHTML = '<a class="sb-logo" href="/admin/"><i>AR</i>FoodAR</a>' +
    '<div class="sb-sec">Glavno</div>' + nav.map(link).join('') +
    '<div class="sb-sec">Tim</div><div class="sb-team">' +
    [['ar', 'AR', 'AR (glavni)'], ['milan', 'MI', 'Milan'], ['mateja', 'MA', 'Mateja']].map(function (t) {
      return '<a href="/admin/upiti.html?ko=' + t[0] + '"><span class="av av-' + t[0] + '">' + t[1] + '</span>' + t[2] + '<span class="sb-badge" data-team="' + t[0] + '" hidden></span></a>';
    }).join('') + '</div>' +
    '<div class="sb-foot"><a class="sb-i" href="/" target="_blank" rel="noopener">' + I.sajt + '<span>Sajt foodar.org</span></a>' +
    '<a class="sb-i" href="#" id="sbLogout">' + I.odjava + '<span>Odjava</span></a></div>';

  var tb = document.createElement('div'); tb.className = 'tb';
  tb.innerHTML = '<button class="tb-menu" type="button" aria-label="Meni">' + I.menu + '</button>' +
    '<form class="tb-search" role="search" action="/admin/upiti.html">' + I.search + '<input name="q" type="search" placeholder="Pretraži upite (ime, restoran, telefon)…" aria-label="Pretraga upita" /></form>' +
    '<div class="tb-right"><a class="tb-bell" href="/admin/upiti.html" aria-label="Novi upiti">' + I.bell + '</a>' +
    '<div class="tb-user"><div><small>FoodAR</small><b>Admin</b></div><span class="av av-ar">FA</span></div></div>';

  document.body.classList.add('shell');
  document.body.insertBefore(tb, document.body.firstChild);
  document.body.insertBefore(sb, document.body.firstChild);

  tb.querySelector('.tb-menu').onclick = function () { document.body.classList.toggle('sb-open'); };
  document.addEventListener('click', function (e) { if (document.body.classList.contains('sb-open') && !e.target.closest('.sb, .tb-menu')) document.body.classList.remove('sb-open'); });
  document.getElementById('sbLogout').onclick = function (e) { e.preventDefault(); var b = document.getElementById('logoutBtn'); if (b) b.click(); else location.href = '/admin/'; };

  // Pretraga: na stranici Upiti filtrira odmah, sa drugih stranica otvara Upiti sa upitom
  var q = new URLSearchParams(location.search).get('q'), inp = tb.querySelector('input'), pageQ = document.getElementById('q');
  if (q) { inp.value = q; if (pageQ) pageQ.value = q; }
  if (pageQ) {
    tb.querySelector('form').onsubmit = function (e) { e.preventDefault(); };
    inp.addEventListener('input', function () { pageQ.value = inp.value; pageQ.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  var ko = new URLSearchParams(location.search).get('ko'), who = document.getElementById('who');
  if (ko && who) who.value = ko;

  // redosled ulaska kartica (animacija u shell.css); kartice koje stignu kasnije dobiju sledeći broj
  var ci = 0;
  var stagger = function () { document.querySelectorAll('main .card:not([data-sh])').forEach(function (c) { c.dataset.sh = 1; c.style.setProperty('--i', Math.min(ci++, 12)); }); };
  stagger(); document.addEventListener('DOMContentLoaded', stagger);
  new MutationObserver(function () { stagger(); }).observe(document.body, { subtree: true, childList: true });

  // Broj novih upita (common.js ga postavlja preko updateBadge) prikaži i na zvoncu
  new MutationObserver(function () {
    var b = sb.querySelector('a[href="/admin/upiti.html"] .nbadge');
    tb.querySelector('.tb-bell').classList.toggle('dot', !!b);
  }).observe(sb, { subtree: true, childList: true });
})();
