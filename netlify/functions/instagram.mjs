// Webhook za Instagram poruke: https://foodar.org/integracije/instagram
import crypto from 'node:crypto';
import { enabled, enqueueIgEvents, verifyIgSignature } from '../lib/agent.mjs';

const same = (a, b) => {
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};

export default async req => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const token = (process.env.INSTAGRAM_VERIFY_TOKEN || '').trim();
    const ok = token && url.searchParams.get('hub.mode') === 'subscribe' && same(url.searchParams.get('hub.verify_token') || '', token);
    const challenge = url.searchParams.get('hub.challenge') || '';
    if (!ok || !/^[\w-]{1,200}$/.test(challenge)) return new Response('Zabranjeno', { status: 403 });
    return new Response(challenge, { headers: { 'Content-Type': 'text/plain' } });
  }
  if (req.method !== 'POST') return new Response('Dozvoljen je POST.', { status: 405 });
  const raw = await req.text();
  if (!verifyIgSignature(raw, req.headers.get('x-hub-signature-256'))) return new Response('Neispravan potpis.', { status: 401 });
  if (enabled()) {
    try { await enqueueIgEvents(JSON.parse(raw)); }
    catch (e) { console.error('instagram webhook:', e.message); return new Response('Greška', { status: 500 }); }
  }
  return new Response('OK');
};

export const config = { path: '/integracije/instagram' };
