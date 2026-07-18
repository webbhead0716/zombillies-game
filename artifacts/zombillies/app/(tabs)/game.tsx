import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  skyTop: '#050810',
  skyBot: '#0A1220',
  ground: '#110800',
  groundTop: '#213A0E',
  treeCol: '#070D04',
  hillCol: '#091506',
  playerBody: '#3A6EA5',
  playerHead: '#CA8B5E',
  playerHat: '#5C3A15',
  zombieBody: '#4D7844',
  zombieHead: '#78A852',
  zombieArm: '#3D6037',
  blood: '#CC2200',
  atkGlow: 'rgba(255,210,0,0.25)',
  gold: '#F5C842',
  goldDim: '#C5A028',
  hudBg: 'rgba(3,5,12,0.92)',
  hpGreen: '#27AE60',
  hpOrange: '#E67E22',
  hpRed: '#C0392B',
  btnBg: 'rgba(255,255,255,0.07)',
  btnActive: 'rgba(245,200,66,0.22)',
  btnBorder: 'rgba(255,255,255,0.12)',
  atkBtnBg: 'rgba(200,34,0,0.2)',
  atkBtnBorder: 'rgba(204,34,0,0.75)',
  starCol: 'rgba(255,255,200,0.6)',
  white: '#FFF',
};

// ── Layout ────────────────────────────────────────────────────────────────────
const HUD_H = 54;
const CTRL_H = 148;
const WEB_TOP = Platform.OS === 'web' ? 67 : 0;
const WEB_BOT = Platform.OS === 'web' ? 34 : 0;
const GROUND_H = 52;

// ── Game constants ────────────────────────────────────────────────────────────
const TICK_MS = 33;
const PLAYER_W = 28;
const PLAYER_H = 54;
const HEAD_D = 20;
const HAT_H = 11;
const HAT_W = 28;
const PLAYER_SPD = 5.5;
const JUMP_VY = -15.5;
const GRAV = 0.72;
const PLAYER_MAX_HP = 100;
const ATTACK_RANGE = 90;
const ATTACK_DMG = 35;
const ATTACK_DUR = 380;
const IFRAME_DUR = 900;

const ENEMY_W = 26;
const ENEMY_H = 50;
const ENEMY_HEAD_D = 19;
const ENEMY_SPD = 2.0;
const ENEMY_MAX_HP = 80;
const ENEMY_ATK_RANGE = 46;
const ENEMY_DMG = 12;
const ENEMY_ATK_CD = 1600;

const SCORE_PER_KILL = 100;
const WAVE_BONUS = 500;
const SPAWN_DIST = SW + 130;
const HS_KEY = 'zb_hs';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Enemy {
  id: string;
  wx: number;    // world center X
  hp: number;
  maxHp: number;
  atkCd: number;
  dead: boolean;
  fade: number;  // 1→0 on death
  step: number;  // walk anim ms counter
}

interface GS {
  phase: 'playing' | 'dead';
  wx: number;       // player world center X
  vy: number;       // vertical velocity (+down, -up)
  ay: number;       // pixels above ground (0=on ground)
  grounded: boolean;
  faceR: boolean;
  hp: number;
  atkActive: boolean;
  atkT: number;
  iframeT: number;
  dmgFlash: number;
  step: number;     // player walk anim ms counter
  enemies: Enemy[];
  nextId: number;
  score: number;
  wave: number;
  spawnQ: number;   // enemies left to spawn this wave
  spawnT: number;   // ms until next spawn
  clearDelay: number; // ms until next wave begins
  waveMsg: number;  // countdown for wave banner display
}

// ── Game logic (pure functions — no React deps) ────────────────────────────────
function mkGS(): GS {
  return {
    phase: 'playing',
    wx: 0, vy: 0, ay: 0, grounded: true, faceR: true,
    hp: PLAYER_MAX_HP,
    atkActive: false, atkT: 0, iframeT: 0, dmgFlash: 0, step: 0,
    enemies: [], nextId: 0,
    score: 0, wave: 1,
    spawnQ: 3, spawnT: 1000,
    clearDelay: 2500, waveMsg: 2500,
  };
}

function spawnEnemy(g: GS) {
  const side = g.nextId % 2 === 0 ? 1 : -1;
  g.nextId++;
  const jitter = (g.nextId % 5) * 40;
  g.enemies.push({
    id: `e${g.nextId}`,
    wx: g.wx + side * (SPAWN_DIST + jitter),
    hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP,
    atkCd: 800,
    dead: false, fade: 1, step: 0,
  });
}

function gameTick(g: GS, holdL: boolean, holdR: boolean) {
  if (g.phase !== 'playing') return;

  // Player horizontal movement
  if (holdL) { g.wx -= PLAYER_SPD; g.faceR = false; }
  if (holdR) { g.wx += PLAYER_SPD; g.faceR = true; }
  if ((holdL || holdR) && g.grounded) g.step += TICK_MS;

  // Vertical physics: vy positive = falling, ay positive = above ground
  g.vy += GRAV;
  g.ay -= g.vy;
  if (g.ay <= 0) {
    g.ay = 0; g.vy = 0; g.grounded = true;
  } else {
    g.grounded = false;
  }

  // Countdown timers
  if (g.atkT > 0) { g.atkT -= TICK_MS; if (g.atkT <= 0) g.atkActive = false; }
  if (g.iframeT > 0) g.iframeT -= TICK_MS;
  if (g.dmgFlash > 0) g.dmgFlash -= TICK_MS;
  if (g.waveMsg > 0) g.waveMsg -= TICK_MS;

  // Enemies
  const keep: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.dead) {
      e.fade -= 0.035;
      if (e.fade > 0) keep.push(e);
      continue;
    }
    const dx = g.wx - e.wx;
    const dir = dx >= 0 ? 1 : -1;
    const dist = Math.abs(dx);

    // Move toward player, stop just inside attack range
    if (dist > ENEMY_ATK_RANGE - 4) {
      e.wx += dir * ENEMY_SPD;
      e.step += TICK_MS;
    }

    // Enemy attacks player
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

  // Wave / spawn logic
  const alive = g.enemies.filter(e => !e.dead).length;
  if (g.spawnQ > 0) {
    g.spawnT -= TICK_MS;
    if (g.spawnT <= 0) {
      spawnEnemy(g);
      g.spawnQ--;
      g.spawnT = 1200;
    }
  } else if (alive === 0) {
    // All clear — countdown to next wave
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
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = (e.wx - g.wx) * dir;
    if (dx >= -10 && dx < ATTACK_RANGE) {
      e.hp -= ATTACK_DMG;
      if (e.hp <= 0) {
        e.dead = true;
        e.fade = 1;
        g.score += SCORE_PER_KILL;
      }
    }
  }
}

// ── Background decorations (module-level, computed once) ──────────────────────
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
    if (g.phase === 'dead') {
      setIsDead(true);
    } else {
      setFrame(f => f + 1);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(tickFn, TICK_MS);
    return () => clearInterval(id);
  }, [tickFn]);

  // On death: save high score and navigate
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
        params: {
          score: String(g.score),
          wave: String(g.wave),
          hs: String(hs),
          newHs: isNew ? '1' : '0',
        },
      });
    });
  }, [isDead]);

  const g = gsRef.current;

  // ── Derived render coords ──────────────────────────────────────────────────
  const pBodyX = SW / 2 - PLAYER_W / 2;
  const pBodyY = groundY - PLAYER_H - g.ay;
  const pHeadX = SW / 2 - HEAD_D / 2;
  const pHeadY = pBodyY - HEAD_D + 5;
  const pHatX = SW / 2 - HAT_W / 2;
  const pHatY = pHeadY - HAT_H + 3;
  const pBob = g.grounded ? Math.sin(g.step / 140) * 2.5 : 0;
  const pOpacity = g.iframeT > 0 ? (Math.floor(g.iframeT / 90) % 2 === 0 ? 0.3 : 1) : 1;
  const pBodyColor = g.dmgFlash > 0 ? C.blood : C.playerBody;
  const pHeadColor = g.dmgFlash > 0 ? '#A03020' : C.playerHead;
  const atkArmX = g.faceR ? SW / 2 + PLAYER_W / 2 : SW / 2 - PLAYER_W / 2 - 38;
  const atkGlowX = g.faceR ? SW / 2 - 6 : SW / 2 - ATTACK_RANGE - 6;

  // HP color
  const hpPct = Math.max(0, g.hp / PLAYER_MAX_HP);
  const hpColor = hpPct > 0.55 ? C.hpGreen : hpPct > 0.28 ? C.hpOrange : C.hpRed;

  // Visible background trees (parallax 38%)
  const visTrees = TREES.filter(t => {
    const sx = SW / 2 + (t.wx - g.wx) * 0.38;
    return sx > -90 && sx < SW + 90;
  });

  return (
    <View style={[st.root, { backgroundColor: C.skyTop }]}>
      {/* ── Sky layer ── */}
      <View style={[st.sky, { height: groundY, backgroundColor: C.skyBot }]}>
        {STARS.map((star, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: star.x,
              top: star.y + topOff + HUD_H,
              width: star.r * 2,
              height: star.r * 2,
              borderRadius: star.r,
              backgroundColor: C.starCol,
            }}
          />
        ))}
        {/* Distant hills */}
        <View style={[st.hill, { bottom: GROUND_H, left: -20, width: SW * 0.55, height: 75 }]} />
        <View style={[st.hill, { bottom: GROUND_H, left: SW * 0.38, width: SW * 0.65, height: 55 }]} />
        {/* Trees (parallax 38% of camera speed) */}
        {visTrees.map((t, i) => {
          const sx = SW / 2 + (t.wx - g.wx) * 0.38 - t.w / 2;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: sx,
                bottom: GROUND_H - 3,
                width: t.w,
                height: t.h,
                backgroundColor: C.treeCol,
                borderTopLeftRadius: t.w / 2,
                borderTopRightRadius: t.w / 2,
              }}
            />
          );
        })}
      </View>

      {/* ── Ground ── */}
      <View style={[st.ground, { top: groundY, height: GROUND_H, backgroundColor: C.ground }]} />
      <View style={[st.groundTop, { top: groundY }]} />

      {/* ── Enemies ── */}
      {g.enemies.map(e => {
        const ecx = SW / 2 + (e.wx - g.wx);
        const ebx = ecx - ENEMY_W / 2;
        const eTopY = groundY - ENEMY_H;
        const eHdX = ecx - ENEMY_HEAD_D / 2;
        const eHdY = eTopY - ENEMY_HEAD_D + 5;
        const faceR = e.wx < g.wx;
        const eBob = Math.sin(e.step / 145) * 2;
        const armX = faceR ? ebx + ENEMY_W : ebx - 20;
        const hpPctE = Math.max(0, e.hp / e.maxHp);

        return (
          <View key={e.id} style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* HP bar */}
            {!e.dead && (
              <View style={[st.eHpBg, { left: ebx - 3, top: eHdY - 11, width: ENEMY_W + 6 }]}>
                <View
                  style={[
                    st.eHpFill,
                    {
                      width: `${hpPctE * 100}%`,
                      backgroundColor: hpPctE > 0.5 ? C.hpGreen : C.hpRed,
                    },
                  ]}
                />
              </View>
            )}
            {/* Zombie head */}
            <View
              style={{
                position: 'absolute',
                left: eHdX, top: eHdY + eBob,
                width: ENEMY_HEAD_D, height: ENEMY_HEAD_D,
                borderRadius: ENEMY_HEAD_D / 2,
                backgroundColor: C.zombieHead,
                opacity: e.dead ? e.fade : 1,
              }}
            />
            {/* Zombie body */}
            <View
              style={{
                position: 'absolute',
                left: ebx, top: eTopY + eBob,
                width: ENEMY_W, height: ENEMY_H,
                backgroundColor: C.zombieBody,
                borderRadius: 4,
                opacity: e.dead ? e.fade : 1,
              }}
            />
            {/* Zombie arm reaching toward player */}
            {!e.dead && (
              <View
                style={{
                  position: 'absolute',
                  left: armX, top: eTopY + 10 + eBob,
                  width: 20, height: 9,
                  backgroundColor: C.zombieArm,
                  borderRadius: 4,
                }}
              />
            )}
            {/* Death blood splat */}
            {e.dead && e.fade > 0.35 && (
              <View
                style={{
                  position: 'absolute',
                  left: ebx - 5, top: groundY - 9,
                  width: ENEMY_W + 10, height: 9,
                  backgroundColor: C.blood,
                  borderRadius: 5,
                  opacity: e.fade,
                }}
              />
            )}
          </View>
        );
      })}

      {/* ── Player ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Attack glow area */}
        {g.atkActive && (
          <View
            style={{
              position: 'absolute',
              left: atkGlowX,
              top: pBodyY,
              width: ATTACK_RANGE + 12,
              height: PLAYER_H,
              backgroundColor: C.atkGlow,
              borderRadius: 10,
            }}
          />
        )}
        {/* Punch arm */}
        {g.atkActive && (
          <View
            style={{
              position: 'absolute',
              left: atkArmX, top: pBodyY + 10 + pBob,
              width: 38, height: 11,
              backgroundColor: C.playerHat,
              borderRadius: 5,
            }}
          />
        )}
        {/* Hat brim */}
        <View
          style={{
            position: 'absolute',
            left: pHatX - 5, top: pHatY + HAT_H - 3 + pBob,
            width: HAT_W + 10, height: 5,
            backgroundColor: C.playerHat,
            borderRadius: 2,
            opacity: pOpacity,
          }}
        />
        {/* Hat top */}
        <View
          style={{
            position: 'absolute',
            left: pHatX, top: pHatY + pBob,
            width: HAT_W, height: HAT_H,
            backgroundColor: C.playerHat,
            borderTopLeftRadius: 5,
            borderTopRightRadius: 5,
            opacity: pOpacity,
          }}
        />
        {/* Head */}
        <View
          style={{
            position: 'absolute',
            left: pHeadX, top: pHeadY + pBob,
            width: HEAD_D, height: HEAD_D,
            borderRadius: HEAD_D / 2,
            backgroundColor: pHeadColor,
            opacity: pOpacity,
          }}
        />
        {/* Body */}
        <View
          style={{
            position: 'absolute',
            left: pBodyX, top: pBodyY + pBob,
            width: PLAYER_W, height: PLAYER_H,
            backgroundColor: pBodyColor,
            borderRadius: 5,
            opacity: pOpacity,
          }}
        />
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

      {/* ── Wave announcement banner ── */}
      {g.waveMsg > 200 && (
        <View style={[st.waveBanner, { top: topOff + HUD_H + 28 }]}>
          <Text style={st.waveBannerTxt}>WAVE {g.wave}</Text>
          <Text style={st.waveBannerSub}>FIGHT!</Text>
        </View>
      )}

      {/* ── Controls ── */}
      <View style={[st.controls, { bottom: botOff, height: CTRL_H }]}>
        {/* D-pad */}
        <View style={st.dpad}>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPressIn={() => {
              held.current.l = true;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onPressOut={() => { held.current.l = false; }}
          >
            <Ionicons name="arrow-back" size={26} color={C.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPressIn={() => {
              held.current.r = true;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onPressOut={() => { held.current.r = false; }}
          >
            <Ionicons name="arrow-forward" size={26} color={C.white} />
          </Pressable>
        </View>
        {/* Action buttons */}
        <View style={st.actions}>
          <Pressable
            style={({ pressed }) => [st.btn, pressed && st.btnActive]}
            onPress={() => {
              doJump(gsRef.current);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          >
            <Ionicons name="arrow-up" size={26} color={C.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [st.btn, st.atkBtn, pressed && st.atkBtnActive]}
            onPress={() => {
              doAttack(gsRef.current);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }}
          >
            <MaterialCommunityIcons name="boxing-glove" size={30} color={C.gold} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sky: { position: 'absolute', left: 0, right: 0, top: 0 },
  hill: {
    position: 'absolute',
    backgroundColor: '#0A1808',
    borderRadius: 60,
  },
  ground: { position: 'absolute', left: 0, right: 0 },
  groundTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: '#213A0E',
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.hudBg,
    paddingHorizontal: 14,
    gap: 10,
  },
  hudWave: { width: 72, alignItems: 'flex-start' },
  hudWaveTxt: { color: '#5A4010', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  hudWaveNum: { color: C.goldDim, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  hudScore: { flex: 1, alignItems: 'center' },
  hudScoreTxt: { color: C.gold, fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  hudHp: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 110 },
  hpBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#180808',
    borderRadius: 5,
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: 5 },
  hpNum: { color: C.white, fontSize: 11, fontWeight: '700', width: 26, textAlign: 'right' },
  eHpBg: {
    position: 'absolute',
    height: 5,
    backgroundColor: '#0A0F0A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  eHpFill: { height: '100%', borderRadius: 3 },
  waveBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  waveBannerTxt: {
    color: C.gold,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowColor: C.blood,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 2 },
  },
  waveBannerSub: {
    color: C.blood,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 8,
    marginTop: -8,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  dpad: { flexDirection: 'row', gap: 14 },
  actions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.btnBg,
    borderWidth: 1.5,
    borderColor: C.btnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: C.btnActive, borderColor: C.gold },
  atkBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.atkBtnBg,
    borderColor: C.atkBtnBorder,
  },
  atkBtnActive: { backgroundColor: 'rgba(204,34,0,0.45)', borderColor: C.gold },
});
