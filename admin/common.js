// Zajedničko za admin stranice: prijava lozinkom i pozivi ka /api.
const TOKEN_KEY = 'foodar-admin-token';
let token = '';
try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}

const LOGIN_CSS = `
  .lg-wrap { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(60% 50% at 80% 0%, #ffd9cb 0%, transparent 70%), radial-gradient(50% 50% at 0% 100%, #ffe9bf 0%, transparent 70%), #fbf7f1; }
  .lg { width: min(380px, 100%); background: #fff; border: 1px solid #ebe3d8; border-radius: 24px; padding: 30px 26px; box-shadow: 0 30px 70px -30px rgba(60,35,20,.35); text-align: center; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1f1a17; }
  .lg i { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #d9472b; color: #fff; font: 700 15px system-ui; font-style: normal; margin-bottom: 14px; }
  .lg h1 { font: 700 26px Georgia, serif; margin: 0 0 4px; }
  .lg p { margin: 0 0 18px; color: #6a6058; font-size: 14px; }
  .lg input { width: 100%; font-size: 17px; padding: 13px 14px; border: 1.5px solid #ebe3d8; border-radius: 12px; background: #fbf7f1; outline: none; box-sizing: border-box; }
  .lg input:focus { border-color: #d9472b; background: #fff; }
  .lg button { width: 100%; margin-top: 12px; border: 0; border-radius: 999px; padding: 14px; background: #d9472b; color: #fff; font: 600 16px system-ui; cursor: pointer; }
  .lg button:disabled { opacity: .6; }
  .lg .e { margin-top: 12px; color: #a3301a; background: #fbe3dc; border-radius: 10px; padding: 9px 11px; font-size: 14px; display: none; }
`;

function showLogin(message) {
  return new Promise(resolve => {
    if (!document.getElementById('lgStyle')) {
      const st = document.createElement('style'); st.id = 'lgStyle'; st.textContent = LOGIN_CSS; document.head.appendChild(st);
    }
    document.getElementById('lgWrap')?.remove();
    const w = document.createElement('div'); w.className = 'lg-wrap'; w.id = 'lgWrap';
    w.innerHTML = `<form class="lg" autocomplete="on">
      <i>AR</i><h1>FoodAR admin</h1><p>Unesi lozinku za pristup panelu.</p>
      <input type="text" name="username" value="admin" autocomplete="username" hidden />
      <input type="password" name="password" id="lgPass" placeholder="Lozinka" autocomplete="current-password" required />
      <button type="submit" id="lgBtn">Prijavi se</button>
      <div class="e" id="lgErr"></div></form>`;
    document.body.appendChild(w);
    const err = w.querySelector('#lgErr');
    if (message) { err.textContent = message; err.style.display = 'block'; }
    setTimeout(() => w.querySelector('#lgPass').focus(), 50);
    w.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const btn = w.querySelector('#lgBtn'); btn.disabled = true; btn.textContent = 'Proveravam…'; err.style.display = 'none';
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: w.querySelector('#lgPass').value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Greška pri prijavi.');
        token = j.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
        w.remove(); resolve();
      } catch (e2) {
        err.textContent = e2.message; err.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Prijavi se';
      }
    };
  });
}

/** Poziv ka /api; ako sesija istekne, traži lozinku pa ponovi poziv. */
export async function api(method, url, body, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = { Authorization: 'Bearer ' + token };
    let payload = body;
    if (body && !(body instanceof ArrayBuffer) && !(body instanceof Blob) && !ArrayBuffer.isView(body)) {
      headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body);
    }
    const r = await fetch(url, { method, headers, body: payload });
    if (r.status === 401) { await showLogin(attempt ? 'Pogrešna ili istekla prijava.' : ''); continue; }
    if (opts.raw) { if (!r.ok) throw new Error('Greška ' + r.status); return r; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('Greška ' + r.status));
    return j;
  }
  throw new Error('Prijava nije uspela.');
}

/** Proveri prijavu pre prikaza stranice. */
export async function ensureLogin() {
  if (!token) await showLogin();
  return api('GET', '/api/status');
}

export async function logout() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  token = '';
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  location.href = '/admin/';
}
