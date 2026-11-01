// Upiti sa kontakt forme sajta: čuvaju se u Netlify Blobs (ključ "upiti") i prikazuju u admin panelu.
import crypto from 'node:crypto';
import { adminStore } from './store.mjs';

export const STATUSES = ['novo', 'u-obradi', 'zavrseno', 'arhiva'];
export const TEAM = ['ar', 'milan', 'mateja'];
const FIELDS = ['ime', 'restoran', 'telefon', 'email', 'grad', 'broj_jela', 'paket', 'poruka'];
const MAX = 3000;

async function load() { return (await adminStore().get('upiti', { type: 'json' })) || []; }
async function save(list) { await adminStore().setJSON('upiti', list.slice(0, MAX)); }

/** Javni upis sa sajta (bez prijave): provera, ograničenje broja upita po IP adresi. */
export async function submit(input, ip) {
  const store = adminStore();
  const key = 'upit-limit/' + crypto.createHash('sha256').update(String(ip || '?')).digest('hex').slice(0, 24);
  const lim = (await store.get(key, { type: 'json' })) || { n: 0, t: Date.now() };
  if (Date.now() - lim.t > 10 * 60e3) { lim.n = 0; lim.t = Date.now(); }
  if (lim.n >= 5) throw Object.assign(new Error('Previše upita za kratko vreme. Pokušajte ponovo za 10 minuta.'), { status: 429 });

  const u = {};
  for (const f of FIELDS) u[f] = String(input?.[f] ?? '').trim().slice(0, f === 'poruka' ? 3000 : 200);
  if (!u.ime && !u.restoran) throw new Error('Upišite ime ili naziv restorana.');
  if (!u.email && !u.telefon) throw new Error('Upišite email ili telefon.');
  if (u.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) throw new Error('Email adresa nije ispravna.');

  const entry = { id: crypto.randomUUID().slice(0, 10), createdAt: new Date().toISOString(), status: 'novo', dodeljeno: '', beleske: [], ...u };
  const list = await load();
  list.unshift(entry);
  await save(list);
  lim.n++; await store.setJSON(key, lim);
  return entry;
}

export async function list() { return load(); }

export async function update(id, patch) {
  const list = await load();
  const u = list.find(x => x.id === id);
  if (!u) throw new Error('Upit nije pronađen.');
  if ('status' in patch && STATUSES.includes(patch.status)) u.status = patch.status;
  if ('dodeljeno' in patch) u.dodeljeno = TEAM.includes(patch.dodeljeno) ? patch.dodeljeno : '';
  if (patch.beleska && String(patch.beleska).trim()) {
    u.beleske = u.beleske || [];
    u.beleske.push({ tekst: String(patch.beleska).trim().slice(0, 1000), ko: TEAM.includes(patch.ko) ? patch.ko : '', at: new Date().toISOString() });
  }
  u.updatedAt = new Date().toISOString();
  await save(list);
  return u;
}

/** Zabeleži poslat odgovor u istoriju upita. */
export async function addReply(id, reply) {
  const list = await load();
  const u = list.find(x => x.id === id);
  if (!u) throw new Error('Upit nije pronađen.');
  u.odgovori = u.odgovori || [];
  u.odgovori.push({ ...reply, at: new Date().toISOString() });
  if (u.status === 'novo') u.status = 'u-obradi';
  u.updatedAt = new Date().toISOString();
  await save(list);
  return u;
}
export async function get(id) { return (await load()).find(x => x.id === id) || null; }

export async function remove(id) {
  const list = await load();
  const next = list.filter(x => x.id !== id);
  if (next.length === list.length) throw new Error('Upit nije pronađen.');
  await save(next);
}
