// Za buduće online plaćanje (kartica / Apple Pay / Google Pay na sajtu):
// platni servis javi uplatu na https://foodar.org/integracije/uplata, a pretplata se sama
// napravi ili produži. Zaštićeno tajnom WEBHOOK_SECRET (Netlify promenljiva), zaglavlje X-Webhook-Secret.
import crypto from 'node:crypto';
import * as subs from '../lib/subs.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Samo POST.' }, 405);
  const secret = process.env.WEBHOOK_SECRET || '';
  const given = req.headers.get('x-webhook-secret') || '';
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(secret).digest();
  if (!secret || !crypto.timingSafeEqual(a, b)) return json({ error: 'Neispravna tajna.' }, 401);
  let evt; try { evt = await req.json(); } catch { return json({ error: 'Neispravan JSON.' }, 400); }
  try {
    return json(await subs.withData(() => subs.recordExternalPayment(evt)));
  } catch (e) {
    return json({ error: e.message }, 400);
  }
};

export const config = { path: '/integracije/uplata' };
