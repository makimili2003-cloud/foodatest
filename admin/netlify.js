// Poddomeni (npr. pizza.foodar.org) se dodaju kao "domain alias" Netlify sajta.
// Ako je domen na Netlify DNS-u, Netlify sam napravi DNS zapis i SSL sertifikat.
const API = 'https://api.netlify.com/api/v1';

export function netlifyConfigured() {
  return Boolean(process.env.NETLIFY_TOKEN && process.env.NETLIFY_SITE_ID);
}

async function nf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NETLIFY_TOKEN}`,
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

const siteId = () => encodeURIComponent(process.env.NETLIFY_SITE_ID);

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

export async function removeSubdomain(sub, domain) {
  if (!netlifyConfigured()) return { status: 'skipped' };
  const host = `${sub}.${domain}`;
  const site = await nf('GET', `/sites/${siteId()}`);
  const aliases = site.domain_aliases || [];
  if (!aliases.includes(host)) return { status: 'missing' };
  await nf('PATCH', `/sites/${siteId()}`, { domain_aliases: aliases.filter(a => a !== host) });
  return { status: 'removed' };
}
