import { getState, saveBadges, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { club, date, award, count } = req.body || {};
      const cleanAward = String(award || '').trim();
      if (!club || !date || !cleanAward) {
        res.status(400).json({ error: 'Club, date, and award/level are all required.' });
        return;
      }
      const state = await getState();
      state.badges.push({
        id: uid(),
        club,
        date,
        award: cleanAward,
        count: Number(count) > 0 ? Number(count) : 1
      });
      await saveBadges(state.badges);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;
      const state = await getState();
      state.badges = state.badges.filter((r) => r.id !== id);
      await saveBadges(state.badges);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/badges.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
