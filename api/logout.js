import { clearSessionCookie } from '../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(200).json({ ok: true });
}
