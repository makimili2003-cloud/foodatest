// Obaveštenja o novom upitu na telefon: Telegram (bot) i WhatsApp (CallMeBot).
// Sve je opciono: ako nešto nije podešeno, preskače se, a upit se i dalje čuva i šalje mejlom.
//
// Netlify promenljive:
//   TELEGRAM_BOT_TOKEN  token bota od @BotFather
//   TELEGRAM_USERNAME   Telegram korisničko ime koje prima poruke (bez @), npr. moradoselselmos
//   TELEGRAM_CHAT_ID    (opciono) ako ga ne upišeš, admin panel ga sam pronađe dugmetom „Poveži Telegram“
//   WHATSAPP_PHONE      broj za WhatsApp, npr. +381621484566
//   CALLMEBOT_APIKEY    ključ koji CallMeBot pošalje na WhatsApp posle aktivacije
import { adminStore } from './store.mjs';

const env = k => (process.env[k] || '').trim();
const TG_KEY = 'obavestenja/telegram';
const LABELS = { restoran: 'Restoran', ime: 'Ime', telefon: 'Telefon', email: 'Email', grad: 'Grad', broj_jela: 'Broj jela', paket: 'Paket', poruka: 'Poruka' };
const TIMEOUT = 6000;

const tgUser = () => env('TELEGRAM_USERNAME').replace(/^@/, '').toLowerCase();
async function tgChatId() {
  if (env('TELEGRAM_CHAT_ID')) return env('TELEGRAM_CHAT_ID');
  const saved = await adminStore().get(TG_KEY, { type: 'json' }).catch(() => null);
  return saved?.chatId || '';
}
async function tgApi(method, params) {
  const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}), signal: AbortSignal.timeout(TIMEOUT)
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('Telegram: ' + (j.description || r.status));
  return j.result;
}

export async function status() {
  const chatId = env('TELEGRAM_BOT_TOKEN') ? await tgChatId() : '';
  return {
    telegram: { token: Boolean(env('TELEGRAM_BOT_TOKEN')), username: tgUser(), linked: Boolean(chatId) },
    whatsapp: { phone: Boolean(env('WHATSAPP_PHONE')), apikey: Boolean(env('CALLMEBOT_APIKEY')), ready: Boolean(env('WHATSAPP_PHONE') && env('CALLMEBOT_APIKEY')) }
  };
}

/** Pronađi chat sa vlasnikom: on prvo pošalje /start botu, pa se ovde iz poslednjih poruka uzme njegov chat. */
export async function linkTelegram() {
  if (!env('TELEGRAM_BOT_TOKEN')) throw new Error('U Netlify-ju nije podešen TELEGRAM_BOT_TOKEN.');
  const want = tgUser();
  const updates = await tgApi('getUpdates', { limit: 100, allowed_updates: ['message'] });
  const chats = updates.map(u => u.message?.chat).filter(c => c && c.type === 'private');
  const chat = [...chats].reverse().find(c => !want || String(c.username || '').toLowerCase() === want);
  if (!chat) {
    throw new Error(want
      ? `Nema poruke od @${want}. Otvori bota u Telegramu, pošalji mu /start pa pokušaj ponovo.`
      : 'Nema poruka botu. Otvori bota u Telegramu, pošalji mu /start pa pokušaj ponovo.');
  }
  await adminStore().setJSON(TG_KEY, { chatId: String(chat.id), username: chat.username || '', linkedAt: new Date().toISOString() });
  await tgApi('sendMessage', { chat_id: chat.id, text: '✅ FoodAR: Telegram je povezan. Ovde će stizati novi upiti sa sajta.' });
  return { username: chat.username || '', name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') };
}

function messageText(u, adminUrl) {
  const lines = Object.keys(LABELS).filter(k => u[k]).map(k => `${LABELS[k]}: ${u[k]}`);
  return `🍽 Novi upit sa sajta FoodAR\n\n${lines.join('\n')}\n\nAdmin panel: ${adminUrl}`;
}

async function sendTelegram(text) {
  if (!env('TELEGRAM_BOT_TOKEN')) return 'nije podešeno';
  const chatId = await tgChatId();
  if (!chatId) return 'nije povezano';
  await tgApi('sendMessage', { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true });
  return 'poslato';
}

async function sendWhatsApp(text) {
  if (!env('WHATSAPP_PHONE') || !env('CALLMEBOT_APIKEY')) return 'nije podešeno';
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(env('WHATSAPP_PHONE')) +
    '&apikey=' + encodeURIComponent(env('CALLMEBOT_APIKEY')) + '&text=' + encodeURIComponent(text.slice(0, 1500));
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  const body = await r.text().catch(() => '');
  if (!r.ok || /error|invalid|not (yet )?(registered|active)/i.test(body)) throw new Error('WhatsApp (CallMeBot): ' + (body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || r.status));
  return 'poslato';
}

/** Pošalji na sve podešene kanale; greška jednog kanala ne zaustavlja ostale. */
export async function notifyAll(text) {
  const [telegram, whatsapp] = await Promise.allSettled([sendTelegram(text), sendWhatsApp(text)]);
  const out = r => r.status === 'fulfilled' ? r.value : 'greška: ' + r.reason.message;
  const res = { telegram: out(telegram), whatsapp: out(whatsapp) };
  for (const [k, v] of Object.entries(res)) if (v.startsWith('greška')) console.error('obaveštenje', k, v);
  return res;
}

export const notifyNewInquiry = (u, adminUrl) => notifyAll(messageText(u, adminUrl));
export const sendTest = adminUrl => notifyAll(`🔔 FoodAR test: obaveštenja o upitima rade.\n\nAdmin panel: ${adminUrl}`);
