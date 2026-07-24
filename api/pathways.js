import { getState, savePathways, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { club, month, active, total } = req.body || {};
      if (!club || !month) {
        res.status(400).json({ error: 'Club and month are required.' });
        return;
      }
      const state = await getState();
      state.pathways.push({
        id: uid(),
        club,
        month,
        active: Number(active) || 0,
        total: Number(total) || 0
      });
      await savePathways(state.pathways);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;
      const state = await getState();
      state.pathways = state.pathways.filter((r) => r.id !== id);
      await savePathways(state.pathways);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/pathways.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
