// FoodAR admin API (Netlify Function). Sve rute osim /api/login traže prijavu.
import crypto from 'node:crypto';
import { adminStore } from '../lib/store.mjs';
import { checkPassword, passwordConfigured, signToken, verifyToken } from '../lib/auth.mjs';
import * as gh from '../lib/github.mjs';
import * as netlify from '../lib/netlify-api.mjs';
import * as subs from '../lib/subs.mjs';

const DOMAIN = process.env.DOMAIN || 'foodar.org';
const RESERVED = new Set(['www', 'admin', 'api', 'mail', 'smtp', 'ftp', 'app', 'demo', 'test']);
const validSub = s => /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(String(s || '')) && !RESERVED.has(s);
const dishUrl = sub => `https://${sub}.${DOMAIN}/`;
const COOKIE = 'foodar_admin';
const MAX_PART = 4 * 1024 * 1024;   // jedan deo upload-a
const MAX_FILE = 60 * 1024 * 1024;  // obrađen model

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export default async (req, context) => {
  netlify.setSiteId(context?.site?.id);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const method = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  const store = adminStore();

  try {
    // ---------- prijava ----------
    if (path === '/login' && method === 'POST') {
      if (!passwordConfigured()) throw new HttpError(503, 'Lozinka nije podešena. U Netlify-ju dodaj promenljivu ADMIN_PASSWORD (vidi uputstvo).');
      const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'nepoznat';
      const lockKey = 'prijava/' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
      const lock = (await store.get(lockKey, { type: 'json' })) || { n: 0, t: Date.now() };
      if (Date.now() - lock.t > 15 * 60e3) { lock.n = 0; lock.t = Date.now(); }
      if (lock.n >= 8) throw new HttpError(429, 'Previše pogrešnih pokušaja. Pokušaj ponovo za 15 minuta.');
      const { password } = await body();
      if (!checkPassword(password)) {
        lock.n++; await store.setJSON(lockKey, lock);
        await new Promise(r => setTimeout(r, 600));
        throw new HttpError(401, 'Pogrešna lozinka.');
      }
      await store.delete(lockKey);
      const token = signToken(30);
      // Kolačić štiti i same admin stranice (proverava ga netlify/edge-functions/admin-gate.js)
      return new Response(JSON.stringify({ token }), { headers: {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${30 * 86400}; HttpOnly; Secure; SameSite=Strict`
      } });
    }
    if (path === '/logout' && method === 'POST') {
      return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` } });
    }

    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const cookie = (req.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!verifyToken(bearer) && !verifyToken(cookie)) throw new HttpError(401, 'Prijavi se ponovo.');

    // ---------- status ----------
    if (path === '/dijagnostika' && method === 'GET') {
      return json({ github: await gh.diagnose(), netlifyToken: Boolean(process.env.NETLIFY_TOKEN), siteId: context?.site?.id || null, deployId: process.env.DEPLOY_ID || context?.deploy?.id || null });
    }
    if (path === '/status' && method === 'GET') {
      return json({ domain: DOMAIN, repo: process.env.GITHUB_REPO || 'makimili2003-cloud/foodatest', github: Boolean(process.env.GITHUB_TOKEN), netlify: netlify.netlifyConfigured() });
    }

    // ---------- jela ----------
    if (path === '/dishes' && method === 'GET') {
      const list = await gh.getDishes();
      return json(list.map(d => ({ ...d, url: dishUrl(d.sub) })));
    }
    let m;
    if ((m = path.match(/^\/dishes\/([a-z0-9-]+)$/))) {
      if (method === 'PATCH') { await gh.updateDishMeta(m[1], await body()); return json({ ok: true }); }
      if (method === 'DELETE') {
        await gh.removeDish(m[1]);
        let domain; try { domain = await netlify.removeSubdomain(m[1], DOMAIN); } catch (e) { domain = { status: 'error', error: e.message }; }
        return json({ ok: true, domain });
      }
    }

    // Upload obrađenog modela u delovima (Netlify funkcija prima najviše ~6 MB po zahtevu)
    if (path === '/upload/start' && method === 'POST') {
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');
      // počisti stare nedovršene upload-e (starije od 1 dana)
      const { blobs } = await store.list({ prefix: 'upload/' });
      const old = Date.now() - 864e5;
      for (const b of blobs) { const t = parseInt(b.key.split('/')[1], 36); if (t && t < old) await store.delete(b.key); }
      return json({ id, partSize: MAX_PART });
    }
    if ((m = path.match(/^\/upload\/([a-z0-9-]+)\/(\d{1,3})$/)) && method === 'PUT') {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_PART + 1024) throw new HttpError(413, 'Deo fajla je prevelik.');
      await store.set(`upload/${m[1]}/${m[2].padStart(3, '0')}`, buf);
      return json({ ok: true });
    }
    // Spoji delove i pošalji fajl na GitHub kao blob
    if (path === '/publish/blob' && method === 'POST') {
      const { uploadId, parts } = await body();
      if (!/^[a-z0-9-]+$/.test(String(uploadId)) || !(parts > 0 && parts <= 20)) throw new HttpError(400, 'Neispravan upload.');
      const chunks = [];
      for (let i = 0; i < parts; i++) {
        const c = await store.get(`upload/${uploadId}/${String(i).padStart(3, '0')}`, { type: 'arrayBuffer' });
        if (!c) throw new HttpError(400, 'Deo fajla nedostaje. Pokušaj ponovo.');
        chunks.push(Buffer.from(c));
      }
      const file = Buffer.concat(chunks);
      if (file.length > MAX_FILE) throw new HttpError(413, 'Model je prevelik.');
      const sha = await gh.createBlob(file);
      for (let i = 0; i < parts; i++) await store.delete(`upload/${uploadId}/${String(i).padStart(3, '0')}`);
      return json({ sha, bytes: file.length });
    }
    // Objavi jelo (commit + poddomen)
    if (path === '/publish/commit' && method === 'POST') {
      const { name, sub, desc, realSize, demo, glbSha, usdzSha } = await body();
      if (!name || !String(name).trim()) throw new HttpError(400, 'Upiši naziv jela.');
      if (!validSub(sub)) throw new HttpError(400, 'Poddomen sme da ima samo mala slova, brojeve i crtice (npr. "cevapi").');
      if (!/^[0-9a-f]{40}$/.test(String(glbSha))) throw new HttpError(400, 'Model nije poslat.');
      if (usdzSha && !/^[0-9a-f]{40}$/.test(String(usdzSha))) throw new HttpError(400, 'Neispravan usdz.');
      const result = await gh.publishDish({ sub, name: String(name).trim().slice(0, 60), desc: String(desc || '').trim().slice(0, 160), realSize, demo }, { glbSha, usdzSha });
      let domain;
      try { domain = await netlify.addSubdomain(sub, DOMAIN); } catch (e) { domain = { status: 'error', error: e.message, domain: `${sub}.${DOMAIN}` }; }
      return json({ ...result, url: dishUrl(sub), domain });
    }

    // ---------- pretplate ----------
    if (path === '/pretplate' && method === 'GET') return json(await subs.withData(() => ({ ...subs.getAll(), domain: DOMAIN }), { write: false }));
    if (path === '/pretplate' && method === 'POST') { const b = await body(); return json(await subs.withData(() => subs.createSub(b))); }
    if ((m = path.match(/^\/pretplate\/([a-z0-9-]+)$/))) {
      if (method === 'PATCH') { const b = await body(); return json(await subs.withData(() => subs.updateSub(m[1], b))); }
      if (method === 'DELETE') { await subs.withData(() => subs.deleteSub(m[1])); return json({ ok: true }); }
    }
    if ((m = path.match(/^\/pretplate\/([a-z0-9-]+)\/uplate$/)) && method === 'POST') { const b = await body(); return json(await subs.withData(() => subs.recordPayment(m[1], b))); }
    if ((m = path.match(/^\/uplate\/([a-z0-9-]+)$/)) && method === 'DELETE') { await subs.withData(() => subs.deletePayment(m[1])); return json({ ok: true }); }
    if (path === '/paketi' && method === 'PUT') { const b = await body(); return json(await subs.withData(() => subs.setPlans(b))); }
    if (path === '/rezervna-kopija' && method === 'GET') {
      const data = await subs.withData(() => subs.rawData(), { write: false });
      return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="foodar-pretplate-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
    }

    throw new HttpError(404, 'Nepoznata ruta.');
  } catch (e) {
    const status = e.status || 400;
    if (status >= 500 || !e.status) console.error('admin api:', e.message);
    return json({ error: e.message || 'Greška' }, status);
  }
};

export const config = { path: '/api/*' };
