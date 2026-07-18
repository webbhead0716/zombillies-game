import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { startMusic, playSfx } from '../../lib/sound';
import {
  loadTeeth, spendTeeth, loadUpgrades, saveUpgrades, loadStats, loadHat, saveHat,
  loadDailyBest, todayMod, hatUnlocked, upgCost,
  UPG_DEFS, HATS, type Upgrades, type LifetimeStats,
} from '../../lib/progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');
const WEB_TOP = Platform.OS === 'web' ? 67 : 0;
const WEB_BOT = Platform.OS === 'web' ? 34 : 0;
const HS_KEY = 'zb_hs';

// Stars
const STARS = Array.from({ length: 55 }, (_, i) => ({
  x: ((i * 131) % SW),
  y: ((i * 83) % (SH * 0.55)),
  size: i % 5 === 0 ? 1.5 : 0.8,
  opacity: 0.4 + (i % 5) * 0.12,
}));

// Background trees
const BG_TREES = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * SW) / 14) + (i % 3 === 0 ? 10 : i % 3 === 1 ? -15 : 0),
  w: 16 + (i % 4) * 7,
  h: 90 + (i % 5) * 22,
}));

const TOMBSTONES = Array.from({ length: 10 }, (_, i) => ({
  x: ((i * SW) / 10) + (i % 3) * 8,
  w: 18 + (i % 3) * 10,
  h: 25 + (i % 4) * 12,
}));

// ── Bill (hero) render dimensions — matches the in-game sprite at 1.6× ───────
const B_BODY_W = 48;
const B_BODY_H = 83;
const B_HEAD_D = 34;
const B_HAT_W = 48;
const B_HAT_H = 19;

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [hs, setHs] = useState(0);
  const [teeth, setTeeth] = useState(0);
  const [upg, setUpg] = useState<Upgrades>({ hp: 0, dmg: 0, mic: 0 });
  const [stats, setStats] = useState<LifetimeStats>({ kills: 0, bosses: 0, bestWave: 0 });
  const [hatId, setHatId] = useState('classic');
  const [dailyBest, setDailyBest] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [buying, setBuying] = useState(false); // serializes purchases

  const reloadProgress = React.useCallback(() => {
    loadTeeth().then(setTeeth);
    loadUpgrades().then(setUpg);
    loadStats().then(setStats);
    loadHat().then(setHatId);
    loadDailyBest().then(setDailyBest);
  }, []);

  const titleY = useRef(new Animated.Value(-80)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const billBob = useRef(new Animated.Value(0)).current;
  const dvdSpin = useRef(new Animated.Value(0)).current;

  const topOff = insets.top + WEB_TOP;
  const botOff = insets.bottom + WEB_BOT;

  // Menu music (bluegrass) whenever this screen is focused; the game screen
  // takes over the same track seamlessly when Play is pressed.
  useFocusEffect(
    React.useCallback(() => {
      startMusic('bluegrass');
      AsyncStorage.getItem(HS_KEY).then(v => { if (v) setHs(parseInt(v)); });
      reloadProgress();
    }, [reloadProgress])
  );

  useEffect(() => {
    AsyncStorage.getItem(HS_KEY).then(v => { if (v) setHs(parseInt(v)); });

    Animated.parallel([
      Animated.spring(titleY, { toValue: 0, friction: 6, tension: 45, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    // Bill bob animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(billBob, { toValue: -5, duration: 700, useNativeDriver: true }),
        Animated.timing(billBob, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // DVD spin
    Animated.loop(
      Animated.timing(dvdSpin, { toValue: 1, duration: 1200, useNativeDriver: true })
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] });
  const dvdRotate = dvdSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Compute Bill's center X
  const billCX = SW * 0.78;
  const groundYApprox = SH - botOff - 110; // approx ground in menu

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#04070F', '#0B1020', '#06080A']}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      {STARS.map((star, i) => (
        <View key={i} style={[s.star, {
          left: star.x, top: star.y + topOff,
          width: star.size * 2, height: star.size * 2,
          borderRadius: star.size, opacity: star.opacity,
        }]} />
      ))}

      {/* Moon */}
      <View style={[s.moon, { top: topOff + 28, right: 44 }]}>
        <View style={s.moonShadow} />
      </View>

      {/* Background trees */}
      {BG_TREES.map((t, i) => (
        <View key={i} style={[s.bgTree, {
          left: t.x - t.w / 2, bottom: botOff + 90,
          width: t.w, height: t.h,
          borderTopLeftRadius: t.w / 2, borderTopRightRadius: t.w / 2,
        }]} />
      ))}

      {/* Ground */}
      <View style={[s.ground, { bottom: botOff + 56 }]} />
      <View style={[s.groundGrass, { bottom: botOff + 90 }]} />

      {/* Tombstones */}
      {TOMBSTONES.map((ts, i) => (
        <View key={i} style={[s.tombstone, {
          left: ts.x, bottom: botOff + 84,
          width: ts.w, height: ts.h,
          borderTopLeftRadius: ts.w / 2, borderTopRightRadius: ts.w / 2,
        }]} />
      ))}

      {/* ── Bill the hero — same look as the in-game sprite (facing left) ── */}
      <Animated.View style={[s.billWrap, { transform: [{ translateY: billBob }] }]}>
        {(() => {
          const base = botOff + 90;                       // grass line
          const headB = base + B_BODY_H - 10;             // head bottom
          const capB = headB + B_HEAD_D - 6;              // cap crown bottom
          return (
            <>
              {/* Boots */}
              <View style={[s.billBoots, { left: billCX - B_BODY_W / 2 - 3, bottom: base - 3 }]} />
              {/* Blue jeans (lower body) */}
              <View style={[s.billJeans, { left: billCX - B_BODY_W / 2, bottom: base }]} />
              {/* Jeans center seam */}
              <View style={[s.billSeam, { left: billCX - 2, bottom: base }]} />
              {/* Shirt body (upper torso) */}
              <View style={[s.billBody, { left: billCX - B_BODY_W / 2, bottom: base + B_BODY_H * 0.48 }]} />
              {/* Plaid stripe H */}
              <View style={[s.plaidH, { left: billCX - B_BODY_W / 2, bottom: base + B_BODY_H * 0.66 }]} />
              {/* Plaid stripe V */}
              <View style={[s.plaidV, { left: billCX - B_BODY_W / 2 + B_BODY_W * 0.25, bottom: base + B_BODY_H * 0.48 }]} />
              <View style={[s.plaidV, { left: billCX - B_BODY_W / 2 + B_BODY_W * 0.72, bottom: base + B_BODY_H * 0.48 }]} />
              {/* Arm holding DVD */}
              <View style={[s.billArm, { left: billCX - B_BODY_W / 2 - 30, bottom: base + B_BODY_H * 0.62 }]} />
              {/* Head — sallow zombie green */}
              <View style={[s.billHead, { left: billCX - B_HEAD_D / 2, bottom: headB }]} />
              {/* Big triangular beard over the chest */}
              <View style={[s.billBeard, { left: billCX - (B_HEAD_D / 2 + 6), bottom: headB + 11 - 46 }]} />
              {/* Glasses — chunky dark frames + bridge */}
              <View style={[s.billGlass, { left: billCX - B_HEAD_D / 2 + 1, bottom: headB + B_HEAD_D - 22 }]} />
              <View style={[s.billGlass, { left: billCX + 4, bottom: headB + B_HEAD_D - 22 }]} />
              <View style={[s.billGlassBridge, { left: billCX - 4, bottom: headB + B_HEAD_D - 19 }]} />
              {/* Trucker cap crown */}
              <View style={[s.billCap, { left: billCX - B_HAT_W / 2, bottom: capB }]} />
              {/* White dot roundel — offset toward the brim side (facing left) */}
              <View style={[s.billCapDot, { left: billCX - 16, bottom: capB + 6 }]} />
              {/* Slim visor brim — directional, facing left */}
              <View style={[s.billVisor, { left: billCX - B_HAT_W / 2 - 22, bottom: capB - 2 }]} />
              {/* DVD */}
              <Animated.View style={[s.dvd, {
                left: billCX - B_BODY_W / 2 - 56,
                bottom: base + B_BODY_H * 0.66,
                transform: [{ rotate: dvdRotate }],
              }]}>
                <View style={s.dvdHole} />
                <View style={s.dvdShine} />
              </Animated.View>
            </>
          );
        })()}
      </Animated.View>

      {/* ── Title block ── */}
      <Animated.View style={[s.titleBlock, { paddingTop: topOff + 50, opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        <View style={s.titleStack}>
          <Animated.Text
            style={[s.titleGlow, { opacity: glowOpacity }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            ZOMBILLIES
          </Animated.Text>
          <Text style={s.titleMain} numberOfLines={1} adjustsFontSizeToFit>
            ZOMBILLIES
          </Text>
        </View>
        <Text style={s.tagLine1}>THE UNDEAD. THE UNREFINED.</Text>
        <Text style={s.tagLine2}>THE DVD-ARMED.</Text>
      </Animated.View>

      {/* ── High score + teeth ── */}
      <View style={{ flexDirection: 'row', gap: 10, marginLeft: 22, marginTop: 18 }}>
        {hs > 0 && (
          <View style={s.hsBadge}>
            <Text style={s.hsLabel}>BEST SCORE</Text>
            <Text style={s.hsVal}>{hs.toLocaleString()}</Text>
          </View>
        )}
        <View style={s.hsBadge}>
          <Text style={s.hsLabel}>TEETH</Text>
          <Text style={s.hsVal}>🦷 {teeth}</Text>
        </View>
        {stats.bestWave > 0 && (
          <View style={s.hsBadge}>
            <Text style={s.hsLabel}>BEST WAVE</Text>
            <Text style={s.hsVal}>{stats.bestWave}</Text>
          </View>
        )}
      </View>

      {/* ── Play button ── */}
      <Animated.View style={[s.playWrap, { transform: [{ scale: pulseAnim }] }]}>
        <Pressable
          style={({ pressed }) => [s.playBtn, pressed && s.playBtnPressed]}
          onPress={() => router.push('/(tabs)/game')}
        >
          <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 4 }} />
          <Text style={s.playTxt}>PLAY</Text>
        </Pressable>
      </Animated.View>

      {/* ── Daily challenge + shop ── */}
      <View style={{ flexDirection: 'row', gap: 10, marginLeft: 22, marginTop: 14 }}>
        <Pressable
          style={({ pressed }) => [s.secBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({ pathname: '/(tabs)/game', params: { mode: 'daily' } })}
        >
          <Ionicons name="calendar" size={16} color="#9BC0FF" />
          <View>
            <Text style={s.secBtnTxt}>DAILY · {todayMod().name}</Text>
            {dailyBest > 0 && <Text style={s.secBtnSub}>today's best: {dailyBest.toLocaleString()}</Text>}
          </View>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.secBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShopOpen(true)}
        >
          <Ionicons name="cart" size={16} color="#F5C842" />
          <Text style={s.secBtnTxt}>SHOP</Text>
        </Pressable>
      </View>

      <Text style={[s.tip, { bottom: botOff + 16 }]}>
        Throw DVDs. Silence the horde. Survive.
      </Text>

      {/* ── Shop modal ── */}
      {shopOpen && (
        <View style={[StyleSheet.absoluteFill, s.shopWrap]}>
          <View style={[s.shopCard, { marginTop: topOff + 30, marginBottom: botOff + 20 }]}>
            <View style={s.shopHead}>
              <Text style={s.shopTitle}>GENERAL STORE</Text>
              <Text style={s.shopTeeth}>🦷 {teeth}</Text>
              <Pressable onPress={() => setShopOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            <Text style={s.shopSection}>PERMANENT UPGRADES</Text>
            {UPG_DEFS.map(d => {
              const lvl = upg[d.key];
              const maxed = lvl >= d.max;
              const cost = upgCost(lvl);
              const afford = teeth >= cost;
              return (
                <View key={d.key} style={s.upgRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.upgName}>{d.name} <Text style={s.upgLvl}>{'●'.repeat(lvl)}{'○'.repeat(d.max - lvl)}</Text></Text>
                    <Text style={s.upgDesc}>{d.desc}</Text>
                  </View>
                  <Pressable
                    disabled={maxed || !afford || buying}
                    style={[s.buyBtn, (maxed || !afford || buying) && { opacity: 0.35 }]}
                    onPress={async () => {
                      if (buying) return;
                      setBuying(true);
                      try {
                        const left = await spendTeeth(cost);
                        if (left === null) return;
                        const next = { ...upg, [d.key]: lvl + 1 };
                        await saveUpgrades(next);
                        setUpg(next); setTeeth(left);
                        playSfx('powerup');
                      } finally {
                        setBuying(false);
                      }
                    }}
                  >
                    <Text style={s.buyTxt}>{maxed ? 'MAX' : `🦷 ${cost}`}</Text>
                  </Pressable>
                </View>
              );
            })}

            <Text style={s.shopSection}>TRUCKER CAPS</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {HATS.map(h => {
                const unlocked = hatUnlocked(h, stats);
                const active = hatId === h.id;
                return (
                  <Pressable
                    key={h.id}
                    disabled={!unlocked}
                    style={[s.hatCell, active && s.hatCellOn, !unlocked && { opacity: 0.4 }]}
                    onPress={async () => { await saveHat(h.id); setHatId(h.id); playSfx('powerup'); }}
                  >
                    <View style={[s.hatSwatch, { backgroundColor: h.cap }]}>
                      <View style={[s.hatSwatchBrim, { backgroundColor: h.visor }]} />
                    </View>
                    <Text style={s.hatName}>{h.name}</Text>
                    <Text style={s.hatReq}>{unlocked ? (active ? 'WEARING' : 'TAP TO WEAR') : `🔒 ${h.reqTxt}`}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.shopFoot}>
              Lifetime: {stats.kills.toLocaleString()} kills · {stats.bosses} bosses · earn teeth by killing zombies
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  star: { position: 'absolute', backgroundColor: '#FFFFCC' },
  moon: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#C8A050',
    shadowColor: '#D4C060', shadowRadius: 20, shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  moonShadow: {
    position: 'absolute', top: 8, left: 8, width: 20, height: 20,
    borderRadius: 10, backgroundColor: '#9A8048', opacity: 0.45,
  },
  bgTree: { position: 'absolute', backgroundColor: '#060A04' },
  ground: { position: 'absolute', left: 0, right: 0, height: 68, backgroundColor: '#0E0600' },
  groundGrass: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: '#1E3A0C' },
  tombstone: { position: 'absolute', backgroundColor: '#181E18', borderWidth: 1, borderColor: '#222A22' },

  // Bill — colors match the in-game sprite palette
  billWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  billCap: {
    position: 'absolute', width: B_HAT_W, height: B_HAT_H, backgroundColor: '#3A2313',
    borderTopLeftRadius: B_HAT_W / 2, borderTopRightRadius: B_HAT_W / 2,
    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
  },
  billCapDot: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#F2EFE6' },
  billVisor: { position: 'absolute', width: 34, height: 5, backgroundColor: '#241206', borderRadius: 3 },
  billHead: { position: 'absolute', width: B_HEAD_D, height: B_HEAD_D, borderRadius: B_HEAD_D / 2, backgroundColor: '#93A860' },
  billGlass: {
    position: 'absolute', width: 13, height: 10, borderRadius: 4,
    borderWidth: 3, borderColor: '#1A1A1A', backgroundColor: 'rgba(40,50,20,0.6)',
  },
  billGlassBridge: { position: 'absolute', width: 8, height: 4, backgroundColor: '#1A1A1A' },
  billBeard: {
    position: 'absolute', width: 0, height: 0,
    borderLeftWidth: B_HEAD_D / 2 + 6, borderRightWidth: B_HEAD_D / 2 + 6,
    borderTopWidth: 46,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderStyle: 'solid', borderTopColor: '#33200E',
  },
  billBody: {
    position: 'absolute', width: B_BODY_W, height: B_BODY_H * 0.52, backgroundColor: '#8B2020',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  billJeans: { position: 'absolute', width: B_BODY_W, height: B_BODY_H * 0.48, backgroundColor: '#1B65F5' },
  billSeam: { position: 'absolute', width: 4, height: B_BODY_H * 0.38, backgroundColor: '#0F47C8', opacity: 0.8 },
  billBoots: { position: 'absolute', width: B_BODY_W + 6, height: 9, borderRadius: 4.5, backgroundColor: '#2C1708' },
  plaidH: { position: 'absolute', width: B_BODY_W, height: 6, backgroundColor: '#5A0A0A', opacity: 0.55 },
  plaidV: { position: 'absolute', width: 4, height: B_BODY_H * 0.52, backgroundColor: '#5A0A0A', opacity: 0.45 },
  billArm: { position: 'absolute', width: 30, height: 13, backgroundColor: '#8B2020', borderRadius: 6 },
  dvd: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#C8C8C8', borderWidth: 3, borderColor: '#EBEBEB',
    alignItems: 'center', justifyContent: 'center',
  },
  dvdHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#606060' },
  dvdShine: { position: 'absolute', left: 4, top: 3, width: 6, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.65 },

  // Title
  titleBlock: { alignItems: 'flex-start', paddingHorizontal: 22, maxWidth: SW - 8 },
  titleStack: { position: 'relative', alignItems: 'flex-start', justifyContent: 'center' },
  titleGlow: {
    position: 'absolute', fontSize: 52, fontWeight: '900', letterSpacing: 2,
    color: '#66AA22', textShadowColor: '#66AA22', textShadowRadius: 22,
    textShadowOffset: { width: 0, height: 0 },
  },
  titleMain: {
    fontSize: 52, fontWeight: '900', letterSpacing: 2, color: '#88DD22',
    textShadowColor: '#000', textShadowRadius: 6, textShadowOffset: { width: 2, height: 4 },
  },
  tagLine1: { color: '#8A7040', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 5 },
  tagLine2: { color: '#CC2200', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginTop: 1 },

  // HS
  hsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: '#3A2A0A', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 9, alignItems: 'flex-start',
  },
  hsLabel: { color: '#7A6020', fontSize: 9, fontWeight: '700', letterSpacing: 3, marginBottom: 2 },
  hsVal: { color: '#F5C842', fontSize: 22, fontWeight: '900' },

  // Play button
  playWrap: { alignSelf: 'flex-start', marginTop: 30, marginLeft: 22 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#CC2200', paddingHorizontal: 40, paddingVertical: 16,
    borderRadius: 60,
    shadowColor: '#CC2200', shadowRadius: 16, shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  playBtnPressed: { backgroundColor: '#A01600', shadowOpacity: 0.2 },
  playTxt: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 4 },

  tip: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    color: '#3A4A2A', fontSize: 11, letterSpacing: 0.5,
  },

  // Secondary buttons (daily / shop)
  secBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 40, paddingHorizontal: 16, paddingVertical: 10,
  },
  secBtnTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  secBtnSub: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600' },

  // Shop
  shopWrap: { backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', zIndex: 50 },
  shopCard: {
    width: SW - 32, flex: 1,
    backgroundColor: '#0D0A14', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)',
    padding: 18,
  },
  shopHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  shopTitle: { color: '#F5C842', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  shopTeeth: { color: '#C8B888', fontSize: 15, fontWeight: '900' },
  shopSection: { color: '#7A6A40', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  upgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 10, marginBottom: 8,
  },
  upgName: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  upgLvl: { color: '#F5C842', fontSize: 11 },
  upgDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 },
  buyBtn: {
    backgroundColor: 'rgba(245,200,66,0.15)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.5)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  buyTxt: { color: '#F5C842', fontSize: 11, fontWeight: '900' },
  hatCell: {
    width: (SW - 32 - 36 - 10) / 2, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent', padding: 10,
  },
  hatCellOn: { borderColor: '#F5C842' },
  hatSwatch: {
    width: 40, height: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    marginBottom: 6, alignItems: 'flex-start', justifyContent: 'flex-end',
  },
  hatSwatchBrim: { width: 22, height: 4, borderRadius: 2, marginLeft: -8, marginBottom: -3 },
  hatName: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  hatReq: { color: 'rgba(255,255,255,0.4)', fontSize: 8.5, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  shopFoot: { color: 'rgba(255,255,255,0.35)', fontSize: 9.5, marginTop: 14, textAlign: 'center' },
});
