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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  skyTop: '#08060A',
  skyBot: '#100E18',
  ground: '#1A0A00',
  groundTop: '#2A1A04',
  treeCol: '#06080A',
  hillCol: '#0C1008',
  // Bill
  billCap: '#5C4A20',
  billCapBrim: '#4A3818',
  billHead: '#7AAF5A',
  billBeard: '#3A2510',
  billShirt: '#8B2020',
  billShirtDark: '#5A0A0A',
  billGlasses: '#1A1A1A',
  // Zombie enemies
  zombie0Body: '#556644',
  zombie0Head: '#6A9050',
  zombie0Shirt: '#3A4C30',
  zombie1Body: '#5A5040',
  zombie1Head: '#78706A',
  zombie1Shirt: '#443830',
  zombie2Body: '#4A6030',
  zombie2Head: '#648048',
  zombie2Shirt: '#2A3820',
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
};

// ── Layout ────────────────────────────────────────────────────────────────────
const HUD_H = 54;
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
const ATTACK_RANGE = 100;
const ATTACK_DMG = 38;
const ATTACK_DUR = 350;
const IFRAME_DUR = 900;
const DVD_SPEED = 7.5; // per tick pixels in world
const DVD_LIFETIME = 500; // ms

const ENEMY_W = 26;
const ENEMY_H = 50;
const ENEMY_HEAD_D = 19;
const ENEMY_SPD = 2.0;
const ENEMY_MAX_HP = 80;
const ENEMY_ATK_RANGE = 44;
const ENEMY_DMG = 12;
const ENEMY_ATK_CD = 1600;

const SCORE_PER_KILL = 100;
const WAVE_BONUS = 500;
const SPAWN_DIST = SW + 130;
const HS_KEY = 'zb_hs';

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
  wx: number;   // world X
  dir: number;  // 1 | -1
  t: number;    // ms elapsed
}

interface HitEffect {
  id: string;
  wx: number;
  t: number;
  text: string;
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
    enemies: [], dvds: [], hitEffects: [], nextId: 0,
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
    id: `e${g.nextId}`,
    etype,
    wx: g.wx + side * (SPAWN_DIST + jitter),
    hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP,
    atkCd: 600,
    dead: false, fade: 1, step: 0,
  });
}

function gameTick(g: GS, holdL: boolean, holdR: boolean) {
  if (g.phase !== 'playing') return;

  if (holdL) { g.wx -= PLAYER_SPD; g.faceR = false; }
  if (holdR) { g.wx += PLAYER_SPD; g.faceR = true; }
  if ((holdL || holdR) && g.grounded) g.step += TICK_MS;

  g.vy += GRAV;
  g.ay -= g.vy;
  if (g.ay <= 0) {
    g.ay = 0; g.vy = 0; g.grounded = true;
  } else {
    g.grounded = false;
  }

  if (g.atkT > 0) { g.atkT -= TICK_MS; if (g.atkT <= 0) g.atkActive = false; }
  if (g.iframeT > 0) g.iframeT -= TICK_MS;
  if (g.dmgFlash > 0) g.dmgFlash -= TICK_MS;
  if (g.waveMsg > 0) g.waveMsg -= TICK_MS;

  // Update DVDs (world position)
  g.dvds = g.dvds.filter(d => d.t < DVD_LIFETIME);
  for (const d of g.dvds) {
    d.wx += d.dir * DVD_SPEED;
    d.t += TICK_MS;
  }

  // Update hit effects
  g.hitEffects = g.hitEffects.filter(h => h.t < 750);
  for (const h of g.hitEffects) h.t += TICK_MS;

  // Enemies
  const keep: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.dead) {
      e.fade -= 0.032;
      if (e.fade > 0) keep.push(e);
      continue;
    }
    const dx = g.wx - e.wx;
    const dir = dx >= 0 ? 1 : -1;
    const dist = Math.abs(dx);

    if (dist > ENEMY_ATK_RANGE - 4) {
      e.wx += dir * ENEMY_SPD;
      e.step += TICK_MS;
    }

    if (e.atkCd > 0) e.atkCd -= TICK_MS;
    if (dist < ENEMY_ATK_RANGE && e.atkCd <= 0 && g.iframeT <= 0) {
      g.hp -= ENEMY_DMG;
      g.iframeT = IFRAME_DUR;
      g.dmgFlash = 280;
      e.atkCd = ENEMY_ATK_CD;
      if (g.hp <= 0) {
        g.hp = 0;
        g.phase = 'dead';
        return;
      }
    }
    keep.push(e);
  }
  g.enemies = keep;

  // Wave system
  const alive = g.enemies.filter(e => !e.dead).length;
  if (g.spawnQ > 0) {
    g.spawnT -= TICK_MS;
    if (g.spawnT <= 0) {
      spawnEnemy(g);
      g.spawnQ--;
      g.spawnT = 1200;
    }
  } else if (alive === 0) {
    g.clearDelay -= TICK_MS;
    if (g.clearDelay <= 0) {
      g.wave++;
      g.score += WAVE_BONUS;
      const cnt = Math.min(3 + (g.wave - 1) * 2, 14);
      g.spawnQ = cnt;
      g.spawnT = 800;
      g.clearDelay = 2500;
      g.waveMsg = 2500;
    }
  }
}

function doJump(g: GS) {
  if (g.grounded) {
    g.vy = JUMP_VY;
    g.grounded = false;
  }
}

function doAttack(g: GS) {
  if (g.atkActive) return;
  g.atkActive = true;
  g.atkT = ATTACK_DUR;

  const dir = g.faceR ? 1 : -1;

  // Launch DVD projectile
  g.dvds.push({ id: `d${++g.nextId}`, wx: g.wx + dir * 18, dir, t: 0 });

  // Instant hit detection (DVD "lands" in range)
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = (e.wx - g.wx) * dir;
    if (dx >= -8 && dx < ATTACK_RANGE) {
      e.hp -= ATTACK_DMG;
      g.hitEffects.push({
        id: `h${++g.nextId}`,
        wx: e.wx,
        t: 0,
        text: dx < ATTACK_RANGE * 0.5 ? 'THWACK!' : 'WHIZZZ!',
      });
      if (e.hp <= 0) {
        e.dead = true;
        e.fade = 1;
        g.score += SCORE_PER_KILL;
      }
    }
  }
}

// ── Background decorations ────────────────────────────────────────────────────
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
  { body: C.zombie0Body, head: C.zombie0Head, shirt: C.zombie0Shirt },
  { body: C.zombie1Body, head: C.zombie1Head, shirt: C.zombie1Shirt },
  { body: C.zombie2Body, head: C.zombie2Head, shirt: C.zombie2Shirt },
] as const;

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

  // ── Bill's render coords ───────────────────────────────────────────────────
  const pBob = g.grounded ? Math.sin(g.step / 140) * 2.5 : 0;
  const pOpacity = g.iframeT > 0 ? (Math.floor(g.iframeT / 85) % 2 === 0 ? 0.3 : 1) : 1;

  // Vertical positions
  const pBodyY = groundY - PLAYER_H - g.ay;
  const pHeadY = pBodyY - HEAD_D + 6;
  const pBeardY = pHeadY + HEAD_D - 7;
  const pHatBrimY = pHeadY - 4;
  const pHatTopY = pHatBrimY - HAT_H;

  // Horizontal (centered on SW/2)
  const pCX = SW / 2;
  const pBodyX = pCX - PLAYER_W / 2;
  const pHeadX = pCX - HEAD_D / 2;
  const pHatX = pCX - HAT_W / 2;
  const pBeardX = pCX - (HEAD_D / 2 + 3);

  const flicker = g.dmgFlash > 0;
  const billHeadCol = flicker ? '#A03020' : C.billHead;
  const billShirtCol = flicker ? C.blood : C.billShirt;

  // HP
  const hpPct = Math.max(0, g.hp / PLAYER_MAX_HP);
  const hpColor = hpPct > 0.55 ? C.hpGreen : hpPct > 0.28 ? C.hpOrange : C.hpRed;

  // Visible trees
  const visTrees = TREES.filter(t => {
    const sx = SW / 2 + (t.wx - g.wx) * 0.38;
    return sx > -90 && sx < SW + 90;
  });

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
        {/* Moon */}
        <View style={[st.moon, { top: topOff + HUD_H + 18, right: 55 }]} />
        {/* Hills */}
        <View style={[st.hill, { bottom: GROUND_H, left: -20, width: SW * 0.55, height: 70 }]} />
        <View style={[st.hill, { bottom: GROUND_H, left: SW * 0.38, width: SW * 0.65, height: 50 }]} />
        {/* Trees (parallax) */}
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

      {/* ── Hit effects (behind enemies) ── */}
      {g.hitEffects.map(eff => {
        const sx = SW / 2 + (eff.wx - g.wx);
        const prog = eff.t / 750;
        const col = eff.text === 'THWACK!' ? C.thwack : C.gold;
        return (
          <Text
            key={eff.id}
            style={{
              position: 'absolute',
              left: sx - 38,
              top: groundY - ENEMY_H - 18 - prog * 38,
              fontSize: 18,
              fontWeight: '900',
              color: col,
              opacity: 1 - prog,
              textShadowColor: '#000',
              textShadowRadius: 5,
              textShadowOffset: { width: 1, height: 1 },
              letterSpacing: 1,
            }}
            pointerEvents="none"
          >
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
            {/* HP bar */}
            {!e.dead && (
              <View style={[st.eHpBg, { left: ebx - 3, top: eHdY - 12, width: ENEMY_W + 6 }]}>
                <View style={[st.eHpFill, {
                  width: `${hpPctE * 100}%`,
                  backgroundColor: hpPctE > 0.5 ? C.hpGreen : C.hpRed,
                }]} />
              </View>
            )}
            {/* Zombie head */}
            <View style={{
              position: 'absolute', left: eHdX, top: eHdY + eBob,
              width: ENEMY_HEAD_D, height: ENEMY_HEAD_D,
              borderRadius: ENEMY_HEAD_D / 2, backgroundColor: ec.head,
              opacity: e.dead ? e.fade : 1,
            }} />
            {/* Zombie eye (white) */}
            {!e.dead && (
              <View style={{
                position: 'absolute',
                left: faceR ? eHdX + 4 : eHdX + ENEMY_HEAD_D - 9,
                top: eHdY + 6 + eBob,
                width: 5, height: 4, borderRadius: 2, backgroundColor: '#EEEEDD',
              }} />
            )}
            {/* Zombie body / shirt */}
            <View style={{
              position: 'absolute', left: ebx, top: eTopY + eBob,
              width: ENEMY_W, height: ENEMY_H,
              backgroundColor: ec.body, borderRadius: 4,
              opacity: e.dead ? e.fade : 1,
            }} />
            {/* Shirt detail */}
            {!e.dead && e.etype === 1 && (
              <View style={{
                position: 'absolute', left: ebx + 5, top: eTopY + 8 + eBob,
                width: ENEMY_W - 10, height: 12,
                backgroundColor: '#2A2018', borderRadius: 3,
              }} />
            )}
            {/* Reaching arm toward player */}
            {!e.dead && (
              <View style={{
                position: 'absolute', left: armX, top: eTopY + 12 + eBob,
                width: 18, height: 8, backgroundColor: ec.head, borderRadius: 4,
              }} />
            )}
            {/* Blood pool on death */}
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
        const rot = dvd.dir * prog * 720; // spin degrees (visual hint only)
        return (
          <View
            key={dvd.id}
            style={{
              position: 'absolute',
              left: screenX - 11, top: pBodyY + 16,
              width: 22, height: 22,
              borderRadius: 11,
              backgroundColor: C.dvdSilver,
              borderWidth: 2.5,
              borderColor: C.dvdShine,
              opacity: Math.max(0, 1 - prog * 0.7),
              transform: [{ rotate: `${rot}deg` }],
            }}
            pointerEvents="none"
          >
            {/* Center hole */}
            <View style={{
              position: 'absolute', left: 6, top: 6,
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: C.dvdHole,
            }} />
            {/* Shine strip */}
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
          borderTopLeftRadius: 6, borderTopRightRadius: 6,
          opacity: pOpacity,
        }} />
        {/* Hat brim */}
        <View style={{
          position: 'absolute', left: pHatX - 6, top: pHatBrimY + pBob,
          width: HAT_W + 12, height: 5,
          backgroundColor: C.billCapBrim, borderRadius: 2,
          opacity: pOpacity,
        }} />
        {/* Cap logo dot */}
        <View style={{
          position: 'absolute', left: pCX - 3, top: pHatTopY + 3 + pBob,
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: '#8B1A00', opacity: pOpacity,
        }} />

        {/* Head */}
        <View style={{
          position: 'absolute', left: pHeadX, top: pHeadY + pBob,
          width: HEAD_D, height: HEAD_D,
          borderRadius: HEAD_D / 2,
          backgroundColor: billHeadCol, opacity: pOpacity,
        }} />
        {/* Glasses — left lens */}
        <View style={{
          position: 'absolute', left: pHeadX + 1, top: pHeadY + 9 + pBob,
          width: 7, height: 5, borderRadius: 2,
          borderWidth: 1.5, borderColor: C.billGlasses,
          backgroundColor: 'rgba(0,0,0,0.35)', opacity: pOpacity,
        }} />
        {/* Glasses — right lens */}
        <View style={{
          position: 'absolute', left: pHeadX + 11, top: pHeadY + 9 + pBob,
          width: 7, height: 5, borderRadius: 2,
          borderWidth: 1.5, borderColor: C.billGlasses,
          backgroundColor: 'rgba(0,0,0,0.35)', opacity: pOpacity,
        }} />
        {/* Glasses — bridge */}
        <View style={{
          position: 'absolute', left: pHeadX + 8, top: pHeadY + 11 + pBob,
          width: 3, height: 1.5, backgroundColor: C.billGlasses, opacity: pOpacity,
        }} />

        {/* Beard */}
        <View style={{
          position: 'absolute', left: pBeardX, top: pBeardY + pBob,
          width: HEAD_D + 6, height: BEARD_H,
          backgroundColor: C.billBeard,
          borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
          opacity: pOpacity,
        }} />

        {/* Flannel shirt body */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + pBob,
          width: PLAYER_W, height: PLAYER_H,
          backgroundColor: billShirtCol, borderRadius: 5, opacity: pOpacity,
        }} />
        {/* Plaid horizontal stripe */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H / 3 + pBob,
          width: PLAYER_W, height: 4,
          backgroundColor: C.billShirtDark, opacity: pOpacity * 0.55,
        }} />
        {/* Plaid horizontal stripe 2 */}
        <View style={{
          position: 'absolute', left: pBodyX, top: pBodyY + PLAYER_H * 0.65 + pBob,
          width: PLAYER_W, height: 4,
          backgroundColor: C.billShirtDark, opacity: pOpacity * 0.55,
        }} />
        {/* Plaid vertical stripe */}
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W / 3, top: pBodyY + pBob,
          width: 3, height: PLAYER_H,
          backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
        }} />
        {/* Plaid vertical stripe 2 */}
        <View style={{
          position: 'absolute', left: pBodyX + PLAYER_W * 0.68, top: pBodyY + pBob,
          width: 3, height: PLAYER_H,
          backgroundColor: C.billShirtDark, opacity: pOpacity * 0.45,
        }} />

        {/* Throwing arm (shown briefly when attacking) */}
        {g.atkActive && (
          <View style={{
            position: 'absolute',
            left: g.faceR ? pBodyX + PLAYER_W : pBodyX - 28,
            top: pBodyY + 14 + pBob,
            width: 28, height: 10,
            backgroundColor: billShirtCol, borderRadius: 5,
            opacity: pOpacity,
          }} />
        )}
      </View>

      {/* ── HUD ── */}
      <View style={[st.hud, { top: topOff, height: HUD_H }]}>
        <View style={st.hudWave}>
          <Text style={st.hudWaveTxt}>WAVE</Text>
          <Text style={st.hudWaveNum}>{g.wave}</Text>
        </View>
        <View style={st.hudScore}>
          <Text style={st.hudScoreTxt}>{g.score.toLocaleString()}</Text>
        </View>
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
            style={({ pressed }) => [st.btn, st.dvdBtn, pressed && st.dvdBtnActive]}
            onPress={() => { doAttack(gsRef.current); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
          >
            {/* DVD icon */}
            <View style={st.dvdIcon}>
              <View style={st.dvdIconHole} />
            </View>
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
  groundTop: {
    position: 'absolute', left: 0, right: 0, height: 7,
    backgroundColor: '#2A1A04',
  },
  hud: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.hudBg, paddingHorizontal: 14, gap: 10,
  },
  hudWave: { width: 72, alignItems: 'flex-start' },
  hudWaveTxt: { color: '#5A4010', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  hudWaveNum: { color: C.goldDim, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  hudScore: { flex: 1, alignItems: 'center' },
  hudScoreTxt: { color: C.gold, fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  hudHp: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 110 },
  hpBar: { flex: 1, height: 10, backgroundColor: '#180808', borderRadius: 5, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpNum: { color: C.white, fontSize: 11, fontWeight: '700', width: 26, textAlign: 'right' },
  eHpBg: {
    position: 'absolute', height: 5,
    backgroundColor: '#0A0F0A', borderRadius: 3, overflow: 'hidden',
  },
  eHpFill: { height: '100%', borderRadius: 3 },
  waveBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  waveBannerTxt: {
    color: C.gold, fontSize: 38, fontWeight: '900', letterSpacing: 5,
    textShadowColor: C.blood, textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 2 },
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
    backgroundColor: C.atkBtnBg, borderColor: C.atkBtnBorder,
  },
  dvdBtnActive: { backgroundColor: 'rgba(180,60,0,0.45)', borderColor: C.gold },
  dvdIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#C0C0C0', borderWidth: 2.5, borderColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
  },
  dvdIconHole: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#505050',
  },
});
