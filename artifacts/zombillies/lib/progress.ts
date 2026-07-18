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

// Unlockable trucker caps (by lifetime kills / best wave)
export interface Hat {
  id: string;
  name: string;
  cap: string;    // crown color
  visor: string;  // brim color
  reqKills: number;
  reqWave: number;
  reqTxt: string;
}
export const HATS: Hat[] = [
  { id: 'classic', name: 'CLASSIC', cap: '#3A2313', visor: '#241206', reqKills: 0, reqWave: 0, reqTxt: '' },
  { id: 'red', name: 'ROAD RASH', cap: '#8B1A1A', visor: '#4A0A0A', reqKills: 250, reqWave: 0, reqTxt: '250 lifetime kills' },
  { id: 'blue', name: 'BLUE RIDGE', cap: '#1B4A8B', visor: '#0A2448', reqKills: 0, reqWave: 8, reqTxt: 'reach wave 8' },
  { id: 'gold', name: 'GOLDEN LEGEND', cap: '#C8A028', visor: '#8A6A10', reqKills: 1000, reqWave: 0, reqTxt: '1000 lifetime kills' },
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
