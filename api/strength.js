import { getState, saveStrength, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const { club, month, strength } = req.body || {};
    if (!club || !month || strength === undefined || strength === null || strength === '') {
      res.status(400).json({ error: 'Club, month, and total members are all required.' });
      return;
    }
    const state = await getState();
    state.strength.push({
      id: uid(),
      club,
      month,
      strength: Number(strength) || 0
    });
    await saveStrength(state.strength);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = req.query.id;
    const state = await getState();
    state.strength = state.strength.filter((r) => r.id !== id);
    await saveStrength(state.strength);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
} catch (err) {
  console.error('api/strength.js error:', err);
  res.status(500).json({ error: err.message || 'Unexpected server error.' });
}
}
