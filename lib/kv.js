import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  // Vercel's Upstash Marketplace integration, and older "Vercel KV" migrations,
  // can inject these under either naming convention depending on how the
  // database was created. Check both before giving up.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'No Redis database is connected to this project yet (or it was connected without a redeploy). ' +
      'In Vercel: Storage tab → connect an Upstash Redis database to this project, then redeploy.'
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export const DEFAULT_DIRECTORS = {
  B1: "TM Karthick Rajendran",
  B2: "Atchayashiri",
  B3: "Jonathan",
  B4: "Sunita Rajaseelan"
};

const KEYS = {
  clubs: 'db:clubs',
  meetings: 'db:meetings',
  pathways: 'db:pathways',
  mentors: 'db:mentors',
  directors: 'db:directors',
  strength: 'db:strength'
};

export async function getState() {
  const redis = getRedis();
  const [clubs, meetings, pathways, mentors, directors, strength] = await Promise.all([
    redis.get(KEYS.clubs),
    redis.get(KEYS.meetings),
    redis.get(KEYS.pathways),
    redis.get(KEYS.mentors),
    redis.get(KEYS.directors),
    redis.get(KEYS.strength)
  ]);
  return {
    clubs: clubs || [],
    meetings: meetings || [],
    pathways: pathways || [],
    mentors: mentors || [],
    directors: directors || {},
    strength: strength || []
  };
}

export async function saveClubs(v) { await getRedis().set(KEYS.clubs, v); }
export async function saveMeetings(v) { await getRedis().set(KEYS.meetings, v); }
export async function savePathways(v) { await getRedis().set(KEYS.pathways, v); }
export async function saveMentors(v) { await getRedis().set(KEYS.mentors, v); }
export async function saveDirectors(v) { await getRedis().set(KEYS.directors, v); }
export async function saveStrength(v) { await getRedis().set(KEYS.strength, v); }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
