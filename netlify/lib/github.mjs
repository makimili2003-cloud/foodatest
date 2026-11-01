// Objava na GitHub: svi fajlovi jednog jela idu u JEDAN commit (Git Data API).
// Netlify posle toga sam objavi sajt. Token je u Netlify promenljivoj GITHUB_TOKEN.

const API = process.env.GITHUB_API || 'https://api.github.com';

function cfg() {
  // trim: često se pri kopiranju zalepi razmak ili novi red
  const token = (process.env.GITHUB_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  const repo = process.env.GITHUB_REPO || 'makimili2003-cloud/foodatest';
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token) throw new Error('GITHUB_TOKEN nije podešen u Netlify-ju (Site configuration → Environment variables).');
  return { token, repo, branch };
}

async function gh(method, path, body) {
  const { token, repo } = cfg();
  const res = await fetch(`${API}/repos/${repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'foodar-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    let hint = '';
    if (res.status === 401) hint = ' (GitHub token je neispravan ili istekao)';
    if (res.status === 403 || res.status === 404) hint = ' (proveri da token ima pristup repou i dozvolu "Contents: Read and write")';
    throw new Error(`GitHub ${method} ${path}: ${res.status}${hint} ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function head() {
  const { branch } = cfg();
  const ref = await gh('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await gh('GET', `/git/commits/${ref.object.sha}`);
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
}

async function readDishes(ref) {
  try {
    const file = await gh('GET', `/contents/dishes.json?ref=${ref}`);
    return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  } catch (e) {
    if (String(e.message).includes(': 404')) return [];
    throw e;
  }
}

export async function createBlob(buffer) { return blob(buffer); }

async function blob(buffer) {
  const r = await gh('POST', '/git/blobs', { content: buffer.toString('base64'), encoding: 'base64' });
  return r.sha;
}

async function commit(message, entries) {
  const { branch } = cfg();
  const { commitSha, treeSha } = await head();
  const tree = await gh('POST', '/git/trees', { base_tree: treeSha, tree: entries });
  const c = await gh('POST', '/git/commits', { message, tree: tree.sha, parents: [commitSha] });
  await gh('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.sha });
  return c.sha;
}

function dishesJson(list) {
  return Buffer.from(JSON.stringify(list, null, 2) + '\n', 'utf8');
}

/** Dijagnostika: koji token je učitan i šta GitHub kaže da sme. */
export async function diagnose() {
  try { return await diagnoseInner(); } catch (e) { return { tokenSet: Boolean(process.env.GITHUB_TOKEN), networkError: e.message, user: 'greška mreže', writeTest: 'greška mreže' }; }
}
async function diagnoseInner() {
  const raw = process.env.GITHUB_TOKEN || '';
  const out = { tokenSet: Boolean(raw) };
  if (!raw) return out;
  const { token, repo, branch } = cfg();
  out.repo = repo; out.branch = branch;
  out.tokenType = token.startsWith('github_pat_') ? 'fine-grained (github_pat_)' : token.startsWith('ghp_') ? 'classic (ghp_)' : 'nepoznat tip';
  out.tokenHint = token.slice(0, 11) + '…' + token.slice(-4);
  out.hadWhitespace = raw !== token;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'foodar-admin' };
  const u = await fetch(`${API}/user`, { headers: h });
  out.user = u.ok ? (await u.json()).login : `greška ${u.status}`;
  out.classicScopes = u.headers.get('x-oauth-scopes');
  out.tokenExpires = u.headers.get('github-authentication-token-expiration');
  const r = await fetch(`${API}/repos/${repo}`, { headers: h });
  if (r.ok) { const j = await r.json(); out.repoFound = true; out.canWrite = Boolean(j.permissions?.push); out.permissions = j.permissions; out.defaultBranch = j.default_branch; }
  else { out.repoFound = false; out.repoError = r.status; }
  // Proba upisa: napravi mali blob (ne menja repo dok se ne napravi commit)
  const b = await fetch(`${API}/repos/${repo}/git/blobs`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'foodar-test', encoding: 'utf-8' }) });
  out.writeTest = b.ok ? 'OK' : `greška ${b.status}`;
  out.acceptedPermissions = b.headers.get('x-accepted-github-permissions');
  return out;
}

export async function getDishes() {
  const { branch } = cfg();
  return readDishes(branch);
}

/**
 * Dodaje ili menja jelo. Fajlovi su već poslati kao GitHub blob-ovi (createBlob).
 * @param {{sub,name,desc,realSize,demo}} dish
 * @param {{ glbSha: string, usdzSha?: string }} files
 */
export async function publishDish(dish, { glbSha, usdzSha }) {
  const { commitSha } = await head();
  const list = await readDishes(commitSha);
  const old = list.find(d => d.sub === dish.sub);

  const glbRepoPath = `modeli/${dish.sub}.glb`;
  const usdzRepoPath = usdzSha ? `modeli/${dish.sub}.usdz` : null;
  const entries = [{ path: glbRepoPath, mode: '100644', type: 'blob', sha: glbSha }];
  if (usdzSha) entries.push({ path: usdzRepoPath, mode: '100644', type: 'blob', sha: usdzSha });

  const entry = {
    sub: dish.sub,
    name: dish.name,
    desc: dish.desc || '',
    glb: glbRepoPath,
    // bez usdz-a model-viewer sam pravi model za iPhone iz glb-a
    ...(usdzRepoPath ? { usdz: usdzRepoPath } : {}),
    realSize: !!dish.realSize,
    demo: !!dish.demo
  };
  // Stari usdz istog jela više ne odgovara novom modelu -> obriši ga
  if (old?.usdz && old.usdz !== usdzRepoPath && old.usdz.startsWith('modeli/')) {
    entries.push({ path: old.usdz, mode: '100644', type: 'blob', sha: null });
  }
  const next = old ? list.map(d => (d.sub === dish.sub ? entry : d)) : [...list, entry];
  entries.push({ path: 'dishes.json', mode: '100644', type: 'blob', sha: await blob(dishesJson(next)) });

  const sha = await commit(`${old ? 'Izmenjeno' : 'Dodato'} jelo: ${dish.name} (${dish.sub})`, entries);
  return { commit: sha, replaced: !!old };
}

export async function removeDish(sub) {
  const { commitSha } = await head();
  const list = await readDishes(commitSha);
  const old = list.find(d => d.sub === sub);
  if (!old) throw new Error('Jelo ne postoji.');
  const entries = [];
  // Brišemo samo fajlove koje je napravio admin panel (u folderu modeli/)
  for (const p of [old.glb, old.usdz]) {
    if (p && p.startsWith('modeli/')) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
  }
  entries.push({ path: 'dishes.json', mode: '100644', type: 'blob', sha: await blob(dishesJson(list.filter(d => d.sub !== sub))) });
  await commit(`Uklonjeno jelo: ${old.name} (${sub})`, entries);
  return old;
}

export async function updateDishMeta(sub, patch) {
  const { commitSha } = await head();
  const list = await readDishes(commitSha);
  const old = list.find(d => d.sub === sub);
  if (!old) throw new Error('Jelo ne postoji.');
  const allowed = {};
  for (const k of ['name', 'desc', 'realSize', 'demo', 'hidden']) if (k in patch) allowed[k] = k === 'hidden' || k === 'demo' || k === 'realSize' ? Boolean(patch[k]) : patch[k];
  const next = list.map(d => (d.sub === sub ? { ...d, ...allowed } : d));
  await commit(`Izmenjeni podaci jela: ${sub}`, [
    { path: 'dishes.json', mode: '100644', type: 'blob', sha: await blob(dishesJson(next)) }
  ]);
}
