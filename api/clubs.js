import { getState, saveClubs, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { number, name, area } = req.body || {};
      const cleanNumber = String(number || '').trim();
      const cleanName = String(name || '').trim();
      const cleanArea = String(area || '').trim();
      if (!cleanNumber || !cleanName || !cleanArea) {
        res.status(400).json({ error: 'Club number, name, and area are all required.' });
        return;
      }
      const state = await getState();
      if (state.clubs.some((c) => c.name === cleanName)) {
        res.status(409).json({ error: 'A club with that name already exists.' });
        return;
      }
      state.clubs.push({ id: uid(), number: cleanNumber, name: cleanName, area: cleanArea });
      await saveClubs(state.clubs);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const name = req.query.name;
      const state = await getState();
      state.clubs = state.clubs.filter((c) => c.name !== name);
      await saveClubs(state.clubs);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/clubs.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
