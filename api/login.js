import { checkCredentials, createSessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const { username, password } = req.body || {};
  if (checkCredentials(username, password)) {
    res.setHeader('Set-Cookie', createSessionCookie());
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Incorrect username or password.' });
  }
}
