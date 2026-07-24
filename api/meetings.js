import { getState, saveMeetings, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { club, date, onTime, speeches, guests, membersPresent, agenda, flyer } = req.body || {};
      if (!club || !date) {
        res.status(400).json({ error: 'Club and meeting date are required.' });
        return;
      }
      const state = await getState();
      state.meetings.push({
        id: uid(),
        club,
        date,
        onTime: !!onTime,
        speeches: Number(speeches) || 0,
        guests: Number(guests) || 0,
        membersPresent: Number(membersPresent) || 0,
        agenda: !!agenda,
        flyer: !!flyer
      });
      await saveMeetings(state.meetings);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const id = req.query.id;
      const state = await getState();
      state.meetings = state.meetings.filter((m) => m.id !== id);
      await saveMeetings(state.meetings);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).end();
  } catch (err) {
    console.error('api/meetings.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
