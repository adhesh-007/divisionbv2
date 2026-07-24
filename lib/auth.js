import crypto from 'crypto';

// You can override these in Vercel Project Settings → Environment Variables.
// If you don't set SESSION_SECRET, sessions still work but are signed with a
// baked-in fallback — fine to try the app, but set your own secret before
// relying on this for anything sensitive.
const SECRET = process.env.SESSION_SECRET || 'divisionb-fallback-secret-change-me';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'divb';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Adhesh@db';

const COOKIE_NAME = 'db_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function sign(value) {
  const h = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
  return `${value}.${h}`;
}
function verify(signed) {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  return crypto.timingSafeEqual(sigBuf, expBuf) ? value : null;
}
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((c) => {
      const idx = c.indexOf('=');
      return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1))];
    })
  );
}

export function checkCredentials(username, password) {
  return username === ADMIN_USER && password === ADMIN_PASS;
}

export function createSessionCookie() {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = sign(`admin:${exp}`);
  const secureFlag = process.env.VERCEL ? ' Secure;' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${secureFlag} Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSessionCookie() {
  const secureFlag = process.env.VERCEL ? ' Secure;' : '';
  return `${COOKIE_NAME}=; HttpOnly;${secureFlag} Path=/; Max-Age=0; SameSite=Lax`;
}

export function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  const value = verify(raw);
  if (!value) return false;
  const [role, expStr] = value.split(':');
  if (role !== 'admin') return false;
  if (Date.now() > Number(expStr)) return false;
  return true;
}

export function requireAdmin(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Admin login required.' });
    return false;
  }
  return true;
}
