// Netlify Blobs skladište za admin (pretplate, privremeni upload modela, zaštita prijave)
import { getStore } from '@netlify/blobs';

export function adminStore() {
  if (globalThis.__FOODAR_TEST_STORE__) return globalThis.__FOODAR_TEST_STORE__;
  return getStore({ name: 'foodar-admin', consistency: 'strong' });
}
