import { getState, saveMentors, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { club, month, assigned, total } = req.body || {};
      if (!club || !month) {
        res.status(400).json({ error: 'Club and month are required.' });
        return;
      }
      const state = await getState();
      state.mentors.push({
        id: uid(),
        club,
        month,
        assigned: Number(assigned) || 0,
        total: Number(total) || 0
      });
      await saveMentors(state.mentors);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;
      const state = await getState();
      state.mentors = state.mentors.filter((r) => r.id !== id);
      await saveMentors(state.mentors);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/mentors.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
