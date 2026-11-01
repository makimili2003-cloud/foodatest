// Poddomeni (npr. pizza.foodar.org) se dodaju kao "domain alias" Netlify sajta.
// Ako je domen na Netlify DNS-u, Netlify sam napravi DNS zapis i SSL sertifikat.
const API = process.env.NETLIFY_API || 'https://api.netlify.com/api/v1';

// ID sajta: Netlify ga sam prosleđuje funkciji (context.site.id); može i NETLIFY_SITE_ID.
let SITE_ID = process.env.NETLIFY_SITE_ID || '';
export function setSiteId(id) { if (id && !process.env.NETLIFY_SITE_ID) SITE_ID = id; }

export function netlifyConfigured() {
  return Boolean(process.env.NETLIFY_TOKEN && SITE_ID);
}

async function nf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${(process.env.NETLIFY_TOKEN || '').trim()}`,
      'User-Agent': 'foodar-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const hint = res.status === 401 ? ' (Netlify token je neispravan)' : res.status === 404 ? ' (proveri NETLIFY_SITE_ID)' : '';
    throw new Error(`Netlify ${res.status}${hint}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

const siteId = () => encodeURIComponent(SITE_ID);

/** Dodaje sub.domen; vraća { status: 'added' | 'exists' | 'wildcard' | 'skipped', domain } */
export async function addSubdomain(sub, domain) {
  const host = `${sub}.${domain}`;
  if (!netlifyConfigured()) return { status: 'skipped', domain: host };
  const site = await nf('GET', `/sites/${siteId()}`);
  const aliases = site.domain_aliases || [];
  if (aliases.includes(`*.${domain}`)) return { status: 'wildcard', domain: host };
  if (aliases.includes(host) || site.custom_domain === host) return { status: 'exists', domain: host };
  await nf('PATCH', `/sites/${siteId()}`, { domain_aliases: [...aliases, host] });
  return { status: 'added', domain: host };
}

/** Stanje domena sajta: aliasi i za koje domene već postoji HTTPS sertifikat. */
export async function domainStatus(domain) {
  if (!netlifyConfigured()) return { configured: false };
  const site = await nf('GET', `/sites/${siteId()}`);
  let ssl = null;
  try { const c = await nf('GET', `/sites/${siteId()}/ssl`); ssl = { state: c.state, domains: c.domains || [] }; } catch { /* nije kritično */ }
  const aliases = site.domain_aliases || [];
  return { configured: true, site: site.name, customDomain: site.custom_domain, aliases, wildcard: aliases.includes(`*.${domain}`), ssl };
}

/** Doda domene svim jelima kojima fale (jedan poziv ka Netlify-ju). */
export async function syncSubdomains(subs, domain) {
  if (!netlifyConfigured()) return { status: 'skipped' };
  const site = await nf('GET', `/sites/${siteId()}`);
  const aliases = site.domain_aliases || [];
  if (aliases.includes(`*.${domain}`)) return { status: 'wildcard', added: [], existing: subs.length };
  const want = subs.map(s => `${s}.${domain}`);
  const missing = want.filter(h => !aliases.includes(h) && site.custom_domain !== h);
  if (missing.length) await nf('PATCH', `/sites/${siteId()}`, { domain_aliases: [...aliases, ...missing] });
  return { status: 'ok', added: missing, existing: want.length - missing.length, site: site.name, customDomain: site.custom_domain };
}

export async function removeSubdomain(sub, domain) {
  if (!netlifyConfigured()) return { status: 'skipped' };
  const host = `${sub}.${domain}`;
  const site = await nf('GET', `/sites/${siteId()}`);
  const aliases = site.domain_aliases || [];
  if (!aliases.includes(host)) return { status: 'missing' };
  await nf('PATCH', `/sites/${siteId()}`, { domain_aliases: aliases.filter(a => a !== host) });
  return { status: 'removed' };
}
