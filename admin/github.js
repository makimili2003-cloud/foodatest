// Objava na GitHub: svi fajlovi jednog jela idu u JEDAN commit (Git Data API).
// Netlify posle toga sam objavi sajt.
import fs from 'node:fs/promises';

const API = process.env.GITHUB_API || 'https://api.github.com';

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'makimili2003-cloud/foodatest';
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token) throw new Error('GITHUB_TOKEN nije podešen u .env fajlu.');
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

export async function getDishes() {
  const { branch } = cfg();
  return readDishes(branch);
}

/**
 * Dodaje ili menja jelo.
 * @param {{sub,name,desc,realSize,demo}} dish
 * @param {string} glbPath  obrađen .glb
 * @param {string|null} usdzPath  opcioni .usdz (za iPhone)
 */
export async function publishDish(dish, glbPath, usdzPath) {
  const { commitSha } = await head();
  const list = await readDishes(commitSha);
  const old = list.find(d => d.sub === dish.sub);

  const glbRepoPath = `modeli/${dish.sub}.glb`;
  const usdzRepoPath = usdzPath ? `modeli/${dish.sub}.usdz` : null;
  const entries = [
    { path: glbRepoPath, mode: '100644', type: 'blob', sha: await blob(await fs.readFile(glbPath)) }
  ];
  if (usdzPath) entries.push({ path: usdzRepoPath, mode: '100644', type: 'blob', sha: await blob(await fs.readFile(usdzPath)) });

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
  for (const k of ['name', 'desc', 'realSize', 'demo']) if (k in patch) allowed[k] = patch[k];
  const next = list.map(d => (d.sub === sub ? { ...d, ...allowed } : d));
  await commit(`Izmenjeni podaci jela: ${sub}`, [
    { path: 'dishes.json', mode: '100644', type: 'blob', sha: await blob(dishesJson(next)) }
  ]);
}
