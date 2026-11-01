// FoodAR admin – lokalni server.
// Pokreni na računaru, a otvori sa telefona na istoj Wi-Fi mreži.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ---- .env (bez dodatnih paketa) ----
const envFile = path.join(DIR, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { optimizeGlb } = await import('./optimize.js');
const gh = await import('./github.js');
const netlify = await import('./netlify.js');
const subs = await import('./subs.js');

const PORT = Number(process.env.PORT) || 3000;
const DOMAIN = process.env.DOMAIN || 'foodar.org';
const PIN = process.env.ADMIN_PIN || '';
const TMP = path.join(DIR, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
subs.initStore(path.join(DIR, 'data'));

const RESERVED = new Set(['www', 'admin', 'api', 'mail', 'smtp', 'ftp', 'app', 'demo', 'test']);
const validSub = s => /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s) && !RESERVED.has(s);
const dishUrl = sub => `https://${sub}.${DOMAIN}/`;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(DIR, 'public')));

// ---- PIN zaštita (da niko drugi na Wi-Fi mreži ne može da objavljuje) ----
function checkPin(req, res, next) {
  if (!PIN) return next();
  const given = String(req.get('x-pin') || req.query.pin || '');
  const a = Buffer.from(given), b = Buffer.from(PIN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Pogrešan PIN.' });
}
app.use('/api', checkPin);
app.use('/preview', checkPin);

const upload = multer({
  dest: TMP,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'glb' && ext !== '.glb') return cb(new Error('3D model mora biti .glb fajl.'));
    if (file.fieldname === 'usdz' && ext !== '.usdz') return cb(new Error('iPhone model mora biti .usdz fajl.'));
    cb(null, true);
  }
});

// Obrađeni modeli koji čekaju objavu (brišu se posle 6 sati)
const jobs = new Map();
setInterval(() => {
  const old = Date.now() - 6 * 3600e3;
  for (const [id, j] of jobs) if (j.created < old) { cleanup(j); jobs.delete(id); }
}, 3600e3).unref();
function cleanup(j) { for (const p of [j.glb, j.usdz]) if (p) fs.rm(p, { force: true }, () => {}); }

const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error('✗', e.message);
  res.status(400).json({ error: e.message });
});

app.get('/api/status', (req, res) => {
  res.json({
    domain: DOMAIN,
    repo: process.env.GITHUB_REPO || 'makimili2003-cloud/foodatest',
    github: Boolean(process.env.GITHUB_TOKEN),
    netlify: netlify.netlifyConfigured()
  });
});

app.get('/api/dishes', wrap(async (req, res) => {
  const list = await gh.getDishes();
  res.json(list.map(d => ({ ...d, url: dishUrl(d.sub) })));
}));

// 1) Upload + obrada
app.post('/api/process', upload.fields([{ name: 'glb', maxCount: 1 }, { name: 'usdz', maxCount: 1 }]), wrap(async (req, res) => {
  const glb = req.files?.glb?.[0];
  const usdz = req.files?.usdz?.[0];
  try {
    if (!glb) throw new Error('Izaberi .glb 3D model.');
    const id = crypto.randomUUID();
    const out = path.join(TMP, id + '.glb');
    console.log(`… obrađujem ${glb.originalname} (${(glb.size / 1048576).toFixed(1)} MB)`);
    const report = await optimizeGlb(glb.path, out, { realWidthCm: req.body.realWidthCm });
    const outSize = fs.statSync(out).size;
    report.before.mb = +(glb.size / 1048576).toFixed(1);
    report.after.mb = +(outSize / 1048576).toFixed(1);
    if (usdz && usdz.size > 25 * 1048576) report.warnings.push(`iPhone model (.usdz) ima ${(usdz.size / 1048576).toFixed(0)} MB, pa će se na iPhone-u sporo učitavati. Možeš ga i izostaviti, jer model-viewer sam napravi verziju za iPhone.`);
    if (usdz && Number(req.body.realWidthCm) > 0) report.warnings.push('Promenio si veličinu modela, a .usdz za iPhone nije promenjen. Bolje izostavi .usdz, pa će se iPhone verzija napraviti automatski iz obrađenog modela.');
    jobs.set(id, { glb: out, usdz: usdz?.path || null, created: Date.now(), name: glb.originalname });
    console.log(`✓ ${glb.originalname}: ${report.before.mb} MB → ${report.after.mb} MB, ${report.after.triangles} trouglova, ${report.size.width}×${report.size.depth}×${report.size.height} cm`);
    res.json({ id, report, preview: `/preview/${id}.glb` });
  } finally {
    fs.rm(glb?.path || '', { force: true }, () => {});
  }
}));

app.get('/preview/:id.glb', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).end();
  res.type('model/gltf-binary').sendFile(j.glb);
});

// 2) Objava: GitHub commit + poddomen na Netlify-ju
app.post('/api/publish', wrap(async (req, res) => {
  const { id, name, sub, desc, realSize, demo } = req.body || {};
  const job = jobs.get(id);
  if (!job) throw new Error('Obrađen model nije pronađen (možda je server restartovan). Uploaduj ga ponovo.');
  if (!name || !String(name).trim()) throw new Error('Upiši naziv jela.');
  if (!validSub(sub)) throw new Error('Poddomen sme da ima samo mala slova, brojeve i crtice (npr. "cevapi" ili "pica-capricciosa").');

  const result = await gh.publishDish({ sub, name: String(name).trim(), desc: String(desc || '').trim(), realSize, demo }, job.glb, job.usdz);
  let domain;
  try { domain = await netlify.addSubdomain(sub, DOMAIN); }
  catch (e) { domain = { status: 'error', error: e.message, domain: `${sub}.${DOMAIN}` }; }
  cleanup(job); jobs.delete(id);
  console.log(`✓ objavljeno: ${name} → ${dishUrl(sub)} (domen: ${domain.status})`);
  res.json({ ...result, url: dishUrl(sub), domain });
}));

app.patch('/api/dishes/:sub', wrap(async (req, res) => {
  await gh.updateDishMeta(req.params.sub, req.body || {});
  res.json({ ok: true });
}));

app.delete('/api/dishes/:sub', wrap(async (req, res) => {
  const sub = req.params.sub;
  await gh.removeDish(sub);
  let domain;
  try { domain = await netlify.removeSubdomain(sub, DOMAIN); } catch (e) { domain = { status: 'error', error: e.message }; }
  res.json({ ok: true, domain });
}));

// QR kod za štampu (PNG ili SVG)
app.get('/api/qr/:sub.:ext(png|svg)', wrap(async (req, res) => {
  const { sub, ext } = req.params;
  if (!validSub(sub) && !/^[a-z0-9-]+$/.test(sub)) throw new Error('Neispravan poddomen.');
  const opts = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#1f1a17', light: '#ffffff' } };
  res.set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="foodar-qr-${sub}.${ext}"`);
  if (ext === 'svg') res.type('image/svg+xml').send(await QRCode.toString(dishUrl(sub), { ...opts, type: 'svg' }));
  else res.type('png').send(await QRCode.toBuffer(dishUrl(sub), { ...opts, width: 1200 }));
}));

// ================= PRETPLATE =================
app.get('/api/pretplate', (req, res) => res.json({ ...subs.getAll(), domain: DOMAIN }));
app.post('/api/pretplate', wrap(async (req, res) => res.json(subs.createSub(req.body || {}))));
app.patch('/api/pretplate/:id', wrap(async (req, res) => res.json(subs.updateSub(req.params.id, req.body || {}))));
app.delete('/api/pretplate/:id', wrap(async (req, res) => { subs.deleteSub(req.params.id); res.json({ ok: true }); }));
app.post('/api/pretplate/:id/uplate', wrap(async (req, res) => res.json(subs.recordPayment(req.params.id, req.body || {}))));
app.delete('/api/uplate/:id', wrap(async (req, res) => { subs.deletePayment(req.params.id); res.json({ ok: true }); }));
app.put('/api/paketi', wrap(async (req, res) => res.json(subs.setPlans(req.body || {}))));

// Za buduće online plaćanje (Apple Pay / kartica na sajtu): platni servis šalje uplatu ovde,
// a pretplata se sama napravi ili produži. Zaštićeno tajnom WEBHOOK_SECRET iz .env.
app.post('/integracije/uplata', wrap(async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET || '';
  const given = String(req.get('x-webhook-secret') || '');
  if (!secret || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return res.status(401).json({ error: 'Neispravna tajna.' });
  }
  res.json(subs.recordExternalPayment(req.body || {}));
}));

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fajl je prevelik (najviše 300 MB).' : err.message });
});

app.listen(PORT, '0.0.0.0', async () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  FoodAR admin radi!\n');
  console.log(`  Na ovom računaru:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  Sa telefona:       http://${ip}:${PORT}   (ista Wi-Fi mreža)`);
  if (ips[0]) {
    console.log('\n  Ili skeniraj telefonom:\n');
    console.log(await QRCode.toString(`http://${ips[0]}:${PORT}`, { type: 'terminal', small: true }));
  }
  if (!PIN) console.log('  ⚠ ADMIN_PIN nije podešen – svako na tvojoj Wi-Fi mreži može da koristi panel.');
  if (!process.env.GITHUB_TOKEN) console.log('  ⚠ GITHUB_TOKEN nije podešen – obrada radi, ali objava neće raditi (vidi README.md).');
  if (!netlify.netlifyConfigured()) console.log('  ℹ Netlify nije podešen – poddomene ćeš dodavati ručno (vidi README.md).');
  console.log('');
});
