// Pretplate: čuvaju se u Netlify Blobs (privatno skladište sajta, NE na GitHub-u).
// Online plaćanje (kartica / Apple Pay) kasnije može automatski da upisuje uplate preko
// recordExternalPayment() – vidi netlify/functions/uplata.mjs.
import crypto from 'node:crypto';
import { adminStore } from './store.mjs';

export const DEFAULT_PLANS = {
  Starter: { mesecno: 2490, godisnje: 23880 },
  Pro: { mesecno: 5990, godisnje: 57480 },
  Elite: { mesecno: 11990, godisnje: 115080 }
};
export const METHODS = ['racun', 'gotovina', 'kartica', 'apple-pay', 'google-pay', 'online'];

let store; // podaci učitani za ovaj zahtev

/** Učitaj podatke, izvrši izmenu i sačuvaj (sa dnevnom rezervnom kopijom). */
export async function withData(fn, { write = true } = {}) {
  const blobs = adminStore();
  store = (await blobs.get('pretplate', { type: 'json' })) || { subs: [], payments: [], plans: DEFAULT_PLANS };
  store.plans ||= DEFAULT_PLANS; store.subs ||= []; store.payments ||= [];
  const result = await fn();
  if (write) {
    const day = new Date().toISOString().slice(0, 10);
    const bk = `rezervne-kopije/${day}`;
    if (!(await blobs.getMetadata(bk))) {
      const prev = await blobs.get('pretplate', { type: 'json' });
      if (prev) await blobs.setJSON(bk, prev);
      // čuvaj poslednjih 30 kopija
      const { blobs: list } = await blobs.list({ prefix: 'rezervne-kopije/' });
      for (const x of list.map(x => x.key).sort().slice(0, -30)) await blobs.delete(x);
    }
    await blobs.setJSON('pretplate', store);
  }
  return result;
}
function save() { /* čuva se u withData() */ }

const id = () => crypto.randomUUID().slice(0, 8);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayStr = () => new Date().toISOString().slice(0, 10);

export function addInterval(dateStr, interval, times = 1) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = (interval === 'godisnje' ? 12 : 1) * times;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last)); // 31. jan + 1 mesec = 28/29. feb
  return target.toISOString().slice(0, 10);
}

function clean(input, existing = {}) {
  const s = { ...existing };
  for (const k of ['restoran', 'kontakt', 'email', 'telefon', 'grad', 'napomena']) {
    if (k in input) s[k] = String(input[k] ?? '').trim().slice(0, 200);
  }
  if ('plan' in input) s.plan = String(input.plan).trim().slice(0, 40);
  if ('interval' in input) s.interval = input.interval === 'godisnje' ? 'godisnje' : 'mesecno';
  if ('amount' in input) s.amount = Math.max(0, Math.round(Number(input.amount) || 0));
  if ('startDate' in input && isDate(input.startDate)) s.startDate = input.startDate;
  if ('periodEnd' in input && isDate(input.periodEnd)) s.periodEnd = input.periodEnd;
  if ('cancelAtPeriodEnd' in input) s.cancelAtPeriodEnd = !!input.cancelAtPeriodEnd;
  if (!s.restoran) throw new Error('Upiši naziv restorana.');
  if (!s.plan) throw new Error('Izaberi paket.');
  if (!s.amount) s.amount = store.plans[s.plan]?.[s.interval || 'mesecno'] || 0;
  return s;
}

export function getAll() {
  return { ...store, today: todayStr() };
}
export function rawData() { return store; }

export function createSub(input) {
  const s = clean(input, {
    id: id(), interval: 'mesecno', cancelAtPeriodEnd: false, canceledAt: null,
    source: input.source === 'online' ? 'online' : 'rucno', externalId: input.externalId || null,
    createdAt: new Date().toISOString()
  });
  s.startDate ||= todayStr();
  s.periodEnd ||= s.startDate; // do prve uplate nije plaćeno ni za jedan dan
  store.subs.push(s);
  if (input.firstPayment) {
    recordPayment(s.id, { date: input.firstPayment.date || s.startDate, method: input.firstPayment.method || 'racun', amount: s.amount, note: 'Prva uplata' }, false);
  }
  save();
  return s;
}

export function updateSub(subId, input) {
  const i = store.subs.findIndex(s => s.id === subId);
  if (i < 0) throw new Error('Pretplata nije pronađena.');
  store.subs[i] = clean(input, store.subs[i]);
  if ('cancelAtPeriodEnd' in input) store.subs[i].canceledAt = input.cancelAtPeriodEnd ? new Date().toISOString() : null;
  save();
  return store.subs[i];
}

export function deleteSub(subId) {
  const before = store.subs.length;
  store.subs = store.subs.filter(s => s.id !== subId);
  if (store.subs.length === before) throw new Error('Pretplata nije pronađena.');
  store.payments = store.payments.filter(p => p.subId !== subId);
  save();
}

/** Uplata produžava pretplatu za jedan period (ili više ako je iznos za više perioda). */
export function recordPayment(subId, input, doSave = true) {
  const s = store.subs.find(x => x.id === subId);
  if (!s) throw new Error('Pretplata nije pronađena.');
  const date = isDate(input.date) ? input.date : todayStr();
  const amount = Math.max(0, Math.round(Number(input.amount ?? s.amount) || 0));
  const periods = Math.max(1, Math.min(24, Math.round(Number(input.periods) || 1)));
  // Ako je pretplata davno istekla (više od 31 dan), novi period kreće od dana uplate
  const gapDays = (Date.parse(date) - Date.parse(s.periodEnd)) / 864e5;
  const from = gapDays > 31 ? date : s.periodEnd;
  const to = addInterval(from, s.interval, periods);
  const p = {
    id: id(), subId, date, amount, periods, periodFrom: from, periodTo: to,
    method: METHODS.includes(input.method) ? input.method : 'racun',
    note: String(input.note || '').slice(0, 200),
    source: input.source === 'online' ? 'online' : 'rucno', externalId: input.externalId || null,
    createdAt: new Date().toISOString()
  };
  store.payments.push(p);
  s.periodEnd = to;
  if (s.cancelAtPeriodEnd && input.reactivate !== false) { s.cancelAtPeriodEnd = false; s.canceledAt = null; }
  if (doSave) save();
  return p;
}

/** Brisanje uplate vraća "plaćeno do" na stanje pre nje (ako je to poslednja uplata). */
export function deletePayment(paymentId) {
  const p = store.payments.find(x => x.id === paymentId);
  if (!p) throw new Error('Uplata nije pronađena.');
  const s = store.subs.find(x => x.id === p.subId);
  const later = store.payments.filter(x => x.subId === p.subId && x.periodTo > p.periodTo);
  if (s && !later.length && s.periodEnd === p.periodTo) s.periodEnd = p.periodFrom;
  store.payments = store.payments.filter(x => x.id !== paymentId);
  save();
}

export function setPlans(plans) {
  for (const [name, v] of Object.entries(plans || {})) {
    if (!name.trim()) continue;
    store.plans[name.trim()] = { mesecno: Math.round(Number(v.mesecno) || 0), godisnje: Math.round(Number(v.godisnje) || 0) };
  }
  save();
  return store.plans;
}

/**
 * Za buduće online plaćanje: platni servis (npr. posle Apple Pay uplate na sajtu) javi uplatu,
 * a ovde se pretplata sama napravi ili produži. Isti externalId se ne knjiži dva puta.
 */
export function recordExternalPayment(evt) {
  if (evt.paymentId && store.payments.some(p => p.externalId === evt.paymentId)) return { duplicate: true };
  let s = store.subs.find(x => (evt.customerId && x.externalId === evt.customerId) || (evt.email && x.email && x.email.toLowerCase() === String(evt.email).toLowerCase()));
  if (!s) {
    s = createSub({
      restoran: evt.restoran || evt.email || 'Novi klijent', kontakt: evt.kontakt, email: evt.email, telefon: evt.telefon,
      plan: evt.plan || 'Pro', interval: evt.interval, amount: evt.amount, startDate: (evt.date || todayStr()).slice(0, 10),
      source: 'online', externalId: evt.customerId || null
    });
  }
  const p = recordPayment(s.id, { date: (evt.date || todayStr()).slice(0, 10), amount: evt.amount, method: evt.method || 'online', source: 'online', externalId: evt.paymentId || null, note: 'Automatski (online plaćanje)' });
  return { sub: s, payment: p };
}
