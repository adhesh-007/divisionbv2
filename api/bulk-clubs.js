import { getState, saveClubs, uid } from '../lib/kv.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
try {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    if (!requireAdmin(req, res)) return;

    const { text } = req.body || {};
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const state = await getState();
    let added = 0, skipped = 0;

    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 3) { skipped++; return; }
      const [number, ...rest] = parts;
      const area = rest[rest.length - 1];
      const name = rest.slice(0, rest.length - 1).join(',').trim();
      if (!number || !name || !area) { skipped++; return; }
      if (state.clubs.some((c) => c.name === name)) { skipped++; return; }
      state.clubs.push({ id: uid(), number, name, area });
      added++;
    });

    await saveClubs(state.clubs);
    res.status(200).json({ added, skipped });
  } catch (err) {
    console.error('api/bulk-clubs.js error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }

}
