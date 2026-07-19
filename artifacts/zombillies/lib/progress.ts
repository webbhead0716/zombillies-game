// ── Persistent progression: teeth currency, upgrades, hats, lifetime stats ────
// All reads/writes go through AsyncStorage and fail silently — progression
// problems must never break gameplay.
import AsyncStorage from '@react-native-async-storage/async-storage';

const K_TEETH = 'zb_teeth';
const K_UPG = 'zb_upg';
const K_STATS = 'zb_stats';
const K_HAT = 'zb_hat';
const K_DAILY = 'zb_daily_'; // + YYYY-MM-DD → best score that day

export interface Upgrades {
  hp: number;   // +10 max HP per level
  dmg: number;  // +4 DVD damage per level
  mic: number;  // +3s mic mode per level
}
export interface LifetimeStats {
  kills: number;
  bosses: number;
  bestWave: number;
}

export const UPG_DEFS = [
  { key: 'hp' as const, name: 'MOONSHINE VIGOR', desc: '+10 max HP per level', max: 5 },
  { key: 'dmg' as const, name: 'SHARPENED DISCS', desc: '+4 DVD damage per level', max: 5 },
  { key: 'mic' as const, name: 'LONG ENCORE', desc: '+3s mic mode per level', max: 5 },
];
export const upgCost = (level: number) => (level + 1) * 50;

// Unlockable trucker caps (by lifetime kills / best wave).
// Each hat grants a small run bonus so unlocks matter beyond looks.
export interface Hat {
  id: string;
  name: string;
  cap: string;    // crown color
  visor: string;  // brim color
  reqKills: number;
  reqWave: number;
  reqTxt: string;
  bonusTxt: string;
  // Run bonuses applied at run start
  dmg?: number;   // damage multiplier bonus (0.10 = +10%)
  spd?: number;   // move speed multiplier bonus
  hp?: number;    // flat max HP bonus
  teeth?: number; // extra teeth per kill
}
export const HATS: Hat[] = [
  { id: 'classic', name: 'CLASSIC', cap: '#3A2313', visor: '#241206', reqKills: 0, reqWave: 0, reqTxt: '', bonusTxt: 'no bonus — just style' },
  { id: 'red', name: 'ROAD RASH', cap: '#8B1A1A', visor: '#4A0A0A', reqKills: 250, reqWave: 0, reqTxt: '250 lifetime kills', bonusTxt: '+10% damage', dmg: 0.10 },
  { id: 'blue', name: 'BLUE RIDGE', cap: '#1B4A8B', visor: '#0A2448', reqKills: 0, reqWave: 8, reqTxt: 'reach wave 8', bonusTxt: '+15 max HP', hp: 15 },
  { id: 'gold', name: 'GOLDEN LEGEND', cap: '#C8A028', visor: '#8A6A10', reqKills: 1000, reqWave: 0, reqTxt: '1000 lifetime kills', bonusTxt: '+1 tooth per kill', teeth: 1 },
  { id: 'chrome', name: 'CHROME DOME', cap: '#B8C4CC', visor: '#78848C', reqKills: 0, reqWave: 15, reqTxt: 'reach wave 15', bonusTxt: '+10% move speed', spd: 0.10 },
  { id: 'midnight', name: 'MIDNIGHT RIDER', cap: '#14141C', visor: '#000000', reqKills: 2500, reqWave: 0, reqTxt: '2500 lifetime kills', bonusTxt: '+15% dmg · +5% speed', dmg: 0.15, spd: 0.05 },
];
export function hatUnlocked(h: Hat, stats: LifetimeStats) {
  return stats.kills >= h.reqKills && stats.bestWave >= h.reqWave;
}

const DEF_UPG: Upgrades = { hp: 0, dmg: 0, mic: 0 };
const DEF_STATS: LifetimeStats = { kills: 0, bosses: 0, bestWave: 0 };

export async function loadTeeth(): Promise<number> {
  try { return parseInt((await AsyncStorage.getItem(K_TEETH)) ?? '0') || 0; } catch { return 0; }
}
export async function addTeeth(n: number): Promise<number> {
  try {
    const t = (await loadTeeth()) + n;
    await AsyncStorage.setItem(K_TEETH, String(t));
    return t;
  } catch { return 0; }
}
export async function spendTeeth(n: number): Promise<number | null> {
  try {
    const t = await loadTeeth();
    if (t < n) return null;
    await AsyncStorage.setItem(K_TEETH, String(t - n));
    return t - n;
  } catch { return null; }
}

export async function loadUpgrades(): Promise<Upgrades> {
  try { return { ...DEF_UPG, ...JSON.parse((await AsyncStorage.getItem(K_UPG)) ?? '{}') }; }
  catch { return { ...DEF_UPG }; }
}
export async function saveUpgrades(u: Upgrades) {
  try { await AsyncStorage.setItem(K_UPG, JSON.stringify(u)); } catch {}
}

export async function loadStats(): Promise<LifetimeStats> {
  try { return { ...DEF_STATS, ...JSON.parse((await AsyncStorage.getItem(K_STATS)) ?? '{}') }; }
  catch { return { ...DEF_STATS }; }
}
export async function recordRun(kills: number, bosses: number, wave: number) {
  try {
    const s = await loadStats();
    s.kills += kills;
    s.bosses += bosses;
    s.bestWave = Math.max(s.bestWave, wave);
    await AsyncStorage.setItem(K_STATS, JSON.stringify(s));
    return s;
  } catch { return { ...DEF_STATS }; }
}

export async function loadHat(): Promise<string> {
  try { return (await AsyncStorage.getItem(K_HAT)) ?? 'classic'; } catch { return 'classic'; }
}
export async function saveHat(id: string) {
  try { await AsyncStorage.setItem(K_HAT, id); } catch {}
}

// ── Saved run (save & continue) ────────────────────────────────────────────────
const K_RUN = 'zb_run';
export interface RunSnapshot {
  wave: number;        // last completed wave — resume into its intermission
  hp: number;
  maxHp: number;
  score: number;
  kills: number;
  hits: number;
  bossKills: number;
  teeth: number;       // unbanked teeth still carried by the run
  dmgMult: number;
  spdMult: number;
  upgDmg: number;
  upgMic: number;
  streak: number;
  // Optional fields added later — old snapshots may omit them
  rangeMult?: number;
  teethBonus?: number;
  streakSave?: boolean;
  maxStreak?: number;
  runnerKills?: number;
  noHitWaves?: number;
}
export async function saveRun(s: RunSnapshot) {
  try { await AsyncStorage.setItem(K_RUN, JSON.stringify(s)); } catch {}
}
export async function loadRun(): Promise<RunSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(K_RUN);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.wave === 'number' && s.wave >= 1 ? s : null;
  } catch { return null; }
}
export async function clearRun() {
  try { await AsyncStorage.removeItem(K_RUN); } catch {}
}

// ── Daily challenge ────────────────────────────────────────────────────────────
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dailySeed(): number {
  const k = todayKey();
  let s = 0;
  for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) >>> 0;
  return s;
}
export const DAILY_MODS = [
  { id: 'runners', name: 'RUNNER SWARM', desc: 'Every zombie is a runner' },
  { id: 'nocheck', name: 'NO CHECKPOINTS', desc: 'No midway heal' },
  { id: 'tough', name: 'TOUGH CROWD', desc: 'Zombies have +50% HP' },
];
export function todayMod() {
  return DAILY_MODS[dailySeed() % DAILY_MODS.length];
}
// ── Daily login streak ────────────────────────────────────────────────────────
// Completing a daily run on consecutive days earns escalating teeth bonuses.
const K_DSTREAK = 'zb_dstreak';
const STREAK_BONUS = [10, 20, 50, 75, 100, 150, 200]; // day 1..7+
export interface DailyStreak { last: string; count: number }
export async function loadDailyStreak(): Promise<DailyStreak> {
  try {
    const s = JSON.parse((await AsyncStorage.getItem(K_DSTREAK)) ?? 'null');
    return s && typeof s.count === 'number' ? s : { last: '', count: 0 };
  } catch { return { last: '', count: 0 }; }
}
function yesterdayKey(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Call when a daily run ends. Awards the streak bonus once per day. */
export async function recordDailyStreak(): Promise<{ count: number; bonus: number }> {
  try {
    const s = await loadDailyStreak();
    const today = todayKey();
    if (s.last === today) return { count: s.count, bonus: 0 }; // already counted today
    const count = s.last === yesterdayKey() ? s.count + 1 : 1;
    const bonus = STREAK_BONUS[Math.min(count, STREAK_BONUS.length) - 1];
    await AsyncStorage.setItem(K_DSTREAK, JSON.stringify({ last: today, count }));
    await addTeeth(bonus);
    return { count, bonus };
  } catch { return { count: 0, bonus: 0 }; }
}
/** Current streak for display: counts only if played today or yesterday. */
export function streakAlive(s: DailyStreak): number {
  return s.last === todayKey() || s.last === yesterdayKey() ? s.count : 0;
}

// ── Endless mode best score ───────────────────────────────────────────────────
export const ENDLESS_UNLOCK_WAVE = 10;
const K_ENDLESS = 'zb_endless_hs';
export async function loadEndlessBest(): Promise<number> {
  try { return parseInt((await AsyncStorage.getItem(K_ENDLESS)) ?? '0') || 0; } catch { return 0; }
}
export async function saveEndlessBest(score: number): Promise<boolean> {
  try {
    const prev = await loadEndlessBest();
    if (score > prev) { await AsyncStorage.setItem(K_ENDLESS, String(score)); return true; }
    return false;
  } catch { return false; }
}

export async function loadDailyBest(): Promise<number> {
  try { return parseInt((await AsyncStorage.getItem(K_DAILY + todayKey())) ?? '0') || 0; } catch { return 0; }
}
export async function saveDailyBest(score: number): Promise<boolean> {
  try {
    const prev = await loadDailyBest();
    if (score > prev) { await AsyncStorage.setItem(K_DAILY + todayKey(), String(score)); return true; }
    return false;
  } catch { return false; }
}
