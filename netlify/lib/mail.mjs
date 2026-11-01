// Slanje mejlova preko Google Workspace (Gmail SMTP) sa adresa @foodar.org.
// Za svaku adresu u Netlify-ju treba "App password" (lozinka za aplikaciju) tog naloga:
//   GMAIL_AR_PASS, GMAIL_MILAN_PASS, GMAIL_MATEJA_PASS
// Poslati mejlovi se sami čuvaju u "Poslato" tog Gmail naloga, a odgovori klijenata stižu u njegov inbox.
import nodemailer from 'nodemailer';

export const SENDERS = {
  ar: { email: 'ar@foodar.org', name: 'FoodAR', env: 'GMAIL_AR_PASS' },
  milan: { email: 'milan@foodar.org', name: 'Milan | FoodAR', env: 'GMAIL_MILAN_PASS' },
  mateja: { email: 'mateja@foodar.org', name: 'Mateja | FoodAR', env: 'GMAIL_MATEJA_PASS' }
};
export const INBOX = 'ar@foodar.org';
export const COPIES = ['milan@foodar.org', 'mateja@foodar.org'];

const pass = id => (process.env[SENDERS[id]?.env] || '').replace(/\s+/g, '');
const ownLogin = id => Boolean(SENDERS[id] && pass(id));
// Milan/Mateja bez sopstvenog App password-a šalju PREKO ar@ naloga, u svoje ime:
// From: Milan <milan@foodar.org> (ako je u ar@ Gmail-u dodat kao "Send mail as", inače Gmail prikaže ar@),
// Reply-To: milan@ (klijent odgovara Milanu), a Milan dobija skrivenu kopiju (BCC).
const via = id => (ownLogin(id) ? id : (id !== 'ar' && ownLogin('ar') ? 'ar' : null));
export const canSend = id => Boolean(SENDERS[id] && via(id));
export function availableSenders() {
  return Object.entries(SENDERS).map(([id, s]) => ({ id, email: s.email, name: s.name, ready: canSend(id), viaAr: canSend(id) && via(id) !== id }));
}

const transports = {};
function transport(id) {
  return transports[id] ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: SENDERS[id].email, pass: pass(id) },
    connectionTimeout: 6000, greetingTimeout: 6000, socketTimeout: 8000
  });
}

export async function send(id, msg) {
  if (!canSend(id)) throw new Error(`Slanje sa ${SENDERS[id]?.email || id} nije podešeno (nedostaje GMAIL_AR_PASS u Netlify-ju).`);
  const login = via(id);
  try {
    const s = SENDERS[id];
    const extra = login !== id ? { replyTo: s.email, bcc: [s.email, ...[].concat(msg.bcc || [])] } : {};
    return await transport(login).sendMail({ from: { name: s.name, address: s.email }, ...msg, ...extra });
  } catch (e) {
    if (/Invalid login|Username and Password not accepted|535/i.test(e.message)) {
      throw new Error(`Gmail odbija prijavu za ${SENDERS[login].email}: proveri App password (${SENDERS[login].env}).`);
    }
    throw new Error('Slanje mejla nije uspelo: ' + e.message);
  }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABELS = { ime: 'Ime', restoran: 'Restoran', telefon: 'Telefon', email: 'Email', grad: 'Grad', broj_jela: 'Broj jela', paket: 'Paket', poruka: 'Poruka' };

/** Obaveštenje o novom upitu: na ar@, kopija Milanu i Mateji; "Odgovori" u Gmail-u ide direktno klijentu. */
export async function notifyNewInquiry(u, adminUrl) {
  if (!canSend('ar')) return false;
  const rows = Object.keys(LABELS).filter(k => u[k]).map(k =>
    `<tr><td style="padding:8px 12px;color:#6a6058;vertical-align:top;white-space:nowrap">${LABELS[k]}</td><td style="padding:8px 12px;color:#1f1a17">${esc(u[k]).replace(/\n/g, '<br>')}</td></tr>`).join('');
  await send('ar', {
    to: INBOX, cc: COPIES, replyTo: u.email || undefined,
    subject: `Novi upit: ${u.restoran || u.ime}${u.paket ? ' (' + u.paket + ')' : ''}`,
    text: Object.keys(LABELS).filter(k => u[k]).map(k => `${LABELS[k]}: ${u[k]}`).join('\n') + `\n\nOtvori u admin panelu: ${adminUrl}`,
    html: `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px">
      <h2 style="font-family:Georgia,serif;color:#1f1a17;margin:0 0 12px">Novi upit sa sajta</h2>
      <table style="border-collapse:collapse;background:#fbf7f1;border-radius:12px;width:100%">${rows}</table>
      <p style="margin:18px 0"><a href="${adminUrl}" style="background:#d9472b;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Otvori u admin panelu</a></p>
      <p style="color:#6a6058;font-size:13px">Odgovor na ovaj mejl ide direktno klijentu${u.email ? ' (' + esc(u.email) + ')' : ''}.</p></div>`
  });
  return true;
}

/** Odgovor klijentu iz admin panela. */
export async function sendReply(fromId, u, subject, text) {
  const s = SENDERS[fromId];
  const quoted = Object.keys(LABELS).filter(k => u[k] && k !== 'email').map(k => `${LABELS[k]}: ${u[k]}`).join('\n');
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f1a17;max-width:600px">
    ${esc(text).replace(/\n/g, '<br>')}
    <p style="margin-top:22px;color:#6a6058">${esc(s.name.replace(' | FoodAR', ''))}<br><b style="color:#d9472b">FoodAR</b> · 3D i AR meni za restorane<br><a href="https://foodar.org" style="color:#d9472b">foodar.org</a> · <a href="mailto:${s.email}" style="color:#d9472b">${s.email}</a></p>
    <blockquote style="margin:22px 0 0;padding:10px 14px;border-left:3px solid #ebe3d8;color:#6a6058;font-size:13px">Vaš upit:<br>${esc(quoted).replace(/\n/g, '<br>')}</blockquote></div>`;
  return send(fromId, {
    // kopija u glavni inbox kad odgovara Milan/Mateja sa svog naloga (preko ar@ je već u ar@ "Poslato")
    to: u.email, cc: fromId === 'ar' || via(fromId) === 'ar' ? undefined : INBOX,
    replyTo: s.email, subject,
    text: `${text}\n\n${s.name.replace(' | FoodAR', '')}\nFoodAR · foodar.org · ${s.email}\n\n--- Vaš upit ---\n${quoted}`,
    html
  });
}
