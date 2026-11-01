// Prijava u admin: lozinka je u Netlify promenljivoj ADMIN_PASSWORD.
// Posle prijave browser dobija potpisan token (važi 30 dana). Promena lozinke odjavljuje sve uređaje.
import crypto from 'node:crypto';

const key = () => {
  const p = process.env.ADMIN_PASSWORD;
  if (!p) return null;
  return crypto.createHash('sha256').update('foodar|' + p + '|' + (process.env.SESSION_SECRET || '')).digest();
};

export function passwordConfigured() { return Boolean(process.env.ADMIN_PASSWORD); }

export function checkPassword(given) {
  const p = process.env.ADMIN_PASSWORD || '';
  if (!p) return false;
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(p).digest();
  return crypto.timingSafeEqual(a, b);
}

// Prijava važi SESSION_MINUTES (podrazumevano 10) od poslednje aktivnosti; svaki poziv API-ja je produžava.
export const SESSION_MS = Math.max(1, Number(process.env.SESSION_MINUTES) || 10) * 60e3;
export function signToken(ttlMs = SESSION_MS) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString('base64url');
  const mac = crypto.createHmac('sha256', key()).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function verifyToken(token) {
  const k = key();
  if (!k || !token) return false;
  const [payload, mac] = String(token).split('.');
  if (!payload || !mac) return false;
  const expected = crypto.createHmac('sha256', k).update(payload).digest('base64url');
  if (expected.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
