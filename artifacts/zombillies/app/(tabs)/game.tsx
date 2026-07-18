import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
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
  // Bill
  billCap: '#5C4A20',
  billCapBrim: '#4A3818',
  billHead: '#7AAF5A',
  billBeard: '#3A2510',
  billShirt: '#8B2020',
  billShirtDark: '#5A0A0A',
  billGlasses: '#1A1A1A',
  // Enemies
  zombie0Body: '#556644',
  zombie0Head: '#6A9050',
  zombie1Body: '#5A5040',
  zombie1Head: '#78706A',
  zombie2Body: '#4A6030',
  zombie2Head: '#648048',
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
const BEARD_H = 14;
const PLAYER_SPD = 5.5;
const JUMP_VY = -15.5;
const GRAV = 0.72;
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

// Scoring / waves
const SCORE_PER_KILL = 100;
const WAVE_BONUS = 500;
const SPAWN_DIST = SW + 130;
const HS_KEY = 'zb_hs';

// Power-ups
const POWERUP_DURATION = 10000;  // 10 s
const POWERUP_PICKUP_R = 38;     // pickup radius (world px)
const POWERUP_FIRST_SPAWN = 10000;
const POWERUP_RESPAWN = 18000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Enemy {
  id: string;
  etype: 0 | 1 | 2;
  wx: number;
  hp: number;
  maxHp: number;
  atkCd: number;
  dead: boolean;
  fade: number;
  step: number;
}

interface DVDProj {
  id: string;
  wx: number;
  dir: number;
  t: number;
  yOff: number;   // screen-Y offset from body center (for spread)
}

interface HitEffect {
  id: string;
  wx: number;
  t: number;
  text: string;
}

interface Powerup {
  id: string;
  type: 'ketchup' | 'chili';
  wx: number;
  bobT: number;  // for idle float animation
}

interface GS {
  phase: 'playing' | 'dead';
  wx: number;
  vy: number;
  ay: number;
  grounded: boolean;
  faceR: boolean;
  hp: number;
  atkActive: boolean;
  atkT: number;
  iframeT: number;
  dmgFlash: number;
  step: number;
  enemies: Enemy[];
  dvds: DVDProj[];
  hitEffects: HitEffect[];
  powerups: Powerup[];
  activePowerup: 'ketchup' | 'chili' | null;
  powerupT: number;
  powerupSpawnT: number;
  nextId: number;
  score: number;
  wave: number;
  spawnQ: number;
  spawnT: number;
  clearDelay: number;
  waveMsg: number;
}

// ── Game logic ────────────────────────────────────────────────────────────────
function mkGS(): GS {
  return {
    phase: 'playing',
    wx: 0, vy: 0, ay: 0, grounded: true, faceR: true,
    hp: PLAYER_MAX_HP,
    atkActive: false, atkT: 0, iframeT: 0, dmgFlash: 0, step: 0,
    enemies: [], dvds: [], hitEffects: [],
    powerups: [], activePowerup: null, powerupT: 0,
    powerupSpawnT: POWERUP_FIRST_SPAWN,
    nextId: 0,
    score: 0, wave: 1,
    spawnQ: 3, spawnT: 1000,
    clearDelay: 2500, waveMsg: 2500,
  };
}

function spawnEnemy(g: GS) {
  const side = g.nextId % 2 === 0 ? 1 : -1;
  g.nextId++;
  const jitter = (g.nextId % 5) * 40;
  const etype = (g.nextId % 3) as 0 | 1 | 2;
  g.enemies.push({
    id: `e${g.nextId}`, etype,
    wx: g.wx + side * (SPAWN_DIST + jitter),
    hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP,
    atkCd: 600, dead: false, fade: 1, step: 0,
  });
}

function gameTick(g: GS, holdL: boolean, holdR: boolean) {
  if (g.phase !== 'playing') return;

  // Player movement
  if (holdL) { g.wx -= PLAYER_SPD; g.faceR = false; }
  if (holdR) { g.wx += PLAYER_SPD; g.faceR = true; }
  if ((holdL || holdR) && g.grounded) g.step += TICK_MS;

  // Vertical physics
  g.vy += GRAV;
  g.ay -= g.vy;
  if (g.ay <= 0) { g.ay = 0; g.vy = 0; g.grounded = true; }
  else g.grounded = false;

  // Timers
  if (g.atkT > 0) { g.atkT -= TICK_MS; if (g.atkT <= 0) g.atkActive = false; }
  if (g.iframeT > 0) g.iframeT -= TICK_MS;
  if (g.dmgFlash > 0) g.dmgFlash -= TICK_MS;
  if (g.waveMsg > 0) g.waveMsg -= TICK_MS;

  // Active power-up countdown
  if (g.powerupT > 0) { g.powerupT -= TICK_MS; if (g.powerupT <= 0) g.activePowerup = null; }

  // Power-up spawn
  g.powerupSpawnT -= TICK_MS;
  if (g.powerupSpawnT <= 0 && g.powerups.length < 2) {
    const side = g.nextId % 2 === 0 ? 1 : -1;
    // Alternate between ketchup and chili
    const type = (g.nextId % 2 === 0) ? 'ketchup' : 'chili';
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
      g.activePowerup = p.type;
      g.powerupT = POWERUP_DURATION;
    } else {
      remaining.push(p);
    }
  }
  g.powerups = remaining;

  // DVDs
  g.dvds = g.dvds.filter(d => d.t < DVD_LIFETIME);
  for (const d of g.dvds) { d.wx += d.dir * 8; d.t += TICK_MS; }

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

    if (dist > ENEMY_ATK_RANGE - 4) { e.wx += dir * ENEMY_SPD; e.step += TICK_MS; }

    if (e.atkCd > 0) e.atkCd -= TICK_MS;
    if (dist < ENEMY_ATK_RANGE && e.atkCd <= 0 && g.iframeT <= 0) {
      g.hp -= ENEMY_DMG;
      g.iframeT = IFRAME_DUR;
      g.dmgFlash = 280;
      e.atkCd = ENEMY_ATK_CD;
      if (g.hp <= 0) { g.hp = 0; g.phase = 'dead'; return; }
    }
    keepE.push(e);
  }
  g.enemies = keepE;

  // Wave system
  const alive = g.enemies.filter(e => !e.dead).length;
  if (g.spawnQ > 0) {
    g.spawnT -= TICK_MS;
    if (g.spawnT <= 0) { spawnEnemy(g); g.spawnQ--; g.spawnT = 1200; }
  } else if (alive === 0) {
    g.clearDelay -= TICK_MS;
    if (g.clearDelay <= 0) {
      g.wave++;
      g.score += WAVE_BONUS;
      const cnt = Math.min(3 + (g.wave - 1) * 2, 14);
      g.spawnQ = cnt; g.spawnT = 800;
      g.clearDelay = 2500; g.waveMsg = 2500;
    }
  }
}

function doJump(g: GS) {
  if (g.grounded) { g.vy = JUMP_VY; g.grounded = false; }
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
  const range = isKetchup ? KETCHUP_RANGE : ATTACK_RANGE;
  const dmg = Math.round(ATTACK_DMG * (isChili ? CHILI_DMG_MULT : 1));

  if (isKetchup) {
    // Spread shot: 3 DVDs at different Y offsets
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: -22 });
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: 0 });
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 20, dir, t: 0, yOff: 22 });
  } else {
    g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 18, dir, t: 0, yOff: 0 });
  }

  // Hit enemies in range
  let hitCount = 0;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = (e.wx - g.wx) * dir;
    if (dx >= -8 && dx < range) {
      e.hp -= dmg;
      hitCount++;
      const hitTxt = hitCount > 1 ? 'THWACK!' : dx < range * 0.45 ? 'THWACK!' : 'WHIZZZ!';
      g.hitEffects.push({ id: `h${++g.nextId}`, wx: e.wx, t: 0, text: hitTxt });
      if (e.hp <= 0) { e.dead = true; e.fade = 1; g.score += SCORE_PER_KILL; }
    }
  }
}

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
  { body: C.zombie0Body, head: C.zombie0Head, shirt: '#3A4C30' },
  { body: C.zombie1Body, head: C.zombie1Head, shirt: '#443830' },
  { body: C.zombie2Body, head: C.zombie2Head, shirt: '#2A3820' },
] as const;

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const gsRef = useRef<GS>(mkGS());
  const [, setFrame] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const held = useRef({ l: false, r: false });

  const topOff = insets.top + WEB_TOP;
  const botOff = insets.bottom + WEB_BOT;
  const gameH = SH - topOff - HUD_H - CTRL_H - botOff;
  const groundY = topOff + HUD_H + gameH - GROUND_H;

  const tickFn = useCallback(() => {
    const g = gsRef.current;
    gameTick(g, held.current.l, held.current.r);
    if (g.phase === 'dead') setIsDead(true);
    else setFrame(f => f + 1);
  }, []);

  useEffect(() => {
    const id = setInterval(tickFn, TICK_MS);
    return () => clearInterval(id);
  }, [tickFn]);

  useEffect(() => {
    if (!isDead) return;
    const g = gsRef.current;
    AsyncStorage.getItem(HS_KEY).then(val => {
      const prev = val ? parseInt(val) : 0;
      const isNew = g.score > prev;
      const hs = isNew ? g.score : prev;
      if (isNew) AsyncStorage.setItem(HS_KEY, String(g.score));
      router.replace({
        pathname: '/(tabs)/gameover',
        params: { score: String(g.score), wave: String(g.wave), hs: String(hs), newHs: isNew ? '1' : '0' },
      });
    });
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
  const pBeardX = pCX - (HEAD_D / 2 + 3);

  const flicker = g.dmgFlash > 0;
  const billHeadCol = flicker ? '#A03020' : C.billHead;
  const billShirtCol = flicker ? C.blood : C.billShirt;

  const hpPct = Math.max(0, g.hp / PLAYER_MAX_HP);
  const hpColor = hpPct > 0.55 ? C.hpGreen : hpPct > 0.28 ? C.hpOrange : C.hpRed;

  const visTrees = TREES.filter(t => {
    const sx = SW / 2 + (t.wx - g.wx) * 0.38;
    return sx > -90 && sx < SW + 90;
  });

  // Power-up timer fraction
  const puFrac = g.activePowerup ? g.powerupT / POWERUP_DURATION : 0;
  const isKetchupActive = g.activePowerup === 'ketchup';
  const isChiliActive = g.activePowerup === 'chili';

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
    <View style={[st.root, { backgroundColor: C.skyTop }]}>

      {/* ── Sky ── */}
      <View style={[st.sky, { height: groundY, backgroundColor: C.skyBot }]}>
        {STARS.map((star, i) => (
          <View key={i} style={{
            position: 'absolute', left: star.x, top: star.y + topOff + HUD_H,
            width: star.r * 2, height: star.r * 2, borderRadius: star.r,
            backgroundColor: C.starCol,
          }} />
        ))}
        <View style={[st.moon, { top: topOff + HUD_H + 18, right: 55 }]} />
        <View style={[st.hill, { bottom: GROUND_H, left: -20, width: SW * 0.55, height: 70 }]} />
        <View style={[st.hill, { bottom: GROUND_H, left: SW * 0.38, width: SW * 0.65, height: 50 }]} />
        {visTrees.map((t, i) => {
          const sx = SW / 2 + (t.wx - g.wx) * 0.38 - t.w / 2;
          return (
            <View key={i} style={{
              position: 'absolute', left: sx, bottom: GROUND_H - 2,
              width: t.w, height: t.h, backgroundColor: C.treeCol,
              borderTopLeftRadius: t.w / 2, borderTopRightRadius: t.w / 2,
            }} />
          );
        })}
      </View>

      {/* ── Ground ── */}
      <View style={[st.ground, { top: groundY, height: GROUND_H, backgroundColor: C.ground }]} />
      <View style={[st.groundTop, { top: groundY }]} />

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
              left: p.type === 'ketchup' ? -8 : -6,
              top: p.type === 'ketchup' ? -4 : -4,
              width: p.type === 'ketchup' ? 34 : 48,
              height: p.type === 'ketchup' ? 46 : 38,
              borderRadius: 10,
              backgroundColor: p.type === 'ketchup' ? 'rgba(200,30,0,0.18)' : 'rgba(180,80,0,0.18)',
              borderWidth: 1.5,
              borderColor: p.type === 'ketchup' ? 'rgba(255,80,0,0.45)' : 'rgba(255,140,0,0.45)',
            }} />
            {p.type === 'ketchup'
              ? <KetchupIcon size={1} />
              : <ChiliBowlIcon size={1} />
            }
            <Text style={{
              color: p.type === 'ketchup' ? '#FF8060' : '#FFAA40',
              fontSize: 8, fontWeight: '900', letterSpacing: 1,
              textAlign: 'center', marginTop: 2,
            }}>
              {p.type === 'ketchup' ? 'SPREAD' : 'RAPID'}
            </Text>
          </View>
        );
      })}

      {/* ── Hit effects ── */}
      {g.hitEffects.map(eff => {
        const sx = SW / 2 + (eff.wx - g.wx);
        const prog = eff.t / 750;
        const col = eff.text === 'THWACK!' ? C.thwack : '#FF8844';
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
        const ecx = SW / 2 + (e.wx - g.wx);
        const ebx = ecx - ENEMY_W / 2;
        const eTopY = groundY - ENEMY_H;
        const eHdX = ecx - ENEMY_HEAD_D / 2;
        const eHdY = eTopY - ENEMY_HEAD_D + 5;
        const faceR = e.wx < g.wx;
        const eBob = Math.sin(e.step / 145) * 2;
        const armX = faceR ? ebx + ENEMY_W - 2 : ebx - 18;
        const hpPctE = Math.max(0, e.hp / e.maxHp);
        const ec = ENEMY_COLS[e.etype];

        return (
          <View key={e.id} style={StyleSheet.absoluteFill} pointerEvents="none">
            {!e.dead && (
              <View style={[st.eHpBg, { left: ebx - 3, top: eHdY - 12, width: ENEMY_W + 6 }]}>
                <View style={[st.eHpFill, {
                  width: `${hpPctE * 100}%`,
                  backgroundColor: hpPctE > 0.5 ? C.hpGreen : C.hpRed,
                }]} />
              </View>
            )}
            <View style={{
              position: 'absolute', left: eHdX, top: eHdY + eBob,
              width: ENEMY_HEAD_D, height: ENEMY_HEAD_D,
              borderRadius: ENEMY_HEAD_D / 2, backgroundColor: ec.head,
              opacity: e.dead ? e.fade : 1,
            }} />
            {!e.dead && (
              <View style={{
                position: 'absolute',
                left: faceR ? eHdX + 4 : eHdX + ENEMY_HEAD_D - 9,
                top: eHdY + 6 + eBob,
                width: 5, height: 4, borderRadius: 2, backgroundColor: '#EEEEDD',
              }} />
            )}
            <View style={{
              position: 'absolute', left: ebx, top: eTopY + eBob,
              width: ENEMY_W, height: ENEMY_H,
              backgroundColor: ec.body, borderRadius: 4,
              opacity: e.dead ? e.fade : 1,
            }} />
            {!e.dead && (
              <View style={{
                position: 'absolute', left: armX, top: eTopY + 12 + eBob,
                width: 18, height: 8, backgroundColor: ec.head, borderRadius: 4,
              }} />
            )}
            {e.dead && e.fade > 0.3 && (
              <View style={{
                position: 'absolute', left: ebx - 4, top: groundY - 8,
                width: ENEMY_W + 8, height: 8,
                backgroundColor: C.blood, borderRadius: 5, opacity: e.fade * 0.8,
              }} />
            )}
          </View>
        );
      })}

      {/* ── Flying DVDs ── */}
      {g.dvds.map(dvd => {
        const screenX = SW / 2 + (dvd.wx - g.wx);
        const prog = dvd.t / DVD_LIFETIME;
        const rot = dvd.dir * prog * 720;
        const dvdY = pBodyY + 18 + dvd.yOff;
        if (screenX < -20 || screenX > SW + 20) return null;
        return (
          <View key={dvd.id} style={{
            position: 'absolute',
            left: screenX - 11, top: dvdY,
            width: 22, height: 22,
            borderRadius: 11,
            backgroundColor: isKetchupActive ? '#E88080' : C.dvdSilver,
            borderWidth: 2.5, borderColor: C.dvdShine,
            opacity: Math.max(0, 1 - prog * 0.65),
            transform: [{ rotate: `${rot}deg` }],
          }} pointerEvents="none">
            <View style={{
              position: 'absolute', left: 6, top: 6,
              width: 8, height: 8, borderRadius: 4, backgroundColor: C.dvdHole,
            }} />
            <View style={{
              position: 'absolute', left: 3, top: 2,
              width: 5, height: 2, borderRadius: 1,
              backgroundColor: '#FFFFFF', opacity: 0.7,
            }} />
          </View>
        );
      })}

      {/* ── Bill (player) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Hat top */}
        <View style={{
          position: 'absolute', left: pHatX, top: pHatTopY + pBob,
          width: HAT_W, height: HAT_H,
          backgroundColor: C.billCap,
          borderTopLeftRadius: 6, borderTopRightRadius: 6, opacity: pOpacity,
        }} />
        {/* Hat brim */}
        <View style={{
          position: 'absolute', left: pHatX - 6, top: pHatBrimY + pBob,
          width: HAT_W + 12, height: 5,
          backgroundColor: C.billCapBrim, borderRadius: 2, opacity: pOpacity,
        }} />
        {/* Cap logo dot */}
        <View style={{
          position: 'absolute', left: pCX - 3, top: pHatTopY + 3 + pBob,
          width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B1A00', opacity: pOpacity,
        }} />
        {/* Head */}
        <View style={{
          position: 'absolute', left: pHeadX, top: pHeadY + pBob,
          width: HEAD_D, height: HEAD_D,
          borderRadius: HEAD_D / 2, backgroundColor: billHeadCol, opacity: pOpacity,
        }} />
        {/* Glasses left */}
        <View style={{
          position: 'absolute', left: pHeadX + 1, top: pHeadY + 9 + pBob,
          width: 7, height: 5, borderRadius: 2,
          borderWidth: 1.5, borderColor: C.billGlasses,
          backgroundColor: 'rgba(0,0,0,0.35)', opacity: pOpacity,
        }} />
        {/* Glasses right */}
        <View style={{
          position: 'absolute', left: pHeadX + 11, top: pHeadY + 9 + pBob,
          width: 7, height: 5, borderRadius: 2,
          borderWidth: 1.5, borderColor: C.billGlasses,
          backgroundColor: 'rgba(0,0,0,0.35)', opacity: pOpacity,
        }} />
        {/* Glasses bridge */}
        <View style={{
          position: 'absolute', left: pHeadX + 8, top: pHeadY + 11 + pBob,
          width: 3, height: 1.5, backgroundColor: C.billGlasses, opacity: pOpacity,
        }} />
        {/* Beard */}
        <View style={{
          position: 'absolute', left: pBeardX, top: pBeardY + pBob,
          width: HEAD_D + 6, height: BEARD_H,
          backgroundColor: C.billBeard,
          borderBottomLeftRadius: 7, borderBottomRightRadius: 7, opacity: pOpacity,
        }} />
        {/* Shirt body */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + pBob,
          width: PLAYER_W, height: PLAYER_H,
          backgroundColor: billShirtCol, borderRadius: 5, opacity: pOpacity,
        }} />
        {/* Plaid H */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H / 3 + pBob,
          width: PLAYER_W, height: 4, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.55,
        }} />
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H * 0.65 + pBob,
          width: PLAYER_W, height: 4, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.55,
        }} />
        {/* Plaid V */}
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W / 3, top: pBodyY + pBob,
          width: 3, height: PLAYER_H, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
        }} />
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W * 0.68, top: pBodyY + pBob,
          width: 3, height: PLAYER_H, backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
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
        </View>
        {/* Score + power-up indicator */}
        <View style={st.hudCenter}>
          <Text style={st.hudScoreTxt}>{g.score.toLocaleString()}</Text>
          {/* Active power-up bar */}
          {g.activePowerup && (
            <View style={st.puBar}>
              <View style={[st.puBarFill, {
                width: `${puFrac * 100}%`,
                backgroundColor: isKetchupActive ? '#FF4422' : '#FF9900',
              }]} />
              <Text style={[st.puLabel, { color: isKetchupActive ? '#FF8866' : '#FFBB44' }]}>
                {isKetchupActive ? 'KETCHUP SPREAD' : 'CHILI RAPID FIRE'}
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
      </View>

      {/* Wave banner */}
      {g.waveMsg > 200 && (
        <View style={[st.waveBanner, { top: topOff + HUD_H + 28 }]}>
          <Text style={st.waveBannerTxt}>WAVE {g.wave}</Text>
          <Text style={st.waveBannerSub}>INCOMING!</Text>
        </View>
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
            onPress={() => { doJump(gsRef.current); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
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
  btnPuIcon: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8, padding: 1,
  },
});
