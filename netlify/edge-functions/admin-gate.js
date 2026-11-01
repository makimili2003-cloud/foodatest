// Čuvar admin panela: svaka stranica i fajl pod /admin traži prijavu lozinkom.
// Bez važećeg kolačića (postavlja ga /api/login) Netlify vraća samo stranicu za prijavu,
// pa se ni kod panela ne vidi. Lozinka je u Netlify promenljivoj ADMIN_PASSWORD.
const COOKIE = 'foodar_admin';
const enc = new TextEncoder();

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function validToken(token, password, extra) {
  if (!token || !password) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const rawKey = await crypto.subtle.digest('SHA-256', enc.encode('foodar|' + password + '|' + (extra || '')));
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  if (expected.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  if (diff) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).exp > Date.now();
  } catch { return false; }
}

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="sr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" /><meta name="theme-color" content="#1f1a17" /><title>FoodAR admin – prijava</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1f1a17;
    background: radial-gradient(60% 50% at 80% 0%, #ffd9cb 0%, transparent 70%), radial-gradient(50% 50% at 0% 100%, #ffe9bf 0%, transparent 70%), #fbf7f1; }
  form { width: min(380px, 100%); background: #fff; border: 1px solid #ebe3d8; border-radius: 24px; padding: 30px 26px; box-shadow: 0 30px 70px -30px rgba(60,35,20,.35); text-align: center; animation: in .5s cubic-bezier(.2,.8,.2,1); }
  @keyframes in { from { opacity: 0; transform: translateY(12px); } }
  i { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #d9472b; color: #fff; font: 700 15px system-ui; font-style: normal; margin-bottom: 14px; }
  h1 { font: 700 26px Georgia, serif; margin: 0 0 4px; }
  p { margin: 0 0 18px; color: #6a6058; font-size: 14px; }
  input { width: 100%; font-size: 17px; padding: 13px 14px; border: 1.5px solid #ebe3d8; border-radius: 12px; background: #fbf7f1; outline: none; }
  input:focus { border-color: #d9472b; background: #fff; }
  button { width: 100%; margin-top: 12px; border: 0; border-radius: 999px; padding: 14px; background: #d9472b; color: #fff; font: 600 16px system-ui; cursor: pointer; }
  button:disabled { opacity: .6; }
  .n { display: none; margin: -6px 0 16px; background: #fff1d1; color: #8a5a00; border-radius: 10px; padding: 9px 11px; font-size: 14px; }
  .e { margin-top: 12px; color: #a3301a; background: #fbe3dc; border-radius: 10px; padding: 9px 11px; font-size: 14px; display: none; }
</style></head>
<body>
<form id="f" autocomplete="on">
  <i>AR</i><h1>FoodAR admin</h1><p>Unesi lozinku za pristup panelu.</p>
  <div class="n" id="n">Odjavljen si posle 10 minuta neaktivnosti. Prijavi se ponovo.</div>
  <input type="text" name="username" value="admin" autocomplete="username" hidden />
  <input type="password" id="p" placeholder="Lozinka" autocomplete="current-password" required autofocus />
  <button id="b">Prijavi se</button>
  <div class="e" id="e"></div>
</form>
<script>
  if (/[?&]neaktivnost=1/.test(location.search)) document.getElementById('n').style.display = 'block';
  document.getElementById('f').onsubmit = async function (ev) {
    ev.preventDefault();
    var b = document.getElementById('b'), e = document.getElementById('e');
    b.disabled = true; b.textContent = 'Proveravam…'; e.style.display = 'none';
    try {
      var r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('p').value }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'Greška pri prijavi.');
      try { localStorage.setItem('foodar-admin-token', j.token); } catch (x) {}
      location.href = location.pathname;
    } catch (x) {
      e.textContent = x.message; e.style.display = 'block'; b.disabled = false; b.textContent = 'Prijavi se';
    }
  };
</script>
</body></html>`;

export default async (request, context) => {
  const env = (k) => (globalThis.Netlify?.env?.get(k)) ?? undefined;
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (await validToken(cookie, env('ADMIN_PASSWORD'), env('SESSION_SECRET'))) return context.next();
  const url = new URL(request.url);
  // Fajlovi (js, slike…) bez prijave samo 401; stranice dobijaju formu za prijavu
  if (/\.(js|mjs|json|css|png|svg|glb|map)$/i.test(url.pathname)) return new Response('Potrebna je prijava.', { status: 401 });
  return new Response(LOGIN_PAGE, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
};

export const config = { path: ['/admin', '/admin/*'] };
