// Handles BOTH Education Badges and Club Success Plan records in one
// serverless function (dispatched by `kind`), so this counts as a single
// function against Vercel's 12-function-per-deployment Hobby plan cap
// instead of two. Keep new record types merged in here the same way —
// don't add another top-level file under /api unless you're removing one.
import { getState, saveBadges, saveSuccessPlans, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    const kind = req.method === 'GET' || req.method === 'POST' ? req.body?.kind : req.query.kind;

    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;

      if (kind === 'badges') {
        const { club, month, count } = req.body || {};
        if (!club || !month || count === undefined || count === null || count === '') {
          res.status(400).json({ error: 'Club, month, and number of level completions are all required.' });
          return;
        }
        const state = await getState();
        state.badges.push({
          id: uid(),
          club,
          month,
          count: Number(count) > 0 ? Number(count) : 0
        });
        await saveBadges(state.badges);
        res.status(200).json({ ok: true });
        return;
      }

      if (kind === 'successplan') {
        const { club, period, status, notes } = req.body || {};
        const cleanPeriod = String(period || '').trim();
        const cleanStatus = String(status || '').trim();
        if (!club || !cleanPeriod || !cleanStatus) {
          res.status(400).json({ error: 'Club, period, and status are all required.' });
          return;
        }
        const state = await getState();
        // One record per club per period — resubmitting replaces the old one.
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

      res.status(400).json({ error: 'Unknown record kind.' });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;

      if (kind === 'badges') {
        const state = await getState();
        state.badges = state.badges.filter((r) => r.id !== id);
        await saveBadges(state.badges);
        res.status(200).json({ ok: true });
        return;
      }

      if (kind === 'successplan') {
        const state = await getState();
        state.successPlans = state.successPlans.filter((r) => r.id !== id);
        await saveSuccessPlans(state.successPlans);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Unknown record kind.' });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/records.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
