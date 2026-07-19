import React, { useRef, useState, useEffect, useCallback } from 'react';
import { playSfx, startMusic, stopMusic, switchMusic, disposeAudio, setMuted, getMuted } from '../../lib/sound';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  loadUpgrades, loadStats, loadHat, addTeeth, recordRun, saveDailyBest,
  todayMod, dailySeed, HATS,
  saveRun, loadRun, clearRun, type Upgrades,
  recordDailyStreak, saveEndlessBest,
} from '../../lib/progress';
import { addQuestProgress, checkAchievements } from '../../lib/meta';
import Shop from '../../components/Shop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  skyTop: '#08060A',
  skyBot: '#100E18',
  ground: '#1A0A00',
  groundTop: '#2A1A04',
  treeCol: '#06080A',
  // Bill — comic look: black trucker cap w/ white roundel, sallow green skin
  billCap: '#3A2313',
  billCapBrim: '#241206',
  billJeans: '#1B65F5',
  billJeansDark: '#0F47C8',
  billBoots: '#2C1708',
  billHead: '#93A860',
  billBeard: '#33200E',
  billShirt: '#8B2020',
  billShirtDark: '#5A0A0A',
  billGlasses: '#1A1A1A',
  // Enemies
  zombie0Body: '#3E5A8A',   // torn blue "karaoke" tee
  zombie0Head: '#7FA84E',
  zombie1Body: '#5A4A38',   // overalls brown
  zombie1Head: '#8A9468',
  zombie2Body: '#3E6030',   // green "BITE ME" tee
  zombie2Head: '#6E9A44',
  cityCol: '#15101C',
  cityWindow: '#8A4A16',
  // UI
  blood: '#CC2200',
  dvdSilver: '#C8C8C8',
  dvdShine: '#E8E8E8',
  dvdHole: '#606060',
  gold: '#F5C842',
  goldDim: '#C5A028',
  thwack: '#FFEE44',
  hudBg: 'rgba(5,3,10,0.94)',
  hpGreen: '#27AE60',
  hpOrange: '#E67E22',
  hpRed: '#C0392B',
  btnBg: 'rgba(255,255,255,0.07)',
  btnActive: 'rgba(245,200,66,0.22)',
  btnBorder: 'rgba(255,255,255,0.12)',
  atkBtnBg: 'rgba(120,40,0,0.28)',
  atkBtnBorder: 'rgba(200,80,0,0.75)',
  starCol: 'rgba(255,255,200,0.6)',
  white: '#FFF',
  moonCol: '#C8A050',
  // Power-ups
  ketchupBody: '#CC1800',
  ketchupLabel: '#E8D8C8',
  ketchupCap: '#A01000',
  chiliBody: '#8B3A00',
  chiliTop: '#CC3A00',
  chiliSteam: '#B08060',
  micBody: '#C8C8D0',
  micGrill: '#8A8A94',
  micHandle: '#2A2A32',
  micGold: '#FFD24A',
  // Street furniture
  poleCol: '#23222A',
  lampGlow: '#FFD98A',
  crateCol: '#5A3A18',
  crateEdge: '#3A2408',
  carBody: '#4A3540',
  carDark: '#2A1C24',
  barricadeA: '#B8541A',
  barricadeB: '#3A3230',
  platformCol: '#3A3028',
  platformTop: '#5C4A34',
  // Heart / checkpoints / boss
  heart: '#FF3B5C',
  heartDark: '#C41E3E',
  cpFlag: '#35D07F',
  endFlagA: '#F2EFE6',
  endFlagB: '#1A1A1A',
  bossBody: '#4A1A2A',
  bossHead: '#5E7A34',
};

// ── Layout ────────────────────────────────────────────────────────────────────
const HUD_H = 60;
const CTRL_H = 148;
const WEB_TOP = Platform.OS === 'web' ? 67 : 0;
const WEB_BOT = Platform.OS === 'web' ? 34 : 0;
const GROUND_H = 52;

// ── Game constants ────────────────────────────────────────────────────────────
const TICK_MS = 33;
const PLAYER_W = 30;
const PLAYER_H = 52;
const HEAD_D = 21;
const HAT_H = 12;
const HAT_W = 30;
const PLAYER_SPD = 5.5;
// Variable jump: tap = short hop, hold = full height.
// While rising with the button held, gravity is lighter (floatier ascent);
// releasing early cuts upward velocity so the jump apexes immediately.
const JUMP_VY = -12.8;
const GRAV = 0.72;
const JUMP_HOLD_GRAV = 0.44;  // gravity while rising & button held
const JUMP_CUT = 0.45;        // vy multiplier on early release
const PLAYER_MAX_HP = 100;

// DVD / attack
const ATTACK_RANGE = 190;          // base range (further than before)
const KETCHUP_RANGE = SW * 0.95;   // spread: almost full screen
const ATTACK_DMG = 38;
const CHILI_DMG_MULT = 1.8;
const ATTACK_DUR = 340;
const CHILI_ATK_DUR = 155;         // rapid fire interval
const IFRAME_DUR = 900;
const DVD_LIFETIME = 520;

// Enemies
const ENEMY_W = 26;
const ENEMY_H = 50;
const ENEMY_HEAD_D = 19;
const ENEMY_SPD = 2.0;
const ENEMY_MAX_HP = 80;
const ENEMY_ATK_RANGE = 44;
const ENEMY_DMG = 12;
const ENEMY_ATK_CD = 1600;

// Zombie variety — 0: shambler, 1: tank, 2: runner, 3: spitter (ranged), 4: exploder
const ETYPE_STATS = [
  { spd: 2.0, hp: 80, dmg: 12, scale: 1 },
  { spd: 1.25, hp: 160, dmg: 20, scale: 1.16 },
  { spd: 3.1, hp: 45, dmg: 8, scale: 0.92 },
  { spd: 1.6, hp: 60, dmg: 10, scale: 0.98 },   // spitter: stops and lobs bile
  { spd: 2.7, hp: 35, dmg: 18, scale: 0.88 },   // exploder: detonates on death/contact
] as const;
const SPITTER_UNLOCK_WAVE = 4;
const EXPLODER_UNLOCK_WAVE = 6;
const SPIT_RANGE = 250;       // spitter stops here and shoots
const SPIT_CD = 2400;
const SPIT_SPD = 5.2;
const SPIT_LIFETIME = 1600;
const EXPLODE_RADIUS = 90;
const EXPLODE_DMG = 18;
// Zombies get slightly stronger every wave
const waveHpMult = (w: number) => 1 + (w - 1) * 0.06;
const waveSpdBoost = (w: number) => Math.min((w - 1) * 0.05, 1.0);

// Weapon progression — DVDs sharpen every boss cycle; vinyls unlock at wave 5
const dvdDmgForWave = (w: number) => ATTACK_DMG + Math.floor((w - 1) / 3) * 8;
const VINYL_UNLOCK_WAVE = 5;
const VINYL_EVERY = 3;          // every 3rd throw is a vinyl record
const VINYL_DMG_MULT = 1.6;
const VINYL_RANGE = SW * 0.95;  // vinyls fly nearly full-screen
const COMBO_BONUS = 50;         // extra points per additional kill in one throw

// Streak multiplier: kills without taking damage. +0.25x per 5 kills, capped at 3x.
const streakMult = (streak: number) => Math.min(3, 1 + Math.floor(streak / 5) * 0.25);
const STREAK_CALLOUTS: Record<number, string> = { 5: 'RAMPAGE!', 10: 'UNSTOPPABLE!', 20: 'ZOMBSLAYER!' };
const TEETH_PER_KILL = 1;
const TEETH_PER_BOSS = 10;

// Between-wave perks — pick 1 of 2, effects last the rest of the run
const PERKS = [
  { id: 'heal', name: 'HOT MEAL', desc: 'Heal 35 HP now', icon: 'restaurant' as const },
  { id: 'maxhp', name: 'THICK SKIN', desc: '+20 max HP', icon: 'shield' as const },
  { id: 'dmg', name: 'ANGRY DISCS', desc: '+15% damage', icon: 'flash' as const },
  { id: 'spd', name: 'GREASED BOOTS', desc: '+8% move speed', icon: 'walk' as const },
  { id: 'range', name: 'LONG ARM', desc: '+15% throw range', icon: 'resize' as const },
  { id: 'lucky', name: 'TOOTH FAIRY', desc: '+1 tooth per kill', icon: 'star' as const },
  { id: 'showman', name: 'SHOWMAN', desc: 'Hits halve your streak instead of resetting it', icon: 'mic' as const },
];

// Scoring / waves
const SCORE_PER_KILL = 100;
const WAVE_BONUS = 500;
const SPAWN_DIST = SW + 130;
const HS_KEY = 'zb_hs';

// Power-ups
const POWERUP_PICKUP_R = 38;     // pickup radius (world px)
const POWERUP_FIRST_SPAWN = 10000;
const POWERUP_RESPAWN = 18000;
const MIC_DURATION = 30000;      // mic mode: timed invincibility + speed
const MIC_SPEED_MULT = 1.75;
const HEART_HEAL = 50;           // heart power-up: restore HP

// Rounds / checkpoints / boss
const ROUND_LEN = 4000;          // world px per round; endpoint flag at the end
const BOSS_HP_BASE = 520;
const BOSS_HP_PER_WAVE = 45;
const BOSS_DMG = 26;
const BOSS_SPD = 1.35;
const BOSS_SCALE = 1.65;
const BOSS_SCORE = 1000;
const isBossWave = (w: number) => w > 1 && w % 3 === 0;

// ── Platforms & obstacles (world space) ──────────────────────────────────────
interface Solid { wx: number; w: number; h: number; kind: 'car' | 'crate' | 'barricade' | 'platform'; }

// Deterministic seeded RNG (LCG) — each round gets its own layout
function mkRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generate randomly-placed obstacles & floating platforms for one round.
 * Density scales with the wave number so later rounds are harder.
 * The first/last stretches of a round stay clear (spawn point & endpoint flag).
 */
function genRoundSolids(wave: number, roundStart: number): Solid[] {
  const r = mkRng(wave * 7919 + 104729);
  const solids: Solid[] = [];
  const from = roundStart + 260;
  const to = roundStart + ROUND_LEN - 260;

  // Ground obstacles — more of them each wave
  const nObs = Math.min(5 + Math.floor(wave * 1.2), 14);
  for (let i = 0; i < nObs; i++) {
    const kinds: Solid['kind'][] = ['car', 'crate', 'barricade'];
    const kind = kinds[Math.floor(r() * 3)];
    const wx = from + ((to - from) * (i + r() * 0.8)) / nObs;
    solids.push({
      wx,
      w: kind === 'car' ? 62 + r() * 14 : kind === 'crate' ? 26 + r() * 10 : 40 + r() * 12,
      h: kind === 'car' ? 24 + r() * 5 : kind === 'crate' ? 26 + r() * 8 : 15 + r() * 5,
      kind,
    });
  }

  // Floating platforms — count also scales with wave
  const nPlat = Math.min(4 + Math.floor(wave * 0.8), 11);
  for (let i = 0; i < nPlat; i++) {
    const wx = from + 120 + ((to - from - 240) * (i + r() * 0.7)) / nPlat;
    solids.push({
      wx,
      w: 78 + r() * 34,
      h: 60 + r() * 34,
      kind: 'platform',
    });
  }
  return solids;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Enemy {
  id: string;
  etype: 0 | 1 | 2 | 3 | 4;
  wx: number;
  hp: number;
  maxHp: number;
  atkCd: number;
  dead: boolean;
  fade: number;
  step: number;
  boss: boolean;
  charger: boolean;  // boss variant: bursts of speed
  summoner: boolean; // boss variant: raises walkers mid-fight
  summonCd: number;
  spitCd: number;    // spitter shot cooldown
  exploded: boolean; // exploder already detonated (no double boom)
  spd: number;
  dmg: number;
  scale: number;
}

interface SpitGlob {
  id: string;
  wx: number;
  dir: number;
  t: number;
}

interface DVDProj {
  id: string;
  wx: number;
  dir: number;
  t: number;
  yOff: number;   // screen-Y offset from body center (for spread)
  vinyl?: boolean; // vinyl record: bigger, harder, flies further
}

interface HitEffect {
  id: string;
  wx: number;
  t: number;
  text: string;
}

interface Powerup {
  id: string;
  type: 'ketchup' | 'chili' | 'mic' | 'heart';
  wx: number;
  bobT: number;  // for idle float animation
}

interface GS {
  phase: 'playing' | 'paused' | 'intermission' | 'dead';
  wx: number;
  vy: number;
  ay: number;
  grounded: boolean;
  jumpCut: boolean;   // true once the variable-jump boost is spent
  faceR: boolean;
  hp: number;
  atkActive: boolean;
  atkT: number;
  iframeT: number;
  dmgFlash: number;
  step: number;
  enemies: Enemy[];
  dvds: DVDProj[];
  globs: SpitGlob[];   // spitter projectiles
  hitEffects: HitEffect[];
  powerups: Powerup[];
  activePowerup: 'ketchup' | 'chili' | null;
  micT: number;        // timed mic mode: invincible + fast
  puCount: number;     // rotates powerup spawn types
  powerupSpawnT: number;
  roundStart: number;  // world x where the current round began
  checkpointHit: boolean;
  cpMsg: number;       // "CHECKPOINT!" banner timer
  kills: number;       // total zombies killed this run
  hitsTaken: number;   // total hits taken this run
  roundKills: number;  // zombies killed this round
  roundHits: number;   // hits taken this round
  roundScore: number;  // score at the start of this round
  nextId: number;
  score: number;
  wave: number;
  spawnQ: number;
  spawnT: number;
  spawnMarks: number[]; // world-x thresholds that each release one zombie
  cpBurst: number;      // zombies released when the checkpoint is crossed
  solids: Solid[];      // this round's randomly generated obstacles & platforms
  throwCount: number;   // for vinyl cadence
  shakeT: number;       // screen shake timer (boss impacts)
  hintT: number;        // first-run tutorial hint timer
  roundTotal: number;   // total zombies in this round (for HUD progress)
  // Progression / upgrades (loaded from storage at mount)
  maxHp: number;
  upgDmg: number;       // flat DVD damage bonus from shop upgrades
  upgMic: number;       // extra mic-mode ms from shop upgrades
  // Run-scoped perk effects (picked between waves)
  dmgMult: number;
  spdMult: number;
  rangeMult: number;    // throw range multiplier (LONG ARM perk)
  teethBonus: number;   // extra teeth per kill (TOOTH FAIRY perk / gold hat)
  streakSave: boolean;  // SHOWMAN perk: hits halve streak instead of resetting
  // Streak / currency / juice
  streak: number;       // kills since last hit taken
  maxStreak: number;    // best streak this run (achievements)
  teeth: number;        // currency earned this run
  teethBanked: number;  // portion of `teeth` already persisted to storage
  killsBanked: number;  // portion of `kills` already recorded to lifetime stats
  bossBanked: number;   // portion of `bossKills` already recorded to lifetime stats
  bossKills: number;
  slowmoT: number;      // slow-motion timer after boss kills
  // Quest / achievement tracking (banked with deltas like teeth/kills)
  runnerKills: number;
  runnerBanked: number;
  noHitWaves: number;   // waves cleared without taking a hit this run
  noHitBanked: number;
  // Endless mode: no intermissions, auto-perks, separate best score
  endless: boolean;
  // Daily challenge modifiers
  daily: boolean;
  forceRunners: boolean;
  hpMult: number;
  noCheckpoints: boolean;
  seedOffset: number;   // shifts layout RNG for daily runs
  waveMsg: number;
}

// ── Game logic ────────────────────────────────────────────────────────────────
/**
 * Split a wave's zombie count into: a small opening group, progress-triggered
 * spawns staggered across the round, and a burst released at the checkpoint.
 */
function planWaveSpawns(cnt: number, roundStart: number) {
  const initial = Math.max(2, Math.ceil(cnt * 0.3));
  const burst = Math.max(1, Math.ceil(cnt * 0.25));
  const nMarks = Math.max(0, cnt - initial - burst);
  const marks: number[] = [];
  const from = roundStart + 350;
  const to = roundStart + ROUND_LEN - 350;
  for (let i = 0; i < nMarks; i++) {
    marks.push(from + ((to - from) * (i + 1)) / (nMarks + 1));
  }
  return { initial, marks, burst };
}

function mkGS(): GS {
  return {
    phase: 'playing',
    wx: 0, vy: 0, ay: 0, grounded: true, jumpCut: true, faceR: true,
    hp: PLAYER_MAX_HP,
    atkActive: false, atkT: 0, iframeT: 0, dmgFlash: 0, step: 0,
    enemies: [], dvds: [], globs: [], hitEffects: [],
    powerups: [], activePowerup: null,
    micT: 0, puCount: 0,
    powerupSpawnT: POWERUP_FIRST_SPAWN,
    roundStart: 0, checkpointHit: false, cpMsg: 0,
    kills: 0, hitsTaken: 0, roundKills: 0, roundHits: 0, roundScore: 0,
    nextId: 0,
    score: 0, wave: 1,
    ...(() => {
      const plan = planWaveSpawns(8, 0);
      return { spawnQ: plan.initial, spawnT: 1000, spawnMarks: plan.marks, cpBurst: plan.burst };
    })(),
    solids: genRoundSolids(1, 0),
    throwCount: 0, shakeT: 0, hintT: 7500, roundTotal: 8,
    maxHp: PLAYER_MAX_HP, upgDmg: 0, upgMic: 0,
    dmgMult: 1, spdMult: 1, rangeMult: 1, teethBonus: 0, streakSave: false,
    streak: 0, maxStreak: 0, teeth: 0, teethBanked: 0, killsBanked: 0, bossBanked: 0, bossKills: 0, slowmoT: 0,
    runnerKills: 0, runnerBanked: 0, noHitWaves: 0, noHitBanked: 0,
    endless: false,
    daily: false, forceRunners: false, hpMult: 1, noCheckpoints: false, seedOffset: 0,
    waveMsg: 2500,
  };
}

function spawnEnemy(g: GS, boss = false, forceType?: 0 | 1 | 2 | 3 | 4, nearWx?: number) {
  const side = g.nextId % 2 === 0 ? 1 : -1;
  g.nextId++;
  const jitter = (g.nextId % 5) * 40;
  // Mix: base 3 types, spitters join at wave 4+, exploders at wave 6+
  let etype: 0 | 1 | 2 | 3 | 4;
  if (forceType !== undefined) etype = forceType;
  else if (g.forceRunners) etype = 2;
  else {
    const poolSize = g.wave >= EXPLODER_UNLOCK_WAVE ? 5 : g.wave >= SPITTER_UNLOCK_WAVE ? 4 : 3;
    etype = (g.nextId % poolSize) as 0 | 1 | 2 | 3 | 4;
  }
  // Boss variety rotates each boss wave: brute → charger → summoner
  const bossKind = boss ? Math.floor(g.wave / 3) % 3 : -1;
  const charger = bossKind === 1;
  const summoner = bossKind === 2;
  const stats = ETYPE_STATS[etype];
  const hp = boss
    ? Math.round((BOSS_HP_BASE + g.wave * BOSS_HP_PER_WAVE) * (charger ? 0.7 : summoner ? 0.85 : 1))
    : Math.round(stats.hp * waveHpMult(g.wave) * g.hpMult);
  g.enemies.push({
    id: `e${g.nextId}`, etype,
    wx: nearWx !== undefined ? nearWx : g.wx + side * (SPAWN_DIST + jitter),
    hp, maxHp: hp,
    atkCd: 600, dead: false, fade: 1, step: 0, boss, charger, summoner,
    summonCd: 4000, spitCd: 1200, exploded: false,
    spd: boss ? BOSS_SPD : stats.spd + waveSpdBoost(g.wave),
    dmg: boss ? (charger ? 20 : BOSS_DMG) : stats.dmg,
    scale: boss ? (charger ? 1.45 : BOSS_SCALE) : stats.scale,
  });
}

// Fire-and-forget haptic buzz — no-ops safely on web
function buzz(style: Haptics.ImpactFeedbackStyle) {
  try { Haptics.impactAsync(style).catch(() => {}); } catch {}
}

/** Apply a between-wave perk by id (also used by endless auto-perks). */
function applyPerk(g: GS, id: string) {
  if (id === 'heal') g.hp = Math.min(g.maxHp, g.hp + 35);
  else if (id === 'maxhp') { g.maxHp += 20; g.hp += 20; }
  else if (id === 'dmg') g.dmgMult *= 1.15;
  else if (id === 'spd') g.spdMult *= 1.08;
  else if (id === 'range') g.rangeMult *= 1.15;
  else if (id === 'lucky') g.teethBonus += 1;
  else if (id === 'showman') g.streakSave = true;
}

/**
 * Bank quest progress + check achievements. Runner/no-hit deltas are computed
 * and marked banked here; kill/boss/teeth deltas are passed in by the caller
 * (they share banking with lifetime stats). Returns newly unlocked badges.
 */
async function bankQuestAch(g: GS, killDelta: number, bossDelta: number, teethDelta: number) {
  const runnerDelta = g.runnerKills - g.runnerBanked;
  g.runnerBanked = g.runnerKills;
  const nohitDelta = g.noHitWaves - g.noHitBanked;
  g.noHitBanked = g.noHitWaves;
  await addQuestProgress({
    kills: killDelta, boss: bossDelta, teeth: teethDelta,
    runners: runnerDelta, nohit: nohitDelta, wave: g.wave,
  });
  const s = await loadStats();
  return checkAchievements({
    runKills: g.kills, runTeeth: g.teeth, maxStreak: g.maxStreak,
    noHitWaves: g.noHitWaves, wave: g.wave,
    lifetimeKills: s.kills, lifetimeBosses: s.bosses,
  });
}

/** Shared kill bookkeeping: streak-multiplied score, teeth, callouts, boss slow-mo. */
function registerKill(g: GS, e: Enemy) {
  g.score += Math.round((e.boss ? BOSS_SCORE : SCORE_PER_KILL) * streakMult(g.streak));
  g.kills++; g.roundKills++;
  if (!e.boss && e.etype === 2) g.runnerKills++;
  g.streak++;
  if (g.streak > g.maxStreak) g.maxStreak = g.streak;
  const callout = STREAK_CALLOUTS[g.streak];
  if (callout) g.hitEffects.push({ id: `h${++g.nextId}`, wx: g.wx, t: 0, text: callout });
  if (e.boss) {
    g.teeth += TEETH_PER_BOSS + g.teethBonus;
    g.bossKills++;
    g.slowmoT = 900;  // savor the moment
    g.shakeT = 420;
    g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: `+${TEETH_PER_BOSS} 🦷` });
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
  } else {
    g.teeth += TEETH_PER_KILL + g.teethBonus;
    buzz(Haptics.ImpactFeedbackStyle.Light);
  }
  // Exploders detonate on death — dodge the blast!
  if (!e.boss && e.etype === 4 && !e.exploded) {
    e.exploded = true;
    g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: 'BOOM!' });
    g.shakeT = Math.max(g.shakeT, 260);
    if (Math.abs(e.wx - g.wx) < EXPLODE_RADIUS && g.iframeT <= 0 && g.micT <= 0) {
      damagePlayer(g, EXPLODE_DMG, false);
    }
  }
}

/** Shared player-damage bookkeeping (enemy hits, spit globs, explosions). */
function damagePlayer(g: GS, dmg: number, fromBoss: boolean) {
  g.hp -= dmg;
  g.hitsTaken++; g.roundHits++;
  g.streak = g.streakSave ? Math.floor(g.streak / 2) : 0;
  g.iframeT = IFRAME_DUR;
  g.dmgFlash = 280;
  if (fromBoss) g.shakeT = 340;
  g.activePowerup = null; // losing the power-up is the price of getting hit
  buzz(Haptics.ImpactFeedbackStyle.Medium);
  if (g.hp <= 0) { g.hp = 0; g.phase = 'dead'; playSfx('gameover'); return; }
  playSfx('hurt');
}

function gameTick(g: GS, holdL: boolean, holdR: boolean, holdJ: boolean) {
  if (g.phase !== 'playing') return;

  // Boss-kill slow-mo: run the world at half speed by skipping alternate ticks
  if (g.slowmoT > 0) {
    g.slowmoT -= TICK_MS;
    if (Math.floor(g.slowmoT / TICK_MS) % 2 === 0) return;
  }

  // Player movement (mic mode = speed boost)
  const spd = (g.micT > 0 ? PLAYER_SPD * MIC_SPEED_MULT : PLAYER_SPD) * g.spdMult;
  const prevWx = g.wx;
  if (holdL) { g.wx -= spd; g.faceR = false; }
  if (holdR) { g.wx += spd; g.faceR = true; }
  if ((holdL || holdR) && g.grounded) g.step += TICK_MS;

  // Progress-triggered spawns: crossing each mark releases another zombie
  while (g.spawnMarks.length > 0 && g.wx >= g.spawnMarks[0]) {
    g.spawnMarks.shift();
    g.spawnQ++;
  }

  // The endpoint flag is a wall until every zombie in the wave is dead
  const anyAlive =
    g.spawnQ > 0 || g.spawnMarks.length > 0 || g.cpBurst > 0 || g.enemies.some(e => !e.dead);
  const endX = g.roundStart + ROUND_LEN;
  if (anyAlive && g.wx > endX - 24) g.wx = endX - 24;

  // Obstacles block walking (jump over them, or hop on top).
  // Swept: resolve to the side the player came from, so a fast move can't
  // tunnel through or teleport across an obstacle.
  for (const s of g.solids) {
    if (s.kind === 'platform') continue;
    const half = s.w / 2 + PLAYER_W / 2 - 4;
    if (Math.abs(g.wx - s.wx) < half && g.ay < s.h - 3) {
      g.wx = s.wx + (prevWx >= s.wx ? half : -half);
    }
  }

  // Vertical physics — land on ground, obstacles, or floating platforms.
  // Variable jump height: holding JUMP while rising floats (lighter gravity);
  // releasing early cuts the ascent so tap = short hop, hold = full jump.
  const prevAy = g.ay;
  if (g.vy < 0 && !g.jumpCut && !holdJ) {
    g.vy *= JUMP_CUT;
    g.jumpCut = true;
  }
  g.vy += g.vy < 0 && !g.jumpCut && holdJ ? JUMP_HOLD_GRAV : GRAV;
  g.ay -= g.vy;
  let supportH = 0;
  for (const s of g.solids) {
    if (Math.abs(g.wx - s.wx) < s.w / 2 + PLAYER_W / 2 - 6 && prevAy >= s.h - 2) {
      supportH = Math.max(supportH, s.h);
    }
  }
  if (g.ay <= supportH && g.vy >= 0) { g.ay = supportH; g.vy = 0; g.grounded = true; }
  else g.grounded = false;

  // Timers
  if (g.atkT > 0) { g.atkT -= TICK_MS; if (g.atkT <= 0) g.atkActive = false; }
  if (g.iframeT > 0) g.iframeT -= TICK_MS;
  if (g.dmgFlash > 0) g.dmgFlash -= TICK_MS;
  if (g.waveMsg > 0) g.waveMsg -= TICK_MS;
  if (g.cpMsg > 0) g.cpMsg -= TICK_MS;
  if (g.shakeT > 0) g.shakeT -= TICK_MS;
  if (g.hintT > 0) g.hintT -= TICK_MS;
  if (g.micT > 0) {
    g.micT -= TICK_MS;
    if (g.micT <= 0) { g.micT = 0; switchMusic('bluegrass'); }
  }

  // Midway checkpoint — crossing it restores full health (once per round)
  if (!g.noCheckpoints && !g.checkpointHit && g.wx >= g.roundStart + ROUND_LEN / 2) {
    g.checkpointHit = true;
    g.hp = g.maxHp;
    g.dmgFlash = 0;
    g.cpMsg = 2200;
    // Checkpoint ambush — release the reserved burst of zombies
    g.spawnQ += g.cpBurst;
    g.cpBurst = 0;
    playSfx('powerup');
  }

  // Power-ups persist until Bill takes damage (cleared in enemy attack block)

  // Power-up spawn
  g.powerupSpawnT -= TICK_MS;
  if (g.powerupSpawnT <= 0 && g.powerups.length < 2) {
    const side = g.nextId % 2 === 0 ? 1 : -1;
    // Rotate ketchup → chili → mic → heart
    const type = (['ketchup', 'chili', 'mic', 'heart'] as const)[g.puCount % 4];
    g.puCount++;
    g.powerups.push({
      id: `pu${++g.nextId}`, type,
      wx: g.wx + side * (SW * 0.35 + 40),
      bobT: 0,
    });
    g.powerupSpawnT = POWERUP_RESPAWN;
  }

  // Power-up bob + pickup
  const remaining: Powerup[] = [];
  for (const p of g.powerups) {
    p.bobT += TICK_MS;
    if (Math.abs(p.wx - g.wx) < POWERUP_PICKUP_R && g.ay < 10) {
      // Picked up
      if (p.type === 'mic') {
        g.micT = MIC_DURATION + g.upgMic;
        switchMusic('rockabilly');
      } else if (p.type === 'heart') {
        g.hp = Math.min(g.maxHp, g.hp + HEART_HEAL);
        g.dmgFlash = 0;
        g.iframeT = Math.max(g.iframeT, 400);
      } else {
        g.activePowerup = p.type;
      }
      playSfx('powerup');
    } else {
      remaining.push(p);
    }
  }
  g.powerups = remaining;

  // DVDs
  g.dvds = g.dvds.filter(d => d.t < DVD_LIFETIME);
  for (const d of g.dvds) { d.wx += d.dir * 8; d.t += TICK_MS; }

  // Spit globs — spitter projectiles fly flat and burst on Bill
  const keepGlobs: SpitGlob[] = [];
  for (const gl of g.globs) {
    gl.wx += gl.dir * SPIT_SPD;
    gl.t += TICK_MS;
    if (gl.t >= SPIT_LIFETIME) continue;
    if (Math.abs(gl.wx - g.wx) < 22 && g.ay < 34) {
      // Hit Bill (jumping over globs dodges them)
      if (g.iframeT <= 0 && g.micT <= 0) {
        g.hitEffects.push({ id: `h${++g.nextId}`, wx: g.wx, t: 0, text: 'SPLAT!' });
        damagePlayer(g, ETYPE_STATS[3].dmg, false);
        if (g.phase !== 'playing') return;
      }
      continue;
    }
    keepGlobs.push(gl);
  }
  g.globs = keepGlobs;

  // Hit effects
  g.hitEffects = g.hitEffects.filter(h => h.t < 750);
  for (const h of g.hitEffects) h.t += TICK_MS;

  // Enemies
  const keepE: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.dead) { e.fade -= 0.032; if (e.fade > 0) keepE.push(e); continue; }
    const dx = g.wx - e.wx;
    const dir = dx >= 0 ? 1 : -1;
    const dist = Math.abs(dx);

    // Charger boss lunges in bursts; everyone else uses their own speed stat
    let eSpd = e.spd;
    if (e.boss && e.charger) eSpd = e.step % 3400 < 1000 ? e.spd * 2.6 : e.spd * 0.75;
    const eReach = e.boss ? ENEMY_ATK_RANGE + 16 : ENEMY_ATK_RANGE;
    // Spitters keep their distance and lob bile instead of closing in
    const isSpitter = !e.boss && e.etype === 3;
    if (isSpitter) {
      if (dist > SPIT_RANGE) { e.wx += dir * eSpd; e.step += TICK_MS; }
      e.spitCd -= TICK_MS;
      if (dist <= SPIT_RANGE + 60 && e.spitCd <= 0) {
        e.spitCd = SPIT_CD;
        g.globs.push({ id: `gl${++g.nextId}`, wx: e.wx + dir * 14, dir, t: 0 });
        playSfx('throw');
      }
    } else if (dist > eReach - 4) { e.wx += dir * eSpd; e.step += TICK_MS; }

    // Summoner boss raises extra walkers mid-fight
    if (e.boss && e.summoner) {
      e.summonCd -= TICK_MS;
      const minions = g.enemies.filter(x => !x.dead && !x.boss).length;
      if (e.summonCd <= 0 && minions < 5) {
        e.summonCd = 5200;
        spawnEnemy(g, false, 0, e.wx + (e.wx > g.wx ? 60 : -60));
        g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: 'RISE!' });
      }
    }

    // Mic mode: any regular zombie that touches Bill gets fried instantly.
    // Bosses are immune to the touch-kill — they must be damaged with weapons.
    if (g.micT > 0 && !e.boss && dist < eReach + 4) {
      e.dead = true; e.fade = 1;
      registerKill(g, e);
      g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: 'FRIED!' });
      playSfx('hit');
      keepE.push(e);
      continue;
    }

    if (e.atkCd > 0) e.atkCd -= TICK_MS;
    if (!isSpitter && dist < eReach && e.atkCd <= 0 && g.iframeT <= 0 && g.micT <= 0) {
      e.atkCd = ENEMY_ATK_CD;
      // Exploders self-destruct on contact instead of clawing
      if (!e.boss && e.etype === 4 && !e.exploded) {
        e.exploded = true;
        e.dead = true; e.fade = 1;
        g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: 'BOOM!' });
        g.shakeT = Math.max(g.shakeT, 260);
      }
      damagePlayer(g, e.dmg, e.boss);
      if (g.phase !== 'playing') return;
    }
    keepE.push(e);
  }
  g.enemies = keepE;

  // Wave system
  const alive = g.enemies.filter(e => !e.dead).length;
  if (g.spawnQ > 0) {
    g.spawnT -= TICK_MS;
    if (g.spawnT <= 0) { spawnEnemy(g); g.spawnQ--; g.spawnT = 800; }
  } else if (alive === 0 && g.spawnMarks.length === 0 && g.cpBurst === 0) {
    // Zombies cleared — crossing the endpoint flag ends the round
    if (g.wx >= g.roundStart + ROUND_LEN - 12) {
      g.score += WAVE_BONUS;
      g.phase = 'intermission';
      playSfx('powerup');
      // Flawless wave? Counts toward bounties & achievements
      if (g.roundHits === 0) g.noHitWaves++;
      // Bank teeth + autosave the run at every wave clear.
      // The snapshot is ALWAYS this pre-perk intermission state — it is the
      // single canonical resume point (SAVE & QUIT never writes its own).
      const unbanked = g.teeth - g.teethBanked;
      if (unbanked > 0) g.teethBanked = g.teeth;
      // Bank lifetime stats too — kills/bosses/best-wave must not require
      // dying to count. Deltas only, so nothing double-records.
      const killDelta = g.kills - g.killsBanked;
      const bossDelta = g.bossKills - g.bossBanked;
      g.killsBanked = g.kills;
      g.bossBanked = g.bossKills;
      const reachedWave = g.wave + 1; // clearing wave N means you've reached N+1
      const snap = (g.daily || g.endless) ? null : {
        wave: g.wave, hp: g.hp, maxHp: g.maxHp, score: g.score,
        kills: g.kills, hits: g.hitsTaken, bossKills: g.bossKills,
        teeth: g.teeth, dmgMult: g.dmgMult, spdMult: g.spdMult,
        upgDmg: g.upgDmg, upgMic: g.upgMic, streak: g.streak,
        rangeMult: g.rangeMult, teethBonus: g.teethBonus, streakSave: g.streakSave,
        maxStreak: g.maxStreak, runnerKills: g.runnerKills, noHitWaves: g.noHitWaves,
      };
      (async () => {
        if (unbanked > 0) await addTeeth(unbanked);
        await recordRun(killDelta, bossDelta, reachedWave);
        if (snap) await saveRun(snap);
        const fresh = await bankQuestAch(g, killDelta, bossDelta, unbanked);
        for (const a of fresh) {
          g.hitEffects.push({ id: `h${++g.nextId}`, wx: g.wx, t: 0, text: `🏅 ${a.name}!` });
        }
      })();
      // Endless mode: no intermission — grab a random perk and keep rolling
      if (g.endless) {
        const r = mkRng(g.wave * 131 + 77);
        const p = PERKS[Math.floor(r() * PERKS.length)];
        applyPerk(g, p.id);
        g.hitEffects.push({ id: `h${++g.nextId}`, wx: g.wx, t: 0, text: `⚡ ${p.name}!` });
        startNextWave(g);
      }
    }
  }
}

/** Called from the intermission screen's NEXT WAVE button. */
function startNextWave(g: GS) {
  if (g.phase !== 'intermission') return; // guard against rapid double-taps
  g.phase = 'playing';
  g.wave++;
  g.roundStart += ROUND_LEN;
  g.checkpointHit = false;
  g.roundKills = 0;
  g.roundHits = 0;
  g.roundScore = g.score;
  const cnt = Math.min(8 + (g.wave - 1) * 3, 28);
  // Boss waves: a hulking boss plus a slightly thinner horde
  const horde = isBossWave(g.wave) ? Math.max(2, cnt - 3) : cnt;
  g.roundTotal = horde + (isBossWave(g.wave) ? 1 : 0);
  if (isBossWave(g.wave)) spawnEnemy(g, true);
  const plan = planWaveSpawns(horde, g.roundStart);
  g.spawnQ = plan.initial;
  g.spawnMarks = plan.marks;
  g.cpBurst = plan.burst;
  g.solids = genRoundSolids(g.wave + g.seedOffset, g.roundStart);
  g.spawnT = 800;
  g.waveMsg = 2500;
  g.dvds = [];
  g.globs = [];
  g.hitEffects = g.endless ? g.hitEffects : [];
  g.phase = 'playing';
}

function doJump(g: GS) {
  if (g.grounded) { g.vy = JUMP_VY; g.grounded = false; g.jumpCut = false; }
}

function doAttack(g: GS) {
  const isChili = g.activePowerup === 'chili';
  const isKetchup = g.activePowerup === 'ketchup';
  const atkDur = isChili ? CHILI_ATK_DUR : ATTACK_DUR;

  // Allow rapid fire when chili active (just check short cooldown)
  if (g.atkActive && g.atkT > (isChili ? 80 : 0)) return;

  g.atkActive = true;
  g.atkT = atkDur;

  const dir = g.faceR ? 1 : -1;
  // Vinyl records: unlocked at wave 5, every 3rd throw — longer range, harder hit
  g.throwCount++;
  const vinyl = !isKetchup && g.wave >= VINYL_UNLOCK_WAVE && g.throwCount % VINYL_EVERY === 0;
  const range = (isKetchup ? KETCHUP_RANGE : vinyl ? VINYL_RANGE : ATTACK_RANGE) * g.rangeMult;
  const dmg = Math.round(
    (dvdDmgForWave(g.wave) + g.upgDmg) * g.dmgMult *
    (isChili ? CHILI_DMG_MULT : 1) * (vinyl ? VINYL_DMG_MULT : 1)
  );

  if (isKetchup) {
    // Spread shot: 3 DVDs at different Y offsets
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: -22 });
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: 0 });
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: 22 });
  } else {
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 18, dir, t: 0, yOff: 0, vinyl });
  }
  playSfx('throw');

  // Hit enemies in range
  let hitCount = 0;
  let killCount = 0;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = (e.wx - g.wx) * dir;
    if (dx >= -8 && dx < range) {
      e.hp -= dmg;
      hitCount++;
      if (e.boss) g.shakeT = Math.max(g.shakeT, 200); // boss impacts shake the screen
      else e.wx += dir * 16; // knockback for regular zombies
      const hitTxt = vinyl ? 'SCRRRATCH!' : hitCount > 1 ? 'THWACK!' : dx < range * 0.45 ? 'THWACK!' : 'WHIZZZ!';
      g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: hitTxt });
      if (e.hp <= 0) {
        e.dead = true; e.fade = 1;
        registerKill(g, e);
        killCount++;
      }
    }
  }
  // Multi-kill combo bonus
  if (killCount >= 2) {
    g.score += COMBO_BONUS * (killCount - 1);
    g.hitEffects.push({ id: `h${++g.nextId}`, wx: g.wx + dir * 60, t: 0, text: `COMBO x${killCount}!` });
  }
  if (hitCount > 0) playSfx('hit');
}

// ── Background themes ──────────────────────────────────────────────────────────
// Rotates after every boss fight (every 3rd wave): night → day → sunset → dawn
interface Theme {
  skyTop: string; skyBot: string; ground: string; groundTop: string;
  tree: string; city: string; hill: string;
  glowA: string; glowB: string; glowC: string;
  orb: string; orbGlow: string;   // moon or sun
  day: boolean;                    // day themes hide stars & neon glow
}
const THEMES: Theme[] = [
  { // Night city (original)
    skyTop: '#08060A', skyBot: '#100E18', ground: '#1A0A00', groundTop: '#2A1A04',
    tree: '#06080A', city: '#15101C', hill: '#0C1008',
    glowA: '#6A2C10', glowB: '#93401A', glowC: '#C05A18',
    orb: '#C8A050', orbGlow: '#D4C060', day: false,
  },
  { // Overcast day — washed-out apocalypse daylight
    skyTop: '#8FA3B0', skyBot: '#C2CDD2', ground: '#4A3A22', groundTop: '#6A5432',
    tree: '#3A4438', city: '#5E6B74', hill: '#55604E',
    glowA: '#D8D2B8', glowB: '#E2DCC2', glowC: '#EAE4CA',
    orb: '#F2E8C8', orbGlow: '#FFF8D8', day: true,
  },
  { // Blood sunset
    skyTop: '#2A0E14', skyBot: '#5E1A18', ground: '#241004', groundTop: '#3A2008',
    tree: '#180A0C', city: '#2E1218', hill: '#221010',
    glowA: '#8A2A10', glowB: '#C04A14', glowC: '#F07020',
    orb: '#FF7A30', orbGlow: '#FF9A50', day: false,
  },
  { // Sickly green dawn
    skyTop: '#0E1810', skyBot: '#22301E', ground: '#141A08', groundTop: '#28300E',
    tree: '#0A120A', city: '#182014', hill: '#12200E',
    glowA: '#3A5A20', glowB: '#587A2A', glowC: '#7A9A38',
    orb: '#D8E890', orbGlow: '#E8F8B0', day: false,
  },
];
const themeForWave = (w: number) => THEMES[Math.floor((w - 1) / 3) % THEMES.length];

// ── Background constants ───────────────────────────────────────────────────────
const TREES = Array.from({ length: 70 }, (_, i) => ({
  wx: (i - 35) * 195 + (i % 7) * 38 - (i % 3) * 22,
  h: 88 + (i % 5) * 24,
  w: 16 + (i % 4) * 7,
}));

const STARS = Array.from({ length: 45 }, (_, i) => ({
  x: ((i * 137) % SW),
  y: ((i * 79) % 130 + 8),
  r: i % 4 === 0 ? 1.5 : 0.9,
}));

const ENEMY_COLS = [
  { body: C.zombie0Body, head: C.zombie0Head, shirt: '#3A4C30', pants: '#2E2A26' },
  { body: C.zombie1Body, head: C.zombie1Head, shirt: '#443830', pants: '#3A4A5A' },
  { body: C.zombie2Body, head: C.zombie2Head, shirt: '#2A3820', pants: '#2A2018' },
  { body: '#5A7A2A', head: '#9AC24A', shirt: '#3E5A1A', pants: '#2E3A14' },   // spitter: sickly bright green
  { body: '#8A3A14', head: '#C46A2A', shirt: '#6A2408', pants: '#3A1404' },   // exploder: volatile orange
] as const;

// Ruined city silhouette (far parallax layer, like the comic backdrops)
const CITY = Array.from({ length: 30 }, (_, i) => ({
  wx: (i - 15) * 250 + (i % 5) * 55,
  h: 62 + (i % 6) * 24,
  w: 36 + (i % 4) * 16,
  broken: i % 3 === 0, // jagged / collapsed top
}));

// Street lights — flicker on/off (some are dead)
const STREETLIGHTS = Array.from({ length: 26 }, (_, i) => ({
  wx: (i - 13) * 520 + 60,
  broken: i % 4 === 0,
}));

// Neon bar signs on the midground buildings
const NEONS = [
  { wx: -3600, text: 'LIVE MUSIC', col: '#C46BFF', h: 96 },
  { wx: -2200, text: 'MOTEL', col: '#FFB020', h: 118 },
  { wx: -900, text: 'BAR', col: '#FF2E88', h: 88 },
  { wx: 350, text: 'KARAOKE', col: '#28E0FF', h: 108 },
  { wx: 1600, text: 'EAT', col: '#7CFF3A', h: 92 },
  { wx: 2900, text: 'BAR', col: '#FF2E88', h: 120 },
  { wx: 4300, text: 'DINER', col: '#FF5030', h: 100 },
];

// Powerup icons (drawn with View shapes)
function KetchupIcon({ size = 1, opacity = 1 }: { size?: number; opacity?: number }) {
  const s = size;
  return (
    <View style={{ width: 18 * s, height: 38 * s, alignItems: 'center', opacity }}>
      {/* Cap */}
      <View style={{ width: 10 * s, height: 5 * s, backgroundColor: C.ketchupCap, borderTopLeftRadius: 3 * s, borderTopRightRadius: 3 * s }} />
      {/* Neck */}
      <View style={{ width: 7 * s, height: 5 * s, backgroundColor: C.ketchupBody }} />
      {/* Shoulder */}
      <View style={{ width: 14 * s, height: 4 * s, backgroundColor: C.ketchupBody, borderRadius: 2 * s }} />
      {/* Label */}
      <View style={{ width: 16 * s, height: 14 * s, backgroundColor: C.ketchupLabel, borderRadius: 2 * s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12 * s, height: 2 * s, backgroundColor: C.ketchupBody, borderRadius: 1, marginBottom: 2 * s }} />
        <View style={{ width: 8 * s, height: 2 * s, backgroundColor: C.ketchupBody, borderRadius: 1 }} />
      </View>
      {/* Base */}
      <View style={{ width: 16 * s, height: 6 * s, backgroundColor: C.ketchupBody, borderBottomLeftRadius: 3 * s, borderBottomRightRadius: 3 * s }} />
    </View>
  );
}

function ChiliBowlIcon({ size = 1, opacity = 1 }: { size?: number; opacity?: number }) {
  const s = size;
  return (
    <View style={{ width: 36 * s, height: 30 * s, alignItems: 'center', opacity }}>
      {/* Steam lines */}
      <View style={{ flexDirection: 'row', gap: 4 * s, marginBottom: 2 * s }}>
        <View style={{ width: 2 * s, height: 6 * s, backgroundColor: C.chiliSteam, borderRadius: 1, opacity: 0.7 }} />
        <View style={{ width: 2 * s, height: 8 * s, backgroundColor: C.chiliSteam, borderRadius: 1, opacity: 0.7 }} />
        <View style={{ width: 2 * s, height: 6 * s, backgroundColor: C.chiliSteam, borderRadius: 1, opacity: 0.7 }} />
      </View>
      {/* Bowl */}
      <View style={{ width: 34 * s, height: 6 * s, backgroundColor: C.chiliTop, borderRadius: 3 * s }} />
      <View style={{ width: 34 * s, height: 14 * s, backgroundColor: C.chiliBody, borderBottomLeftRadius: 8 * s, borderBottomRightRadius: 8 * s }} />
    </View>
  );
}

function MicIcon({ size = 1, opacity = 1 }: { size?: number; opacity?: number }) {
  const s = size;
  return (
    <View style={{ width: 20 * s, height: 38 * s, alignItems: 'center', opacity }}>
      {/* Ball head */}
      <View style={{
        width: 18 * s, height: 18 * s, borderRadius: 9 * s,
        backgroundColor: C.micBody, alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Grill lines */}
        <View style={{ width: 12 * s, height: 1.6 * s, backgroundColor: C.micGrill, marginBottom: 2 * s }} />
        <View style={{ width: 14 * s, height: 1.6 * s, backgroundColor: C.micGrill, marginBottom: 2 * s }} />
        <View style={{ width: 12 * s, height: 1.6 * s, backgroundColor: C.micGrill }} />
      </View>
      {/* Neck ring */}
      <View style={{ width: 8 * s, height: 3 * s, backgroundColor: C.micGold }} />
      {/* Handle */}
      <View style={{
        width: 7 * s, height: 15 * s, backgroundColor: C.micHandle,
        borderBottomLeftRadius: 3 * s, borderBottomRightRadius: 3 * s,
      }} />
    </View>
  );
}

function HeartIcon({ size = 1, opacity = 1 }: { size?: number; opacity?: number }) {
  const s = size;
  return (
    <View style={{ width: 30 * s, height: 30 * s, alignItems: 'center', opacity }}>
      {/* Two lobes */}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, backgroundColor: C.heart, marginRight: -3 * s }} />
        <View style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, backgroundColor: C.heart }} />
      </View>
      {/* Point */}
      <View style={{
        width: 0, height: 0, marginTop: -7 * s,
        borderLeftWidth: 12.5 * s, borderRightWidth: 12.5 * s,
        borderTopWidth: 14 * s,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderStyle: 'solid',
        borderTopColor: C.heart,
      }} />
      {/* Shine */}
      <View style={{
        position: 'absolute', left: 5 * s, top: 3.5 * s,
        width: 5 * s, height: 3.5 * s, borderRadius: 2 * s,
        backgroundColor: '#FF8FA5', opacity: 0.85,
      }} />
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const gsRef = useRef<GS>(mkGS());
  const [, setFrame] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const [soundOff, setSoundOff] = useState(getMuted());
  const [bestWave, setBestWave] = useState(0);
  const persistedRef = useRef(false); // one-shot guard for run persistence
  const [shopOpen, setShopOpen] = useState(false);
  const [hatId, setHatId] = useState('classic');
  const routeParams = useLocalSearchParams<{ mode?: string }>();

  // Load persistent progression + apply daily-challenge modifiers once at mount
  useEffect(() => {
    const gg = gsRef.current;
    if (routeParams.mode === 'endless') {
      gg.endless = true;
    }
    if (routeParams.mode === 'daily') {
      const mod = todayMod();
      gg.daily = true;
      gg.seedOffset = dailySeed() % 997;
      gg.forceRunners = mod.id === 'runners';
      gg.noCheckpoints = mod.id === 'nocheck';
      gg.hpMult = mod.id === 'tough' ? 1.5 : 1;
      gg.solids = genRoundSolids(1 + gg.seedOffset, 0);
    }
    if (routeParams.mode === 'continue') {
      // Resume a saved run at the intermission after its last cleared wave
      loadRun().then(snap => {
        const g2 = gsRef.current;
        if (!snap || g2.kills > 0 || g2.hitsTaken > 0 || g2.phase === 'dead') return;
        g2.wave = snap.wave;
        g2.roundStart = -ROUND_LEN; // startNextWave advances this to 0
        g2.hp = snap.hp;
        g2.maxHp = snap.maxHp;
        g2.score = snap.score;
        g2.roundScore = snap.score;
        g2.kills = snap.kills;
        g2.hitsTaken = snap.hits;
        g2.bossKills = snap.bossKills;
        g2.teeth = snap.teeth;
        g2.teethBanked = snap.teeth; // everything in the snapshot is already banked
        g2.killsBanked = snap.kills; // stats were recorded at the wave clear that saved this
        g2.bossBanked = snap.bossKills;
        g2.dmgMult = snap.dmgMult;
        g2.spdMult = snap.spdMult;
        g2.upgDmg = snap.upgDmg;
        g2.upgMic = snap.upgMic;
        g2.streak = snap.streak;
        g2.rangeMult = snap.rangeMult ?? 1;
        g2.teethBonus = snap.teethBonus ?? 0;
        g2.streakSave = snap.streakSave ?? false;
        g2.maxStreak = snap.maxStreak ?? snap.streak;
        g2.runnerKills = snap.runnerKills ?? 0;
        g2.runnerBanked = g2.runnerKills; // quest progress already banked at save
        g2.noHitWaves = snap.noHitWaves ?? 0;
        g2.noHitBanked = g2.noHitWaves;
        g2.spawnQ = 0; g2.spawnMarks = []; g2.cpBurst = 0;
        g2.enemies = [];
        g2.hintT = 0;
        g2.phase = 'intermission';
      });
    } else {
      Promise.all([loadUpgrades(), loadHat()]).then(([u, hid]) => {
        const g2 = gsRef.current;
        // Only apply if the run is still fresh — never buff/heal mid-run
        if (g2.wave !== 1 || g2.kills > 0 || g2.hitsTaken > 0 || g2.phase === 'dead') return;
        // Equipped hat grants a small run bonus
        const h = HATS.find(x => x.id === hid) ?? HATS[0];
        g2.maxHp = PLAYER_MAX_HP + u.hp * 10 + (h.hp ?? 0);
        g2.hp = g2.maxHp;
        g2.upgDmg = u.dmg * 4;
        g2.upgMic = u.mic * 3000;
        g2.dmgMult *= 1 + (h.dmg ?? 0);
        g2.spdMult *= 1 + (h.spd ?? 0);
        g2.teethBonus += h.teeth ?? 0;
      });
    }
    loadStats().then(s => setBestWave(s.bestWave));
    loadHat().then(setHatId);
  }, []);
  const held = useRef({ l: false, r: false, j: false });

  const topOff = insets.top + WEB_TOP;
  const botOff = insets.bottom + WEB_BOT;
  const gameH = SH - topOff - HUD_H - CTRL_H - botOff;
  const groundY = topOff + HUD_H + gameH - GROUND_H;

  const tickFn = useCallback(() => {
    const g = gsRef.current;
    gameTick(g, held.current.l, held.current.r, held.current.j);
    if (g.phase === 'dead') setIsDead(true);
    else setFrame(f => f + 1);
  }, []);

  useEffect(() => {
    const id = setInterval(tickFn, TICK_MS);
    return () => clearInterval(id);
  }, [tickFn]);

  // Background music for the whole run; release all players on unmount
  useEffect(() => {
    startMusic();
    return () => disposeAudio();
  }, []);

  useEffect(() => {
    if (isDead) stopMusic();
  }, [isDead]);

  useEffect(() => {
    if (!isDead) return;
    const g = gsRef.current;
    // Persist run progression exactly once, even if this effect re-fires.
    // Ordered writes: bank + record first, clear the save slot last, so a
    // crash mid-sequence can never leave rewards unbanked.
    if (!persistedRef.current) {
      persistedRef.current = true;
      (async () => {
        // Best-effort persistence: any storage failure must never strand the
        // player on a dead game screen — navigation happens in finally.
        let isNew = false;
        let hs = g.score;
        let streakCount = 0, streakBonus = 0;
        let achNames = '';
        try {
          // High score — endless mode keeps its own leaderboard
          if (g.endless) {
            isNew = await saveEndlessBest(g.score);
            if (!isNew) {
              const val = await AsyncStorage.getItem('zb_endless_hs');
              hs = val ? parseInt(val) : g.score;
            }
          } else {
            const val = await AsyncStorage.getItem(HS_KEY);
            const prev = val ? parseInt(val) : 0;
            isNew = g.score > prev;
            hs = isNew ? g.score : prev;
            if (isNew) await AsyncStorage.setItem(HS_KEY, String(g.score));
          }
          const teethDelta = g.teeth - g.teethBanked;
          const killDelta = g.kills - g.killsBanked;
          const bossDelta = g.bossKills - g.bossBanked;
          await addTeeth(teethDelta); // only what wasn't banked at wave clears
          await recordRun(killDelta, bossDelta, g.wave);
          if (g.daily) await saveDailyBest(g.score);
          // Daily login streak — completing a daily run keeps the fire lit
          if (g.daily) {
            const sres = await recordDailyStreak();
            streakCount = sres.count;
            streakBonus = sres.bonus;
          }
          // Bounty progress + achievement unlocks
          const fresh = await bankQuestAch(g, killDelta, bossDelta, teethDelta);
          achNames = fresh.map(a => a.name).join('|');
          await clearRun(); // the run is over — no continuing a dead run
        } catch {
          // Swallow storage errors — rewards may be partially banked, but the
          // game must move on. Delta markers keep re-banking safe next run.
        } finally {
          router.replace({
            pathname: '/(tabs)/gameover',
            params: {
              score: String(g.score), wave: String(g.wave), hs: String(hs), newHs: isNew ? '1' : '0',
              kills: String(g.kills), hits: String(g.hitsTaken),
              bosses: String(g.bossKills), teeth: String(g.teeth),
              daily: g.daily ? '1' : '0',
              endless: g.endless ? '1' : '0',
              streak: String(streakCount), streakBonus: String(streakBonus),
              ach: achNames,
            },
          });
        }
      })();
    }
  }, [isDead]);

  const g = gsRef.current;

  // ── Bill coords ────────────────────────────────────────────────────────────
  const pBob = g.grounded ? Math.sin(g.step / 140) * 2.5 : 0;
  const pOpacity = g.iframeT > 0 ? (Math.floor(g.iframeT / 85) % 2 === 0 ? 0.3 : 1) : 1;
  const pBodyY = groundY - PLAYER_H - g.ay;
  const pHeadY = pBodyY - HEAD_D + 6;
  const pBeardY = pHeadY + HEAD_D - 7;
  const pHatBrimY = pHeadY - 4;
  const pHatTopY = pHatBrimY - HAT_H;
  const pCX = SW / 2;
  const pBodyX = pCX - PLAYER_W / 2;
  const pHeadX = pCX - HEAD_D / 2;
  const pHatX = pCX - HAT_W / 2;

  const flicker = g.dmgFlash > 0;
  const billHeadCol = flicker ? '#A03020' : C.billHead;
  const billShirtCol = flicker ? C.blood : C.billShirt;
  const hat = HATS.find(h => h.id === hatId) ?? HATS[0];

  const hpPct = Math.max(0, g.hp / g.maxHp);
  const hpColor = hpPct > 0.55 ? C.hpGreen : hpPct > 0.28 ? C.hpOrange : C.hpRed;

  const visTrees = TREES.filter(t => {
    const sx = SW / 2 + (t.wx - g.wx) * 0.38;
    return sx > -90 && sx < SW + 90;
  });

  const T = themeForWave(g.wave);
  const isKetchupActive = g.activePowerup === 'ketchup';
  const isChiliActive = g.activePowerup === 'chili';
  const micActive = g.micT > 0;
  const tNow = Date.now();

  // DVD button glow color based on active powerup
  const dvdBtnColor = isKetchupActive
    ? 'rgba(180,20,0,0.45)'
    : isChiliActive
    ? 'rgba(140,80,0,0.45)'
    : C.atkBtnBg;
  const dvdBtnBorder = isKetchupActive
    ? '#FF3300'
    : isChiliActive
    ? '#FF9900'
    : C.atkBtnBorder;

  return (
    <View style={[st.root, {
      backgroundColor: T.skyTop,
      transform: [{ translateX: g.shakeT > 0 ? Math.sin(tNow / 24) * 5 : 0 }],
    }]}>

      {/* ── Sky ── */}
      <View style={[st.sky, { height: groundY, backgroundColor: T.skyBot }]}>
        {!T.day && STARS.map((star, i) => (
          <View key={i} style={{
            position: 'absolute', left: star.x, top: star.y + topOff + HUD_H,
            width: star.r * 2, height: star.r * 2, borderRadius: star.r,
            backgroundColor: C.starCol,
          }} />
        ))}
        <View style={[st.moon, {
          top: topOff + HUD_H + 18, right: 55,
          backgroundColor: T.orb, shadowColor: T.orbGlow,
        }]} />
        {/* Horizon glow bands — colors follow the current theme */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: GROUND_H, height: 100, backgroundColor: T.glowA, opacity: 0.18 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: GROUND_H, height: 58, backgroundColor: T.glowB, opacity: 0.20 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: GROUND_H, height: 26, backgroundColor: T.glowC, opacity: 0.18 }} />
        {/* Ruined city skyline (far parallax) */}
        {CITY.map((b, i) => {
          const sx = SW / 2 + (b.wx - g.wx) * 0.22 - b.w / 2;
          if (sx < -100 || sx > SW + 100) return null;
          return (
            <View key={`c${i}`} style={{ position: 'absolute', left: sx, bottom: GROUND_H - 2, width: b.w, height: b.h }}>
              <View style={{
                position: 'absolute', left: 0, bottom: 0, width: b.w, height: b.h,
                backgroundColor: T.city,
                borderTopLeftRadius: b.broken ? 0 : 2,
                borderTopRightRadius: b.broken ? 10 : 2,
              }} />
              {b.broken && (
                <View style={{
                  position: 'absolute', left: b.w * 0.55, bottom: b.h - 8, width: b.w * 0.45, height: 8,
                  backgroundColor: T.skyBot,
                }} />
              )}
              {/* Dim lit windows */}
              <View style={{ position: 'absolute', left: 5, bottom: b.h * 0.55, width: 3, height: 4, backgroundColor: C.cityWindow, opacity: 0.65 }} />
              <View style={{ position: 'absolute', left: b.w - 9, bottom: b.h * 0.3, width: 3, height: 4, backgroundColor: C.cityWindow, opacity: 0.5 }} />
              {i % 2 === 0 && (
                <View style={{ position: 'absolute', left: b.w * 0.4, bottom: b.h * 0.72, width: 3, height: 4, backgroundColor: C.cityWindow, opacity: 0.55 }} />
              )}
            </View>
          );
        })}
        {/* Neon bar signs — mounted on midground buildings, flickering */}
        {NEONS.map((n, i) => {
          const sx = SW / 2 + (n.wx - g.wx) * 0.55;
          if (sx < -120 || sx > SW + 120) return null;
          const on = Math.sin(tNow / 210 + i * 17) > -0.9;
          const glow = on ? 1 : 0.12;
          return (
            <View key={`n${i}`} style={{
              position: 'absolute', left: sx - 30, bottom: GROUND_H + n.h,
              paddingHorizontal: 6, paddingVertical: 3,
              backgroundColor: '#0A0810',
              borderWidth: 1.5, borderColor: n.col, borderRadius: 4,
              opacity: 0.25 + glow * 0.75,
            }}>
              <Text style={{
                color: n.col, fontSize: 10, fontWeight: '900', letterSpacing: 2,
                opacity: glow,
                textShadowColor: n.col, textShadowRadius: on ? 9 : 0,
                textShadowOffset: { width: 0, height: 0 },
              }}>
                {n.text}
              </Text>
            </View>
          );
        })}
        <View style={[st.hill, { bottom: GROUND_H, left: -20, width: SW * 0.55, height: 70, backgroundColor: T.hill }]} />
        <View style={[st.hill, { bottom: GROUND_H, left: SW * 0.38, width: SW * 0.65, height: 50, backgroundColor: T.hill }]} />
        {visTrees.map((t, i) => {
          const sx = SW / 2 + (t.wx - g.wx) * 0.38 - t.w / 2;
          return (
            <View key={i} style={{
              position: 'absolute', left: sx, bottom: GROUND_H - 2,
              width: t.w, height: t.h, backgroundColor: T.tree,
              borderTopLeftRadius: t.w / 2, borderTopRightRadius: t.w / 2,
            }} />
          );
        })}
      </View>

      {/* ── Ground ── */}
      <View style={[st.ground, { top: groundY, height: GROUND_H, backgroundColor: T.ground }]} />
      <View style={[st.groundTop, { top: groundY, backgroundColor: T.groundTop }]} />

      {/* ── Street lights (flickering) ── */}
      {STREETLIGHTS.map((l, i) => {
        const sx = SW / 2 + (l.wx - g.wx);
        if (sx < -60 || sx > SW + 60) return null;
        const poleH = 96;
        const on = !l.broken && Math.sin(tNow / 75 + i * 5.3) > -0.82;
        return (
          <View key={`sl${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Pole */}
            <View style={{
              position: 'absolute', left: sx - 1.5, top: groundY - poleH,
              width: 3, height: poleH, backgroundColor: C.poleCol,
            }} />
            {/* Arm */}
            <View style={{
              position: 'absolute', left: sx - 1.5, top: groundY - poleH,
              width: 15, height: 3, backgroundColor: C.poleCol,
            }} />
            {/* Lamp head */}
            <View style={{
              position: 'absolute', left: sx + 9, top: groundY - poleH + 1,
              width: 10, height: 5, borderRadius: 2,
              backgroundColor: on ? C.lampGlow : '#141318',
            }} />
            {/* Light cone */}
            {on && (
              <View style={{
                position: 'absolute', left: sx + 14 - 17, top: groundY - poleH + 6,
                width: 0, height: 0,
                borderLeftWidth: 17, borderRightWidth: 17,
                borderBottomWidth: poleH - 8,
                borderLeftColor: 'transparent', borderRightColor: 'transparent',
                borderStyle: 'solid',
                borderBottomColor: 'rgba(255,215,130,0.10)',
              }} />
            )}
          </View>
        );
      })}

      {/* ── Floating platforms ── */}
      {g.solids.filter(s => s.kind === 'platform').map((p, i) => {
        const sx = SW / 2 + (p.wx - g.wx);
        if (sx < -120 || sx > SW + 120) return null;
        const topY = groundY - p.h;
        return (
          <View key={`pl${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={{
              position: 'absolute', left: sx - p.w / 2, top: topY,
              width: p.w, height: 9, backgroundColor: C.platformCol,
              borderRadius: 3, borderTopWidth: 2.5, borderTopColor: C.platformTop,
            }} />
            {/* Rusty brackets */}
            <View style={{ position: 'absolute', left: sx - p.w / 2 + 6, top: topY + 9, width: 3, height: 8, backgroundColor: C.platformCol }} />
            <View style={{ position: 'absolute', left: sx + p.w / 2 - 9, top: topY + 9, width: 3, height: 8, backgroundColor: C.platformCol }} />
          </View>
        );
      })}

      {/* ── Ground obstacles (wrecked cars, crates, barricades) ── */}
      {g.solids.filter(s => s.kind !== 'platform').map((o, i) => {
        const sx = SW / 2 + (o.wx - g.wx);
        if (sx < -120 || sx > SW + 120) return null;
        const lx = sx - o.w / 2;
        const topY = groundY - o.h;
        if (o.kind === 'car') {
          return (
            <View key={`ob${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* Cabin */}
              <View style={{
                position: 'absolute', left: lx + o.w * 0.22, top: topY - 9,
                width: o.w * 0.5, height: 11, backgroundColor: C.carDark,
                borderTopLeftRadius: 6, borderTopRightRadius: 6,
              }} />
              {/* Body */}
              <View style={{
                position: 'absolute', left: lx, top: topY,
                width: o.w, height: o.h - 6, backgroundColor: C.carBody, borderRadius: 5,
              }} />
              {/* Wheels (one missing — it's a wreck) */}
              <View style={{ position: 'absolute', left: lx + 8, top: groundY - 10, width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#111014' }} />
              <View style={{ position: 'absolute', left: lx + o.w - 20, top: groundY - 6, width: 11, height: 6, borderRadius: 3, backgroundColor: '#111014' }} />
              {/* Scorch mark */}
              <View style={{ position: 'absolute', left: lx + o.w * 0.55, top: topY + 2, width: o.w * 0.3, height: 7, borderRadius: 3, backgroundColor: '#141014', opacity: 0.8 }} />
            </View>
          );
        }
        if (o.kind === 'crate') {
          return (
            <View key={`ob${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={{
                position: 'absolute', left: lx, top: topY,
                width: o.w, height: o.h, backgroundColor: C.crateCol,
                borderWidth: 2.5, borderColor: C.crateEdge, borderRadius: 2,
              }} />
              {/* X planks */}
              <View style={{
                position: 'absolute', left: lx + 2, top: topY + o.h / 2 - 1.5,
                width: o.w - 4, height: 3, backgroundColor: C.crateEdge,
                transform: [{ rotate: '42deg' }],
              }} />
              <View style={{
                position: 'absolute', left: lx + 2, top: topY + o.h / 2 - 1.5,
                width: o.w - 4, height: 3, backgroundColor: C.crateEdge,
                transform: [{ rotate: '-42deg' }],
              }} />
            </View>
          );
        }
        // Barricade
        return (
          <View key={`ob${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={{
              position: 'absolute', left: lx, top: topY,
              width: o.w, height: 8, borderRadius: 2, backgroundColor: C.barricadeA,
            }} />
            <View style={{ position: 'absolute', left: lx + 8, top: topY, width: 8, height: 8, backgroundColor: C.barricadeB }} />
            <View style={{ position: 'absolute', left: lx + 26, top: topY, width: 8, height: 8, backgroundColor: C.barricadeB }} />
            {/* Legs */}
            <View style={{ position: 'absolute', left: lx + 4, top: topY + 8, width: 3.5, height: o.h - 8, backgroundColor: C.barricadeB }} />
            <View style={{ position: 'absolute', left: lx + o.w - 8, top: topY + 8, width: 3.5, height: o.h - 8, backgroundColor: C.barricadeB }} />
          </View>
        );
      })}

      {/* ── Checkpoint & round endpoint flags ── */}
      {[
        { wx: g.roundStart + ROUND_LEN / 2, end: false },
        { wx: g.roundStart + ROUND_LEN, end: true },
      ].map((f, i) => {
        const sx = SW / 2 + (f.wx - g.wx);
        if (sx < -80 || sx > SW + 80) return null;
        const poleH = f.end ? 86 : 68;
        const hit = !f.end && g.checkpointHit;
        const flagCol = f.end ? C.endFlagA : hit ? C.micGold : C.cpFlag;
        return (
          <View key={`fl${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Pole */}
            <View style={{
              position: 'absolute', left: sx - 2, top: groundY - poleH,
              width: 4, height: poleH, backgroundColor: '#8A8A94', borderRadius: 2,
            }} />
            {/* Flag */}
            <View style={{
              position: 'absolute', left: sx + 2, top: groundY - poleH + 2,
              width: 42, height: 22, backgroundColor: flagCol,
              borderTopRightRadius: 3, borderBottomRightRadius: 3,
              alignItems: 'center', justifyContent: 'center',
              opacity: hit ? 0.85 : 1,
            }}>
              {f.end && (
                <>
                  {/* Checkered squares */}
                  <View style={{ position: 'absolute', left: 0, top: 0, width: 10, height: 11, backgroundColor: C.endFlagB }} />
                  <View style={{ position: 'absolute', left: 21, top: 0, width: 10, height: 11, backgroundColor: C.endFlagB }} />
                  <View style={{ position: 'absolute', left: 10, top: 11, width: 11, height: 11, backgroundColor: C.endFlagB }} />
                  <View style={{ position: 'absolute', left: 32, top: 11, width: 10, height: 11, backgroundColor: C.endFlagB }} />
                </>
              )}
              {!f.end && (
                <Text style={{ color: '#04240F', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>
                  {hit ? '✓' : 'CP'}
                </Text>
              )}
            </View>
            {/* Base */}
            <View style={{
              position: 'absolute', left: sx - 7, top: groundY - 4,
              width: 14, height: 5, borderRadius: 2, backgroundColor: '#3A3A42',
            }} />
          </View>
        );
      })}

      {/* ── Power-ups on ground ── */}
      {g.powerups.map(p => {
        const sx = SW / 2 + (p.wx - g.wx);
        const bobOff = Math.sin(p.bobT / 500) * 5;
        if (sx < -60 || sx > SW + 60) return null;
        return (
          <View key={p.id} style={{ position: 'absolute', left: sx - 18, top: groundY - GROUND_H + 2 + bobOff }}>
            {/* Glow ring */}
            <View style={{
              position: 'absolute',
              left: p.type === 'chili' ? -6 : -8,
              top: -4,
              width: p.type === 'chili' ? 48 : 34,
              height: p.type === 'chili' ? 38 : 46,
              borderRadius: 10,
              backgroundColor:
                p.type === 'ketchup' ? 'rgba(200,30,0,0.18)'
                : p.type === 'chili' ? 'rgba(180,80,0,0.18)'
                : p.type === 'heart' ? 'rgba(255,59,92,0.18)'
                : 'rgba(255,210,74,0.16)',
              borderWidth: 1.5,
              borderColor:
                p.type === 'ketchup' ? 'rgba(255,80,0,0.45)'
                : p.type === 'chili' ? 'rgba(255,140,0,0.45)'
                : p.type === 'heart' ? 'rgba(255,59,92,0.55)'
                : 'rgba(255,210,74,0.6)',
            }} />
            {p.type === 'ketchup' ? <KetchupIcon size={1} />
              : p.type === 'chili' ? <ChiliBowlIcon size={1} />
              : p.type === 'heart' ? <HeartIcon size={1} />
              : <MicIcon size={1} />
            }
            <Text style={{
              color: p.type === 'ketchup' ? '#FF8060' : p.type === 'chili' ? '#FFAA40' : p.type === 'heart' ? '#FF7A90' : C.micGold,
              fontSize: 8, fontWeight: '900', letterSpacing: 1,
              textAlign: 'center', marginTop: 2,
            }}>
              {p.type === 'ketchup' ? 'SPREAD' : p.type === 'chili' ? 'RAPID' : p.type === 'heart' ? '+LIFE' : 'MIC!'}
            </Text>
          </View>
        );
      })}

      {/* ── Hit effects ── */}
      {g.hitEffects.map(eff => {
        const sx = SW / 2 + (eff.wx - g.wx);
        const prog = eff.t / 750;
        const col = eff.text.startsWith('COMBO') ? C.gold
          : eff.text === 'SCRRRATCH!' ? '#E8C8FF'
          : eff.text === 'THWACK!' ? C.thwack : '#FF8844';
        return (
          <Text key={eff.id} style={{
            position: 'absolute',
            left: sx - 38, top: groundY - ENEMY_H - 18 - prog * 38,
            fontSize: 18, fontWeight: '900', color: col,
            opacity: 1 - prog,
            textShadowColor: '#000', textShadowRadius: 5,
            textShadowOffset: { width: 1, height: 1 },
            letterSpacing: 1,
          }} pointerEvents="none">
            {eff.text}
          </Text>
        );
      })}

      {/* ── Enemies ── */}
      {g.enemies.map(e => {
        const sc = e.scale;
        const eW = ENEMY_W * sc;
        const eH = ENEMY_H * sc;
        const eHD = ENEMY_HEAD_D * sc;
        const ecx = SW / 2 + (e.wx - g.wx);
        const ebx = ecx - eW / 2;
        const eTopY = groundY - eH;
        const eHdX = ecx - eHD / 2;
        const eHdY = eTopY - eHD + 5 * sc;
        const faceR = e.wx < g.wx;
        const eBob = Math.sin(e.step / 145) * 2;
        const armX = faceR ? ebx + eW - 2 : ebx - 18 * sc;
        const hpPctE = Math.max(0, e.hp / e.maxHp);
        const ec = e.boss
          ? e.charger
            ? { body: '#6E1414', head: '#8A6A2E', shirt: '#4A0E0E', pants: '#2A0A0A' }
            : e.summoner
            ? { body: '#2A1A4A', head: '#7A5AB4', shirt: '#1A0E34', pants: '#140A24' }
            : { body: C.bossBody, head: C.bossHead, shirt: '#3A1420', pants: '#241018' }
          : ENEMY_COLS[e.etype];

        return (
          <View key={e.id} style={StyleSheet.absoluteFill} pointerEvents="none">
            {!e.dead && (
              <>
                {e.boss && (
                  <Text style={{
                    position: 'absolute', left: ebx - 10, top: eHdY - 28,
                    width: eW + 20, textAlign: 'center',
                    color: '#FF4D4D', fontSize: 10, fontWeight: '900', letterSpacing: 2,
                    textShadowColor: '#000', textShadowRadius: 3,
                    textShadowOffset: { width: 0, height: 1 },
                  }}>
                    {e.charger ? 'CHARGER' : e.summoner ? 'SUMMONER' : 'BOSS'}
                  </Text>
                )}
                <View style={[st.eHpBg, { left: ebx - 3, top: eHdY - 12, width: eW + 6, height: e.boss ? 7 : 5 }]}>
                  <View style={[st.eHpFill, {
                    width: `${hpPctE * 100}%`,
                    backgroundColor: e.boss ? '#B32EFF' : hpPctE > 0.5 ? C.hpGreen : C.hpRed,
                  }]} />
                </View>
              </>
            )}
            <View style={{
              position: 'absolute', left: eHdX, top: eHdY + eBob,
              width: eHD, height: eHD,
              borderRadius: eHD / 2, backgroundColor: ec.head,
              opacity: e.dead ? e.fade : 1,
            }} />
            {!e.dead && (
              <>
                {/* Bulging comic eyes — boss gets angry red eyes */}
                <View style={{
                  position: 'absolute', left: eHdX + 2.5 * sc, top: eHdY + 5 * sc + eBob,
                  width: 6.5 * sc, height: 6.5 * sc, borderRadius: 3.25 * sc,
                  backgroundColor: e.boss ? '#FF3020' : '#F2EFE0',
                }} />
                <View style={{
                  position: 'absolute', left: eHdX + eHD - 9 * sc, top: eHdY + 5 * sc + eBob,
                  width: 6.5 * sc, height: 6.5 * sc, borderRadius: 3.25 * sc,
                  backgroundColor: e.boss ? '#FF3020' : '#F2EFE0',
                }} />
                <View style={{
                  position: 'absolute', left: faceR ? eHdX + 6 * sc : eHdX + 3.5 * sc,
                  top: eHdY + 7 * sc + eBob,
                  width: 2.5 * sc, height: 2.5 * sc, borderRadius: 1.25 * sc, backgroundColor: '#131313',
                }} />
                <View style={{
                  position: 'absolute', left: faceR ? eHdX + eHD - 5.5 * sc : eHdX + eHD - 8 * sc,
                  top: eHdY + 7 * sc + eBob,
                  width: 2.5 * sc, height: 2.5 * sc, borderRadius: 1.25 * sc, backgroundColor: '#131313',
                }} />
                {/* Gaping mouth */}
                <View style={{
                  position: 'absolute', left: eHdX + 6 * sc, top: eHdY + 13.5 * sc + eBob,
                  width: 7 * sc, height: 4 * sc, borderRadius: 2 * sc, backgroundColor: '#2A1210',
                }} />
                {/* Head gash */}
                <View style={{
                  position: 'absolute', left: eHdX + (faceR ? 12 : 3) * sc, top: eHdY + 1 * sc + eBob,
                  width: 5 * sc, height: 3 * sc, borderRadius: 1.5 * sc, backgroundColor: '#8B2010',
                }} />
              </>
            )}
            <View style={{
              position: 'absolute', left: ebx, top: eTopY + eBob,
              width: eW, height: eH,
              backgroundColor: ec.body, borderRadius: 4 * sc,
              opacity: e.dead ? e.fade : 1,
            }} />
            {/* Ragged pants */}
            <View style={{
              position: 'absolute', left: ebx + 1, top: eTopY + eH * 0.6 + eBob,
              width: eW - 2, height: eH * 0.4,
              backgroundColor: ec.pants,
              borderBottomLeftRadius: 4 * sc, borderBottomRightRadius: 4 * sc,
              opacity: e.dead ? e.fade : 1,
            }} />
            {/* Torn shirt hem */}
            <View style={{
              position: 'absolute', left: ebx, top: eTopY + eH * 0.58 + eBob,
              width: eW, height: 2.5 * sc,
              backgroundColor: 'rgba(0,0,0,0.4)',
              opacity: e.dead ? e.fade : 1,
            }} />
            {/* Shirt stain / blood splatter */}
            {!e.dead && (
              <View style={{
                position: 'absolute', left: ebx + (e.etype === 1 ? 4 * sc : eW - 11 * sc), top: eTopY + 10 * sc + eBob,
                width: 7 * sc, height: 6 * sc, borderRadius: 3 * sc, backgroundColor: '#6B1408', opacity: 0.75,
              }} />
            )}
            {!e.dead && (
              <View style={{
                position: 'absolute', left: armX, top: eTopY + 12 * sc + eBob,
                width: 18 * sc, height: 8 * sc, backgroundColor: ec.head, borderRadius: 4 * sc,
              }} />
            )}
            {e.dead && e.fade > 0.3 && (
              <View style={{
                position: 'absolute', left: ebx - 4, top: groundY - 8,
                width: eW + 8, height: 8,
                backgroundColor: C.blood, borderRadius: 5, opacity: e.fade * 0.8,
              }} />
            )}
          </View>
        );
      })}

      {/* ── Spit globs (spitter bile) ── */}
      {g.globs.map(gl => {
        const sx = SW / 2 + (gl.wx - g.wx);
        if (sx < -30 || sx > SW + 30) return null;
        const wob = Math.sin(gl.t / 90) * 3;
        return (
          <View key={gl.id} pointerEvents="none" style={{
            position: 'absolute', left: sx - 6, top: groundY - 26 + wob,
            width: 12, height: 10, borderRadius: 6,
            backgroundColor: '#8FD42A', borderWidth: 1.5, borderColor: '#5A8A14',
          }} />
        );
      })}

      {/* ── Projectiles (DVD / Ketchup bottle / Chili bowl) ── */}
      {g.dvds.map(dvd => {
        const screenX = SW / 2 + (dvd.wx - g.wx);
        const prog = dvd.t / DVD_LIFETIME;
        const dvdY = pBodyY + 18 + dvd.yOff;
        if (screenX < -40 || screenX > SW + 40) return null;
        const opacity = Math.max(0, 1 - prog * 0.6);
        const rot = dvd.dir * prog * 720;

        if (isKetchupActive) {
          // Flying ketchup bottle
          return (
            <View key={dvd.id} pointerEvents="none" style={{
              position: 'absolute', left: screenX - 8, top: dvdY - 8,
              opacity, transform: [{ rotate: `${dvd.dir * prog * 280}deg` }],
              alignItems: 'center',
            }}>
              {/* Cap */}
              <View style={{ width: 8, height: 4, backgroundColor: '#AA1000', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              {/* Neck */}
              <View style={{ width: 5, height: 5, backgroundColor: '#CC2200' }} />
              {/* Shoulder */}
              <View style={{ width: 14, height: 4, backgroundColor: '#DD2200', borderRadius: 2 }} />
              {/* Body */}
              <View style={{ width: 14, height: 16, backgroundColor: '#DD2200', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 10, height: 2, backgroundColor: '#F0DDD8', borderRadius: 1, marginBottom: 2 }} />
                <View style={{ width: 7, height: 2, backgroundColor: '#F0DDD8', borderRadius: 1 }} />
              </View>
              {/* Base */}
              <View style={{ width: 12, height: 3, backgroundColor: '#AA1800', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
            </View>
          );
        }

        if (isChiliActive) {
          // Flying chili bowl
          return (
            <View key={dvd.id} pointerEvents="none" style={{
              position: 'absolute', left: screenX - 14, top: dvdY - 10,
              opacity,
            }}>
              {/* Steam wisps */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: 28, paddingHorizontal: 3, marginBottom: 1 }}>
                <View style={{ width: 2, height: 5 + (prog > 0.3 ? 0 : 3), backgroundColor: '#C09870', borderRadius: 1, opacity: 0.8 }} />
                <View style={{ width: 2, height: 8 + (prog > 0.3 ? 0 : 2), backgroundColor: '#C09870', borderRadius: 1, opacity: 0.8 }} />
                <View style={{ width: 2, height: 5 + (prog > 0.3 ? 0 : 3), backgroundColor: '#C09870', borderRadius: 1, opacity: 0.8 }} />
              </View>
              {/* Chili surface */}
              <View style={{ width: 28, height: 7, backgroundColor: '#CC4400', borderRadius: 5 }} />
              {/* Bowl body */}
              <View style={{ width: 28, height: 13, backgroundColor: '#8B3A00', borderBottomLeftRadius: 9, borderBottomRightRadius: 9 }} />
              {/* Pepper dot */}
              <View style={{ position: 'absolute', left: 7, top: 8, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF2200', opacity: 0.85 }} />
            </View>
          );
        }

        if (dvd.vinyl) {
          // Vinyl record — bigger black disc with a gold label
          return (
            <View key={dvd.id} pointerEvents="none" style={{
              position: 'absolute', left: screenX - 14, top: dvdY - 3,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#141414',
              borderWidth: 2, borderColor: '#2E2E2E',
              opacity, transform: [{ rotate: `${rot}deg` }],
            }}>
              <View style={{ position: 'absolute', left: 8, top: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: C.micGold }} />
              <View style={{ position: 'absolute', left: 12, top: 12, width: 4, height: 4, borderRadius: 2, backgroundColor: '#141414' }} />
              <View style={{ position: 'absolute', left: 4, top: 3, width: 6, height: 2, borderRadius: 1, backgroundColor: '#FFF', opacity: 0.35 }} />
            </View>
          );
        }

        // Default: spinning DVD
        return (
          <View key={dvd.id} pointerEvents="none" style={{
            position: 'absolute', left: screenX - 11, top: dvdY,
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: C.dvdSilver,
            borderWidth: 2.5, borderColor: C.dvdShine,
            opacity, transform: [{ rotate: `${rot}deg` }],
          }}>
            <View style={{ position: 'absolute', left: 6, top: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.dvdHole }} />
            <View style={{ position: 'absolute', left: 3, top: 2, width: 5, height: 2, borderRadius: 1, backgroundColor: '#FFF', opacity: 0.7 }} />
          </View>
        );
      })}

      {/* ── Bill (player) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Mic mode — golden star aura */}
        {micActive && (
          <View style={{
            position: 'absolute', left: pBodyX - 10, top: pHatTopY - 8 + pBob,
            width: PLAYER_W + 20, height: PLAYER_H + HEAD_D + HAT_H + 14,
            borderRadius: 18,
            backgroundColor: 'rgba(255,210,74,0.14)',
            borderWidth: 2, borderColor: 'rgba(255,210,74,0.55)',
            opacity: 0.6 + Math.sin(tNow / 90) * 0.35,
          }} />
        )}
        {/* Baseball trucker cap — crown */}
        <View style={{
          position: 'absolute', left: pHatX, top: pHatTopY + pBob,
          width: HAT_W, height: HAT_H,
          backgroundColor: hat.cap,
          borderTopLeftRadius: HAT_W / 2, borderTopRightRadius: HAT_W / 2,
          borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
          opacity: pOpacity,
        }} />
        {/* White dot logo — offset toward the brim side */}
        <View style={{
          position: 'absolute',
          left: g.faceR ? pCX + 5 : pCX - 11,
          top: pHatTopY + 3 + pBob,
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: '#F2EFE6', opacity: pOpacity,
        }} />
        {/* Slim visor brim — directional */}
        <View style={{
          position: 'absolute',
          left: g.faceR ? pCX + 8 : pCX - 30,
          top: pHatBrimY + 3 + pBob,
          width: 22, height: 3.5,
          backgroundColor: hat.visor,
          borderRadius: 2,
          opacity: pOpacity,
        }} />
        {/* Head */}
        <View style={{
          position: 'absolute', left: pHeadX, top: pHeadY + pBob,
          width: HEAD_D, height: HEAD_D,
          borderRadius: HEAD_D / 2, backgroundColor: billHeadCol, opacity: pOpacity,
        }} />
        {/* Glasses left — chunky dark rounded frame */}
        <View style={{
          position: 'absolute', left: pHeadX, top: pHeadY + 8 + pBob,
          width: 8, height: 6, borderRadius: 2.5,
          borderWidth: 2, borderColor: C.billGlasses,
          backgroundColor: 'rgba(40,50,20,0.6)', opacity: pOpacity,
        }} />
        {/* Glasses right */}
        <View style={{
          position: 'absolute', left: pHeadX + 13, top: pHeadY + 8 + pBob,
          width: 8, height: 6, borderRadius: 2.5,
          borderWidth: 2, borderColor: C.billGlasses,
          backgroundColor: 'rgba(40,50,20,0.6)', opacity: pOpacity,
        }} />
        {/* Glasses bridge — thick bar */}
        <View style={{
          position: 'absolute', left: pHeadX + 7, top: pHeadY + 10 + pBob,
          width: 7, height: 2.5, backgroundColor: C.billGlasses, opacity: pOpacity,
        }} />
        {/* Shirt body (upper torso) */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + pBob,
          width: PLAYER_W, height: PLAYER_H * 0.52,
          backgroundColor: billShirtCol,
          borderTopLeftRadius: 5, borderTopRightRadius: 5,
          opacity: pOpacity,
        }} />
        {/* Plaid H band */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H * 0.3 + pBob,
          width: PLAYER_W, height: 4, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.55,
        }} />
        {/* Plaid V */}
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W / 4, top: pBodyY + pBob,
          width: 3, height: PLAYER_H * 0.52, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
        }} />
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W * 0.72, top: pBodyY + pBob,
          width: 3, height: PLAYER_H * 0.52, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
        }} />
        {/* Blue jeans (lower body) */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H * 0.52 + pBob,
          width: PLAYER_W, height: PLAYER_H * 0.48,
          backgroundColor: flicker ? C.blood : C.billJeans, opacity: pOpacity,
        }} />
        {/* Jeans center seam */}
        <View style={{
          position: 'absolute', left: pCX - 1.5, top: pBodyY + PLAYER_H * 0.62 + pBob,
          width: 3, height: PLAYER_H * 0.38,
          backgroundColor: C.billJeansDark, opacity: pOpacity * 0.8,
        }} />
        {/* Boots */}
        <View style={{
          position: 'absolute', left: pBodyX - 2, top: pBodyY + PLAYER_H - 2 + pBob,
          width: PLAYER_W + 4, height: 6,
          borderRadius: 3, backgroundColor: C.billBoots, opacity: pOpacity,
        }} />
        {/* Big triangular beard — over the chest like the comic */}
        <View style={{
          position: 'absolute', left: pCX - (HEAD_D / 2 + 4), top: pBeardY + pBob,
          width: 0, height: 0,
          borderLeftWidth: HEAD_D / 2 + 4, borderRightWidth: HEAD_D / 2 + 4,
          borderTopWidth: 30,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderStyle: 'solid',
          borderTopColor: C.billBeard, opacity: pOpacity,
        }} />
        {/* Throwing arm */}
        {g.atkActive && (
          <View style={{
            position: 'absolute',
            left: g.faceR ? pBodyX + PLAYER_W : pBodyX - 26,
            top: pBodyY + 14 + pBob,
            width: 26, height: 10,
            backgroundColor: billShirtCol, borderRadius: 5, opacity: pOpacity,
          }} />
        )}
      </View>

      {/* ── HUD ── */}
      <View style={[st.hud, { top: topOff, height: HUD_H }]}>
        {/* Wave */}
        <View style={st.hudWave}>
          <Text style={st.hudWaveTxt}>WAVE</Text>
          <Text style={st.hudWaveNum}>{g.wave}</Text>
          <Text style={st.hudRemain}>
            {Math.max(0, g.roundTotal - g.roundKills)}/{g.roundTotal} 🧟
          </Text>
        </View>
        {/* Score + power-up indicator */}
        <View style={st.hudCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={st.hudScoreTxt}>{g.score.toLocaleString()}</Text>
            {streakMult(g.streak) > 1 && (
              <Text style={st.hudMult}>x{streakMult(g.streak).toFixed(2).replace(/\.?0+$/, '')}</Text>
            )}
            <Text style={st.hudTeeth}>🦷{g.teeth}</Text>
          </View>
          {/* Mic mode countdown bar */}
          {micActive && (
            <View style={st.puBar}>
              <View style={[st.puBarFill, {
                width: `${Math.max(0, (g.micT / MIC_DURATION) * 100)}%`,
                backgroundColor: C.micGold,
              }]} />
              <Text style={[st.puLabel, { color: '#FFF3C4', textShadowColor: '#000', textShadowRadius: 2 }]}>MIC MODE · INVINCIBLE + FAST</Text>
            </View>
          )}
          {/* Active power-up bar */}
          {!micActive && g.activePowerup && (
            <View style={st.puBar}>
              <View style={[st.puBarFill, {
                width: '100%',
                backgroundColor: isKetchupActive ? '#FF4422' : '#FF9900',
              }]} />
              <Text style={[st.puLabel, { color: isKetchupActive ? '#FF8866' : '#FFBB44' }]}>
                {isKetchupActive ? 'KETCHUP SPREAD · UNTIL HIT' : 'CHILI RAPID FIRE · UNTIL HIT'}
              </Text>
            </View>
          )}
        </View>
        {/* HP */}
        <View style={st.hudHp}>
          <View style={st.hpBar}>
            <View style={[st.hpFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
          </View>
          <Text style={st.hpNum}>{g.hp}</Text>
        </View>
        {/* Pause */}
        <Pressable
          style={st.pauseBtn}
          onPress={() => {
            const gg = gsRef.current;
            if (gg.phase === 'playing') { gg.phase = 'paused'; setFrame(f => f + 1); }
          }}
        >
          <Ionicons name="pause" size={16} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>

      {/* Wave banner */}
      {g.waveMsg > 200 && (
        <View style={[st.waveBanner, { top: topOff + HUD_H + 28 }]}>
          <Text style={[st.waveBannerTxt, isBossWave(g.wave) && { color: '#FF4D4D' }]}>WAVE {g.wave}</Text>
          <Text style={st.waveBannerSub}>
            {isBossWave(g.wave) ? 'BOSS FIGHT!' : g.wave === VINYL_UNLOCK_WAVE ? 'VINYLS UNLOCKED!' : 'INCOMING!'}
          </Text>
        </View>
      )}

      {/* Checkpoint banner */}
      {g.cpMsg > 200 && g.waveMsg <= 200 && (
        <View style={[st.waveBanner, { top: topOff + HUD_H + 28 }]}>
          <Text style={[st.waveBannerTxt, { fontSize: 26, color: C.cpFlag, textShadowColor: '#052' }]}>CHECKPOINT!</Text>
          <Text style={[st.waveBannerSub, { color: C.hpGreen }]}>FULL LIFE RESTORED</Text>
        </View>
      )}

      {/* Round-clear hint: head to the endpoint flag */}
      {g.spawnQ === 0 && g.spawnMarks.length === 0 && g.cpBurst === 0 && g.enemies.filter(e => !e.dead).length === 0 && g.wx < g.roundStart + ROUND_LEN && g.waveMsg <= 200 && g.cpMsg <= 200 && (
        <View style={[st.waveBanner, { top: topOff + HUD_H + 28 }]}>
          <Text style={[st.waveBannerTxt, { fontSize: 20, color: C.gold, textShadowColor: '#000' }]}>ZOMBIES CLEARED</Text>
          <Text style={[st.waveBannerSub, { color: C.goldDim, marginTop: -2 }]}>REACH THE FLAG →</Text>
        </View>
      )}

      {/* Low-HP vignette — pulsing red edges when close to death */}
      {g.phase === 'playing' && hpPct > 0 && hpPct < 0.3 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          borderWidth: 7, borderColor: '#CC0000', borderRadius: 2,
          opacity: 0.25 + 0.3 * Math.abs(Math.sin(tNow / 320)),
        }]} />
      )}

      {/* LAST ZOMBIE alert */}
      {g.phase === 'playing' && g.waveMsg <= 0 &&
        g.spawnQ === 0 && g.spawnMarks.length === 0 && g.cpBurst === 0 &&
        g.enemies.filter(e => !e.dead).length === 1 && (
        <View style={[st.lastZombie, { top: topOff + HUD_H + 8 }]} pointerEvents="none">
          <Text style={st.lastZombieTxt}>⚠️ LAST ZOMBIE!</Text>
        </View>
      )}

      {/* Daily challenge tag */}
      {g.daily && g.phase === 'playing' && (
        <View style={[st.dailyTag, { top: topOff + HUD_H + 8 }]} pointerEvents="none">
          <Text style={st.dailyTagTxt}>📅 DAILY · {todayMod().name}</Text>
        </View>
      )}

      {/* Endless mode tag */}
      {g.endless && g.phase === 'playing' && (
        <View style={[st.dailyTag, { top: topOff + HUD_H + 8 }]} pointerEvents="none">
          <Text style={[st.dailyTagTxt, { color: '#FF8A3C' }]}>♾️ ENDLESS</Text>
        </View>
      )}

      {/* First-run tutorial hint */}
      {g.wave === 1 && g.hintT > 0 && g.waveMsg <= 200 && (
        <View style={[st.hintBox, { top: topOff + HUD_H + 30, opacity: Math.min(1, g.hintT / 800) }]} pointerEvents="none">
          <Text style={st.hintTxt}>💿  Throw DVDs at zombies</Text>
          <Text style={st.hintTxt}>⬆️  Jump over obstacles &amp; onto platforms</Text>
          <Text style={st.hintTxt}>🚩  Clear all zombies, then reach the flag</Text>
        </View>
      )}

      {/* ── Pause overlay ── */}
      {g.phase === 'paused' && (
        <View style={[StyleSheet.absoluteFill, st.interWrap]}>
          <View style={st.interCard}>
            <Text style={st.interTitle}>PAUSED</Text>
            <View style={st.interDivider} />
            <Pressable
              style={({ pressed }) => [st.interBtn, pressed && st.interBtnPressed]}
              onPress={() => {
                gsRef.current.phase = 'playing';
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={st.interBtnTxt}>RESUME</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [st.pauseRowBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                const next = !soundOff;
                setMuted(next);
                setSoundOff(next);
              }}
            >
              <Ionicons name={soundOff ? 'volume-mute' : 'volume-high'} size={18} color="rgba(255,255,255,0.75)" />
              <Text style={st.pauseRowTxt}>SOUND: {soundOff ? 'OFF' : 'ON'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [st.pauseRowBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShopOpen(true)}
            >
              <Ionicons name="cart" size={16} color="#F5C842" />
              <Text style={st.pauseRowTxt}>SHOP</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [st.pauseRowBtn, pressed && { opacity: 0.7 }]}
              onPress={async () => {
                const gg = gsRef.current;
                // Bank any unbanked teeth, then leave. The resume point stays
                // the last wave-clear autosave (pre-perk) — quitting mid-wave
                // means that wave restarts, so we never snapshot mid-wave state.
                const unbanked = gg.teeth - gg.teethBanked;
                if (unbanked > 0) {
                  gg.teethBanked = gg.teeth;
                  await addTeeth(unbanked);
                }
                // Bank lifetime stats earned mid-wave too
                const kd = gg.kills - gg.killsBanked;
                const bd = gg.bossKills - gg.bossBanked;
                if (kd > 0 || bd > 0) {
                  gg.killsBanked = gg.kills;
                  gg.bossBanked = gg.bossKills;
                  await recordRun(kd, bd, gg.wave);
                }
                // Bounty progress earned mid-wave counts too
                await bankQuestAch(gg, kd, bd, unbanked > 0 ? unbanked : 0);
                router.replace('/(tabs)');
              }}
            >
              <Ionicons name="save" size={16} color="rgba(255,255,255,0.55)" />
              <Text style={st.pauseRowTxt}>{g.daily || g.wave <= 1 ? 'QUIT TO MENU' : 'SAVE & QUIT'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Round-complete intermission ── */}
      {g.phase === 'intermission' && (
        <View style={[StyleSheet.absoluteFill, st.interWrap]}>
          <View style={st.interCard}>
            <Text style={st.interTitle}>WAVE {g.wave} CLEARED!</Text>
            {isBossWave(g.wave) && <Text style={st.interBoss}>BOSS DEFEATED</Text>}
            <View style={st.interDivider} />
            <View style={st.interRow}>
              <Text style={st.interLabel}>SCORE</Text>
              <Text style={st.interVal}>{g.score.toLocaleString()}</Text>
            </View>
            <View style={st.interRow}>
              <Text style={st.interLabel}>ROUND POINTS</Text>
              <Text style={st.interVal}>+{(g.score - g.roundScore).toLocaleString()}</Text>
            </View>
            <View style={st.interRow}>
              <Text style={st.interLabel}>ZOMBIES KILLED</Text>
              <Text style={st.interVal}>{g.roundKills}  <Text style={st.interDim}>({g.kills} total)</Text></Text>
            </View>
            <View style={st.interRow}>
              <Text style={st.interLabel}>HITS TAKEN</Text>
              <Text style={st.interVal}>{g.roundHits}  <Text style={st.interDim}>({g.hitsTaken} total)</Text></Text>
            </View>
            <View style={st.interRow}>
              <Text style={st.interLabel}>HEALTH</Text>
              <Text style={st.interVal}>{g.hp} / {g.maxHp}</Text>
            </View>
            <View style={st.interRow}>
              <Text style={st.interLabel}>TEETH EARNED</Text>
              <Text style={st.interVal}>🦷 {g.teeth}</Text>
            </View>
            {bestWave > 0 && (
              <Text style={st.interBest}>
                {g.wave + 1 > bestWave ? '🏆 NEW BEST RUN!' : `BEST RUN: WAVE ${bestWave}`}
              </Text>
            )}
            {/* Pick a perk — choosing starts the next wave */}
            <Text style={st.perkHeader}>
              PICK A PERK — {isBossWave(g.wave + 1) ? `WAVE ${g.wave + 1} IS A BOSS FIGHT!` : `THEN WAVE ${g.wave + 1}`}
            </Text>
            {(() => {
              const r = mkRng(g.wave * 131 + 17 + g.seedOffset);
              const i = Math.floor(r() * PERKS.length);
              const j = (i + 1 + Math.floor(r() * (PERKS.length - 1))) % PERKS.length;
              return [PERKS[i], PERKS[j]].map(p => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [st.perkBtn, pressed && st.interBtnPressed]}
                  onPress={() => {
                    const gg = gsRef.current;
                    if (gg.phase !== 'intermission') return;
                    applyPerk(gg, p.id);
                    startNextWave(gg);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                >
                  <Ionicons name={p.icon} size={18} color="#F5C842" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.perkName}>{p.name}</Text>
                    <Text style={st.perkDesc}>{p.desc}</Text>
                  </View>
                  <Ionicons name="play" size={14} color="rgba(255,255,255,0.4)" />
                </Pressable>
              ));
            })()}
            <Pressable
              style={({ pressed }) => [st.pauseRowBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShopOpen(true)}
            >
              <Ionicons name="cart" size={16} color="#F5C842" />
              <Text style={st.pauseRowTxt}>VISIT THE SHOP</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Shop (from pause or intermission) ── */}
      {shopOpen && (
        <Shop
          onClose={() => setShopOpen(false)}
          onHatChange={setHatId}
          onPurchased={(key, u) => {
            // Apply the purchase to the live run immediately
            const gg = gsRef.current;
            if (key === 'hp') { gg.maxHp += 10; gg.hp += 10; }
            else if (key === 'dmg') gg.upgDmg = u.dmg * 4;
            else if (key === 'mic') gg.upgMic = u.mic * 3000;
          }}
        />
      )}

      {/* ── Controls ── */}
      <View style={[st.controls, { bottom: botOff, height: CTRL_H }]}>
        <View style={st.dpad}>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPressIn={() => { held.current.l = true; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            onPressOut={() => { held.current.l = false; }}
          >
            <Ionicons name="arrow-back" size={26} color={C.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPressIn={() => { held.current.r = true; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            onPressOut={() => { held.current.r = false; }}
          >
            <Ionicons name="arrow-forward" size={26} color={C.white} />
          </Pressable>
        </View>
        <View style={st.actions}>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPressIn={() => { held.current.j = true; doJump(gsRef.current); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            onPressOut={() => { held.current.j = false; }}
          >
            <Ionicons name="arrow-up" size={26} color={C.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              st.btn, st.dvdBtn,
              { backgroundColor: dvdBtnColor, borderColor: dvdBtnBorder },
              pressed && st.dvdBtnActive,
            ]}
            onPress={() => {
              doAttack(gsRef.current);
              if (isChiliActive) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else if (isKetchupActive) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
            }}
          >
            <View style={st.dvdIcon}>
              <View style={st.dvdIconHole} />
            </View>
            {/* Power-up icon on button */}
            {isKetchupActive && (
              <View style={st.btnPuIcon}>
                <KetchupIcon size={0.45} />
              </View>
            )}
            {isChiliActive && (
              <View style={st.btnPuIcon}>
                <ChiliBowlIcon size={0.4} />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sky: { position: 'absolute', left: 0, right: 0, top: 0 },
  moon: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.moonCol,
    shadowColor: '#D4C060', shadowRadius: 18, shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
  },
  hill: { position: 'absolute', backgroundColor: '#0C1008', borderRadius: 60 },
  ground: { position: 'absolute', left: 0, right: 0 },
  groundTop: { position: 'absolute', left: 0, right: 0, height: 7, backgroundColor: '#2A1A04' },
  hud: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.hudBg, paddingHorizontal: 14, gap: 10,
  },
  hudWave: { width: 58, alignItems: 'flex-start' },
  hudWaveTxt: { color: '#5A4010', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  hudWaveNum: { color: C.goldDim, fontSize: 15, fontWeight: '900', lineHeight: 17 },
  hudRemain: { color: '#7A6A40', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  hudMult: { color: '#FF9922', fontSize: 13, fontWeight: '900' },
  hudTeeth: { color: '#C8B888', fontSize: 11, fontWeight: '800' },
  lastZombie: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(120,10,0,0.85)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FF5533',
  },
  lastZombieTxt: { color: '#FFD0C0', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  dailyTag: {
    position: 'absolute', left: 10,
    backgroundColor: 'rgba(10,30,60,0.8)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(80,140,255,0.4)',
  },
  dailyTagTxt: { color: '#9BC0FF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  interBest: { color: '#8A7A40', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 10, alignSelf: 'center' },
  perkHeader: {
    color: '#F5C842', fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
    marginTop: 14, marginBottom: 4, alignSelf: 'center',
  },
  perkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(245,200,66,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.35)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8,
  },
  perkName: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  perkDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
  pauseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  hintBox: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(5,3,10,0.82)',
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.35)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, gap: 5,
  },
  hintTxt: { color: '#E8DCB8', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  pauseRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 40, marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pauseRowTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  hudCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  hudScoreTxt: { color: C.gold, fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  puBar: {
    width: '100%', height: 12, backgroundColor: '#1A1010',
    borderRadius: 6, overflow: 'hidden',
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  puBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  puLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 1, position: 'absolute' },
  hudHp: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 100 },
  hpBar: { flex: 1, height: 10, backgroundColor: '#180808', borderRadius: 5, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpNum: { color: C.white, fontSize: 11, fontWeight: '700', width: 24, textAlign: 'right' },
  eHpBg: { position: 'absolute', height: 5, backgroundColor: '#0A0F0A', borderRadius: 3, overflow: 'hidden' },
  eHpFill: { height: '100%', borderRadius: 3 },
  waveBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  waveBannerTxt: {
    color: C.gold, fontSize: 38, fontWeight: '900', letterSpacing: 5,
    textShadowColor: C.blood, textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 },
  },
  waveBannerSub: { color: C.blood, fontSize: 14, fontWeight: '800', letterSpacing: 7, marginTop: -8 },
  controls: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 22,
  },
  dpad: { flexDirection: 'row', gap: 14 },
  actions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  btn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.btnBg, borderWidth: 1.5, borderColor: C.btnBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  btnActive: { backgroundColor: C.btnActive, borderColor: C.gold },
  dvdBtn: {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  dvdBtnActive: { opacity: 0.7 },
  dvdIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#C0C0C0', borderWidth: 2.5, borderColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
  },
  dvdIconHole: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#505050' },
  // Intermission (round complete)
  interWrap: {
    backgroundColor: 'rgba(3,2,8,0.82)',
    alignItems: 'center', justifyContent: 'center', zIndex: 40,
  },
  interCard: {
    width: Math.min(SW - 44, 360),
    backgroundColor: 'rgba(10,7,16,0.97)',
    borderWidth: 1.5, borderColor: '#3A2A0A',
    borderRadius: 18, paddingHorizontal: 24, paddingVertical: 22,
  },
  interTitle: {
    color: C.gold, fontSize: 26, fontWeight: '900', letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: C.blood, textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  interBoss: {
    color: '#FF4D4D', fontSize: 12, fontWeight: '900', letterSpacing: 4,
    textAlign: 'center', marginTop: 2,
  },
  interDivider: { height: 1, backgroundColor: '#3A2A0A', marginVertical: 14 },
  interRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5,
  },
  interLabel: { color: '#8A7040', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  interVal: { color: C.white, fontSize: 15, fontWeight: '900' },
  interDim: { color: '#6A6A6A', fontSize: 11, fontWeight: '600' },
  interBtn: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#CC2200', borderRadius: 40,
    paddingVertical: 14,
    shadowColor: '#CC2200', shadowRadius: 14, shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  interBtnPressed: { backgroundColor: '#A01600' },
  interBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  btnPuIcon: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8, padding: 1,
  },
});
