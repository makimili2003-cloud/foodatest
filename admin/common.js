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
    const fresh = r.headers.get('X-Session-Token'); // server produžava prijavu pri svakom pozivu
    if (fresh) { token = fresh; lastPing = Date.now(); try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} }
    if (r.status === 401) { await showLogin(attempt ? 'Pogrešna ili istekla prijava.' : 'Prijava je istekla (10 minuta bez aktivnosti). Prijavi se ponovo.'); continue; }
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
  const status = await api('GET', '/api/status');
  startIdleWatch(status.sessionMinutes);
  updateBadge(status.noviUpiti);
  return status;
}

/** Broj novih upita pored "Upiti" u meniju. */
export function updateBadge(n) {
  const a = document.querySelector('.hnav a[href="/admin/upiti.html"]'); if (!a) return;
  a.querySelector('.nbadge')?.remove();
  if (n > 0) a.insertAdjacentHTML('beforeend', `<span class="nbadge">${n}</span>`);
}

export async function logout(reason) {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  token = '';
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  location.href = '/admin/' + (reason ? '?' + reason + '=1' : '');
}

// ---------- automatska odjava posle 10 minuta neaktivnosti ----------
// Aktivnost = klik, kucanje, skrolovanje, dodir, pomeranje miša (deli se između otvorenih tabova).
const ACT_KEY = 'foodar-admin-activity';
let lastLocal = Date.now(), lastPing = Date.now(), idleStarted = false, warnEl = null;
const lastActivity = () => { let v = lastLocal; try { v = Math.max(v, Number(localStorage.getItem(ACT_KEY)) || 0); } catch (e) {} return v; };
function markActive() {
  const now = Date.now();
  if (now - lastLocal < 3000) return;
  lastLocal = now; try { localStorage.setItem(ACT_KEY, String(now)); } catch (e) {}
  hideWarn();
}
function showWarn(sec) {
  if (!warnEl) {
    warnEl = document.createElement('div');
    warnEl.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:200;background:#1f1a17;color:#fff;border-radius:16px;padding:14px 16px;display:flex;gap:14px;align-items:center;box-shadow:0 18px 40px -12px rgba(0,0,0,.5);font:500 14px system-ui,sans-serif;max-width:calc(100% - 24px)';
    warnEl.innerHTML = '<span id="idleTxt"></span><button style="border:0;border-radius:999px;padding:9px 14px;background:#d9472b;color:#fff;font:600 14px system-ui;cursor:pointer;white-space:nowrap">Ostani prijavljen</button>';
    warnEl.querySelector('button').onclick = () => { lastLocal = 0; markActive(); api('POST', '/api/ping').catch(() => {}); };
    document.body.appendChild(warnEl);
  }
  warnEl.querySelector('#idleTxt').textContent = `Zbog neaktivnosti odjava za ${sec} s.`;
}
function hideWarn() { warnEl?.remove(); warnEl = null; }
function startIdleWatch(minutes) {
  if (idleStarted) return; idleStarted = true;
  const IDLE = (Number(minutes) || 10) * 60e3, WARN = 60e3;
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart']) addEventListener(ev, markActive, { passive: true, capture: true });
  const check = () => {
    const idle = Date.now() - lastActivity();
    if (idle >= IDLE) return logout('neaktivnost');
    if (idle >= IDLE - WARN) showWarn(Math.ceil((IDLE - idle) / 1000)); else hideWarn();
    // dok radiš, server-sku prijavu produži najviše jednom u 2 minuta
    if (idle < 60e3 && Date.now() - lastPing > 2 * 60e3) { lastPing = Date.now(); api('POST', '/api/ping').catch(() => {}); }
  };
  setInterval(check, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
