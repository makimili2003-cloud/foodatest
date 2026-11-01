// Admin: dodavanje jela. Model se obrađuje u browseru, šalje u delovima na Netlify, pa objavljuje na GitHub.
import { api, ensureLogin, logout } from './common.js';
import { optimizeGlb } from './vendor/optimize.js';

const $ = id => document.getElementById(id);
let STATUS = {}, DISHES = [], JOB = null; // JOB = { glb: Uint8Array, usdz: File|null, report, url }

const fmt = n => n.toLocaleString('sr-RS');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dishUrl = sub => `https://${sub}.${STATUS.domain || 'foodar.org'}/`;

// ---------- QR kodovi (prave se u browseru) ----------
function qrMatrix(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
function qrSvg(text) {
  const q = qrMatrix(text), n = q.getModuleCount(), m = 2, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#1f1a17"/></svg>`;
}
function qrPngUrl(text, px = 1200) {
  const q = qrMatrix(text), n = q.getModuleCount(), m = 2, cell = Math.floor(px / (n + m * 2)), size = cell * (n + m * 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#1f1a17';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  return c.toDataURL('image/png');
}
const svgUrl = text => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(text));
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

// ---------- start ----------
async function start() {
  STATUS = await ensureLogin();
  $('app').classList.remove('hidden');
  $('domainSuffix').textContent = '.' + STATUS.domain;
  $('cfg').innerHTML =
    `<span class="${STATUS.github ? '' : 'off'}">GitHub ${STATUS.github ? 'povezan' : 'NIJE povezan'}</span>` +
    `<span class="${STATUS.netlify ? '' : 'off'}">Netlify domeni ${STATUS.netlify ? 'automatski' : 'ručno'}</span>`;
  try { DISHES = await api('GET', '/api/dishes'); } catch (e) { $('listStatus').textContent = e.message; }
  renderList();
}
$('logoutBtn').onclick = e => { e.preventDefault(); logout(); };

// ---------- tabovi ----------
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('tab-new').classList.toggle('hidden', b.dataset.tab !== 'new');
  $('tab-list').classList.toggle('hidden', b.dataset.tab !== 'list');
  if (b.dataset.tab === 'list') loadList();
});

// ---------- korak 1: izbor i obrada ----------
$('glbFile').onchange = () => {
  const f = $('glbFile').files[0];
  $('glbName').textContent = f ? `${f.name} (${(f.size / 1048576).toFixed(1)} MB)` : 'Izaberi .glb model';
  $('glbDrop').classList.toggle('has', !!f);
  $('processBtn').disabled = !f;
};
$('usdzFile').onchange = () => {
  const f = $('usdzFile').files[0];
  $('usdzName').textContent = f ? `${f.name} (${(f.size / 1048576).toFixed(1)} MB)` : '+ .usdz za iPhone (opciono)';
  $('usdzDrop').classList.toggle('has', !!f);
};
function setProgress(el, pct, busy) {
  el.classList.remove('hidden'); el.classList.toggle('busy', !!busy);
  el.querySelector('i').style.width = (pct || 0) + '%';
}

$('processBtn').onclick = async () => {
  const f = $('glbFile').files[0]; if (!f) return;
  if (!f.name.toLowerCase().endsWith('.glb')) { $('procStatus').innerHTML = '<div class="note err">3D model mora biti .glb fajl.</div>'; return; }
  $('processBtn').disabled = true; setProgress($('prog'), 100, true);
  try {
    const input = new Uint8Array(await f.arrayBuffer());
    const { glb, report } = await optimizeGlb(input, { realWidthCm: Number($('realWidth').value) || 0, onStep: t => $('procStatus').textContent = t });
    report.before.mb = +(f.size / 1048576).toFixed(1);
    report.after.mb = +(glb.length / 1048576).toFixed(1);
    const usdz = $('usdzFile').files[0] || null;
    if (usdz && usdz.size > 25 * 1048576) report.warnings.push(`iPhone model (.usdz) ima ${(usdz.size / 1048576).toFixed(0)} MB, pa će se na iPhone-u sporo učitavati. Možeš ga i izostaviti, jer model-viewer sam napravi verziju za iPhone.`);
    if (usdz && Number($('realWidth').value) > 0) report.warnings.push('Promenio si veličinu modela, a .usdz za iPhone nije promenjen. Bolje izostavi .usdz, pa će se iPhone verzija napraviti automatski.');
    if (JOB?.url) URL.revokeObjectURL(JOB.url);
    JOB = { glb, usdz, report, url: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })) };
    $('procStatus').textContent = '';
    showStep2();
  } catch (e) {
    $('procStatus').innerHTML = `<div class="note err">${esc(e.message || 'Greška pri obradi modela.')}</div>`;
  } finally {
    $('processBtn').disabled = false; $('prog').classList.add('hidden');
  }
};

function showStep2() {
  const r = JOB.report;
  $('preview').src = JOB.url;
  $('stats').innerHTML =
    `<div><b>${r.before.mb} → ${r.after.mb} MB</b><small>veličina fajla</small></div>` +
    `<div><b>${fmt(r.after.triangles)}</b><small>trouglova${r.before.triangles !== r.after.triangles ? ' (bilo ' + fmt(r.before.triangles) + ')' : ''}</small></div>` +
    `<div><b>${r.size.width} cm</b><small>širina jela</small></div>`;
  $('notes').innerHTML =
    `<div class="note ok">Teksture: ${esc(r.before.textures.join(', ') || '–')} → ${esc(r.after.textures.join(', ') || '–')}${r.normalsAdded ? ' · dodate glatke normale' : ''}${r.scale !== 1 ? ' · veličina podešena na ' + r.size.width + ' cm' : ''}</div>` +
    r.warnings.map(w => `<div class="note warn">${esc(w)}</div>`).join('');
  $('step1').classList.add('hidden'); $('step2').classList.remove('hidden'); $('step3').classList.add('hidden');
  scrollTo({ top: 0, behavior: 'smooth' });
}

// naziv -> poddomen (ć/č→c, š→s, ž→z, đ→dj)
let subTouched = false;
const slug = s => s.toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
$('dishName').oninput = () => { if (!subTouched) { $('dishSub').value = slug($('dishName').value); checkSub(); } };
$('dishSub').oninput = () => { subTouched = true; $('dishSub').value = $('dishSub').value.toLowerCase().replace(/[^a-z0-9-]/g, ''); checkSub(); };
function checkSub() {
  const s = $('dishSub').value, ex = DISHES.find(d => d.sub === s);
  $('subExists').classList.toggle('hidden', !ex);
  if (ex) $('subExists').textContent = `Jelo „${ex.name}“ već koristi ovu adresu. Objavom ćeš ga zameniti novim modelom (QR kod ostaje isti).`;
}

// ---------- korak 2: slanje i objava ----------
async function uploadFile(bytes, label) {
  const { id, partSize } = await api('POST', '/api/upload/start');
  const parts = Math.ceil(bytes.length / partSize) || 1;
  for (let i = 0; i < parts; i++) {
    $('pubStatus').textContent = `Šaljem ${label}… ${Math.round(i / parts * 100)}%`;
    setProgress($('prog2'), Math.round(i / parts * 90));
    const chunk = bytes.slice(i * partSize, (i + 1) * partSize);
    await api('PUT', `/api/upload/${id}/${i}`, chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
  }
  $('pubStatus').textContent = `Šaljem ${label} na GitHub…`;
  setProgress($('prog2'), 95, true);
  const { sha } = await api('POST', '/api/publish/blob', { uploadId: id, parts });
  return sha;
}

$('publishBtn').onclick = async () => {
  if (!JOB) return;
  const body = { name: $('dishName').value, sub: $('dishSub').value, desc: $('dishDesc').value, realSize: $('realSize').checked, demo: $('demo').checked };
  if (!body.name.trim()) { $('pubStatus').innerHTML = '<div class="note err">Upiši naziv jela.</div>'; return; }
  if (!body.sub) { $('pubStatus').innerHTML = '<div class="note err">Upiši adresu jela.</div>'; return; }
  $('publishBtn').disabled = true; $('restartBtn').disabled = true;
  try {
    body.glbSha = await uploadFile(JOB.glb, 'model');
    if (JOB.usdz) body.usdzSha = await uploadFile(new Uint8Array(await JOB.usdz.arrayBuffer()), 'iPhone model');
    $('pubStatus').textContent = 'Objavljujem i podešavam domen…';
    const r = await api('POST', '/api/publish/commit', body);
    showDone(r, body);
  } catch (e) {
    $('pubStatus').innerHTML = `<div class="note err">${esc(e.message)}</div>`;
  } finally {
    $('publishBtn').disabled = false; $('restartBtn').disabled = false; $('prog2').classList.add('hidden');
  }
};

function domainNote(d) {
  if (!d) return '';
  if (d.status === 'added') return `<div class="note ok">Domen ${esc(d.domain)} je dodat na Netlify. HTTPS sertifikat stiže za nekoliko minuta.</div>`;
  if (d.status === 'exists' || d.status === 'wildcard') return `<div class="note ok">Domen ${esc(d.domain)} već radi.</div>`;
  if (d.status === 'skipped') return `<div class="note warn">Netlify token nije podešen: dodaj ${esc(d.domain)} ručno (Netlify → Domain management → Add domain alias).</div>`;
  if (d.status === 'error') return `<div class="note warn">Domen nije dodat automatski (${esc(d.error)}). Dodaj ${esc(d.domain)} ručno u Netlify → Domain management.</div>`;
  return '';
}
function showDone(r, body) {
  $('step2').classList.add('hidden'); $('step3').classList.remove('hidden');
  $('pubStatus').textContent = '';
  $('doneLink').href = r.url; $('doneLink').textContent = r.url;
  $('doneQr').src = svgUrl(r.url);
  $('dlPng').onclick = e => { e.preventDefault(); download(qrPngUrl(r.url), `foodar-qr-${body.sub}.png`); };
  $('dlSvg').onclick = e => { e.preventDefault(); download(svgUrl(r.url), `foodar-qr-${body.sub}.svg`); };
  $('doneNotes').innerHTML = (r.replaced ? '<div class="note ok">Postojeće jelo je zamenjeno novim modelom.</div>' : '') + domainNote(r.domain);
  api('GET', '/api/dishes').then(d => DISHES = d).catch(() => {});
  scrollTo({ top: 0, behavior: 'smooth' });
}

function reset() {
  if (JOB?.url) URL.revokeObjectURL(JOB.url);
  JOB = null; subTouched = false;
  ['glbFile', 'usdzFile', 'realWidth', 'dishName', 'dishSub', 'dishDesc'].forEach(id => $(id).value = '');
  $('glbFile').onchange(); $('usdzFile').onchange();
  $('realSize').checked = true; $('demo').checked = false;
  $('procStatus').textContent = ''; $('pubStatus').textContent = ''; $('subExists').classList.add('hidden');
  $('step1').classList.remove('hidden'); $('step2').classList.add('hidden'); $('step3').classList.add('hidden');
}
$('restartBtn').onclick = reset; $('againBtn').onclick = reset;

// ---------- sva jela ----------
async function loadList() {
  $('listStatus').textContent = 'Učitavam…';
  try { DISHES = await api('GET', '/api/dishes'); renderList(); }
  catch (e) { $('listStatus').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
}
function renderList() {
  $('listStatus').textContent = DISHES.length ? `${DISHES.length} jela na sajtu` : 'Još nema jela.';
  $('list').innerHTML = DISHES.map(d => `
    <div class="dish">
      <img src="${svgUrl(d.url)}" alt="QR" loading="lazy" />
      <div>
        <h3>${esc(d.name)}</h3>
        <a href="${d.url}" target="_blank" rel="noopener">${d.url.replace('https://', '').replace(/\/$/, '')}</a>
        <div class="tags"><span class="tag ${d.realSize ? 'on' : ''}">${d.realSize ? 'stvarna veličina' : 'slobodna veličina'}</span><span class="tag ${d.demo ? 'on' : ''}">${d.demo ? 'u demou' : 'nije u demou'}</span></div>
      </div>
      <div class="btns">
        <button class="btn btn-ghost btn-sm" data-png="${d.sub}">QR PNG</button>
        <button class="btn btn-ghost btn-sm" data-svg="${d.sub}">QR SVG</button>
        <button class="btn btn-ghost btn-sm" data-demo="${d.sub}">${d.demo ? 'Skloni iz demoa' : 'Stavi u demo'}</button>
        <button class="btn btn-danger btn-sm" data-del="${d.sub}">Obriši</button>
      </div>
    </div>`).join('');
}
$('list').onclick = async e => {
  const t = e.target.closest('button'); if (!t) return;
  const { del, demo, png, svg } = t.dataset;
  if (png) return download(qrPngUrl(dishUrl(png)), `foodar-qr-${png}.png`);
  if (svg) return download(svgUrl(dishUrl(svg)), `foodar-qr-${svg}.svg`);
  if (del) {
    const d = DISHES.find(x => x.sub === del);
    if (!confirm(`Obrisati „${d.name}“? QR kod za ${del}.${STATUS.domain} prestaje da radi.`)) return;
    t.disabled = true;
    try { await api('DELETE', '/api/dishes/' + del); await loadList(); } catch (err) { alert(err.message); t.disabled = false; }
  }
  if (demo) {
    const d = DISHES.find(x => x.sub === demo);
    t.disabled = true;
    try { await api('PATCH', '/api/dishes/' + demo, { demo: !d.demo }); await loadList(); } catch (err) { alert(err.message); t.disabled = false; }
  }
};

start().catch(e => { document.body.insertAdjacentHTML('beforeend', `<p style="padding:20px;color:#a3301a">${esc(e.message)}</p>`); });
