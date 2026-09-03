import { getState, saveSuccessPlans, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { club, period, status, notes } = req.body || {};
      const cleanPeriod = String(period || '').trim();
      const cleanStatus = String(status || '').trim();
      if (!club || !cleanPeriod || !cleanStatus) {
        res.status(400).json({ error: 'Club, period, and status are all required.' });
        return;
      }
      const state = await getState();
      // One record per club per period — new submissions for the same period replace the old one.
      state.successPlans = state.successPlans.filter((r) => !(r.club === club && r.period === cleanPeriod));
      state.successPlans.push({
        id: uid(),
        club,
        period: cleanPeriod,
        status: cleanStatus,
        notes: String(notes || '').trim()
      });
      await saveSuccessPlans(state.successPlans);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;
      const state = await getState();
      state.successPlans = state.successPlans.filter((r) => r.id !== id);
      await saveSuccessPlans(state.successPlans);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/success-plan.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
