// ── Daily bounties (quests) & achievements ────────────────────────────────────
// Bounties: 3 rotating mini-goals per day, seeded from the date like the daily
// challenge. Progress accumulates across ALL runs that day; rewards are teeth.
// Achievements: permanent badges, unlocked once, checked at bank points.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addTeeth, todayKey, dailySeed } from './progress';

// ── Quests ────────────────────────────────────────────────────────────────────
export interface Quest {
  id: string;
  txt: string;
  n: number;       // target
  reward: number;  // teeth
  kind: 'kills' | 'runners' | 'boss' | 'teeth' | 'nohit' | 'wave';
}

const QUEST_POOL: Array<(rng: () => number) => Quest> = [
  r => { const n = [40, 60, 80][Math.floor(r() * 3)]; return { id: 'kills', kind: 'kills', txt: `Kill ${n} zombies`, n, reward: 40 + Math.floor(n / 4) }; },
  r => { const n = [10, 15, 20][Math.floor(r() * 3)]; return { id: 'runners', kind: 'runners', txt: `Kill ${n} runners`, n, reward: 50 }; },
  r => { const n = r() < 0.6 ? 1 : 2; return { id: 'boss', kind: 'boss', txt: `Defeat ${n} boss${n > 1 ? 'es' : ''}`, n, reward: 60 * n }; },
  r => { const n = [30, 50][Math.floor(r() * 2)]; return { id: 'teeth', kind: 'teeth', txt: `Earn ${n} teeth from kills`, n, reward: 40 }; },
  r => { const n = r() < 0.5 ? 2 : 3; return { id: 'nohit', kind: 'nohit', txt: `Clear ${n} waves without getting hit`, n, reward: 45 * n }; },
  r => { const n = [6, 8][Math.floor(r() * 2)]; return { id: 'wave', kind: 'wave', txt: `Reach wave ${n} in one run`, n, reward: 55 }; },
];

function mkRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Today's 3 bounties — same for everyone, rotates daily with the seed. */
export function todayQuests(): Quest[] {
  const r = mkRng(dailySeed() ^ 0x9e3779b9);
  const idx: number[] = [];
  while (idx.length < 3) {
    const i = Math.floor(r() * QUEST_POOL.length);
    if (!idx.includes(i)) idx.push(i);
  }
  return idx.map(i => QUEST_POOL[i](r));
}

export interface QuestState { progress: number[]; claimed: boolean[] }
const K_QUESTS = 'zb_quests_'; // + date

export async function loadQuestState(): Promise<QuestState> {
  try {
    const s = JSON.parse((await AsyncStorage.getItem(K_QUESTS + todayKey())) ?? 'null');
    if (s && Array.isArray(s.progress) && Array.isArray(s.claimed)) return s;
  } catch {}
  return { progress: [0, 0, 0], claimed: [false, false, false] };
}

export interface QuestDeltas {
  kills?: number;
  runners?: number;
  boss?: number;
  teeth?: number;
  nohit?: number;
  wave?: number; // max-type: highest wave reached this run
}

/** Apply run deltas to today's bounty progress. Fire-and-forget safe. */
export async function addQuestProgress(d: QuestDeltas): Promise<void> {
  try {
    const quests = todayQuests();
    const s = await loadQuestState();
    quests.forEach((q, i) => {
      if (s.claimed[i]) return;
      const v = d[q.kind] ?? 0;
      if (v <= 0) return;
      s.progress[i] = q.kind === 'wave'
        ? Math.max(s.progress[i], Math.min(v, q.n))
        : Math.min(q.n, s.progress[i] + v);
    });
    await AsyncStorage.setItem(K_QUESTS + todayKey(), JSON.stringify(s));
  } catch {}
}

/** Claim a completed bounty. Returns the reward paid, or 0 if not claimable. */
export async function claimQuest(i: number): Promise<number> {
  try {
    const quests = todayQuests();
    const s = await loadQuestState();
    const q = quests[i];
    if (!q || s.claimed[i] || s.progress[i] < q.n) return 0;
    s.claimed[i] = true;
    await AsyncStorage.setItem(K_QUESTS + todayKey(), JSON.stringify(s));
    await addTeeth(q.reward);
    return q.reward;
  } catch { return 0; }
}

// ── Achievements ──────────────────────────────────────────────────────────────
export interface AchDef {
  id: string;
  name: string;
  desc: string;
  icon: string; // Ionicons name
}
export const ACH_DEFS: AchDef[] = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'Kill your first zombie', icon: 'skull' },
  { id: 'century', name: 'CENTURION', desc: '100 kills in a single run', icon: 'flame' },
  { id: 'wave10', name: 'DOUBLE DIGITS', desc: 'Reach wave 10', icon: 'trending-up' },
  { id: 'wave15', name: 'LEGEND OF THE LOT', desc: 'Reach wave 15', icon: 'trophy' },
  { id: 'boss_slayer', name: 'BOSS BUSTER', desc: 'Defeat 10 bosses (lifetime)', icon: 'shield-half' },
  { id: 'untouchable', name: 'UNTOUCHABLE', desc: 'Clear 3 waves in one run without getting hit', icon: 'sparkles' },
  { id: 'zombslayer', name: 'ZOMBSLAYER', desc: 'Hit a 20-kill streak', icon: 'flash' },
  { id: 'harvester', name: 'TOOTH HARVESTER', desc: 'Earn 100 teeth in a single run', icon: 'diamond' },
];

const K_ACH = 'zb_ach';
export async function loadAchievements(): Promise<string[]> {
  try {
    const s = JSON.parse((await AsyncStorage.getItem(K_ACH)) ?? '[]');
    return Array.isArray(s) ? s : [];
  } catch { return []; }
}

export interface RunFacts {
  runKills: number;
  runTeeth: number;
  maxStreak: number;
  noHitWaves: number;
  wave: number;
  lifetimeKills: number;
  lifetimeBosses: number;
}

/** Check all achievement conditions; persist and return NEWLY unlocked defs. */
export async function checkAchievements(f: RunFacts): Promise<AchDef[]> {
  try {
    const have = await loadAchievements();
    const fresh: AchDef[] = [];
    const test: Record<string, boolean> = {
      first_blood: f.lifetimeKills >= 1 || f.runKills >= 1,
      century: f.runKills >= 100,
      wave10: f.wave >= 10,
      wave15: f.wave >= 15,
      boss_slayer: f.lifetimeBosses >= 10,
      untouchable: f.noHitWaves >= 3,
      zombslayer: f.maxStreak >= 20,
      harvester: f.runTeeth >= 100,
    };
    for (const d of ACH_DEFS) {
      if (test[d.id] && !have.includes(d.id)) { have.push(d.id); fresh.push(d); }
    }
    if (fresh.length > 0) await AsyncStorage.setItem(K_ACH, JSON.stringify(have));
    return fresh;
  } catch { return []; }
}
