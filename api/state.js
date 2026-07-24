import { getState } from '../lib/kv.js';

export default async function handler(req, res) {
try {
    if (req.method !== 'GET') { res.status(405).end(); return; }
    const state = await getState();
    res.status(200).json(state);
  } catch (err) {
    console.error('api/state.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
