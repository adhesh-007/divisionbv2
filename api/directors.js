import { getState, saveDirectors, DEFAULT_DIRECTORS } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    if (!requireAdmin(req, res)) return;

    const state = await getState();
    const body = req.body || {};

    if (body.loadDefaults) {
      Object.assign(state.directors, DEFAULT_DIRECTORS);
    } else if (body.area) {
      state.directors[body.area] = String(body.name || '').trim();
    } else {
      res.status(400).json({ error: 'Missing area or loadDefaults flag.' });
      return;
    }

    await saveDirectors(state.directors);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('api/directors.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
