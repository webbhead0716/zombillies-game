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
import { startMusic } from '../../lib/sound';
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
    }, [])
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
          <Animated.Text style={[s.titleGlow, { opacity: glowOpacity }]}>ZOMBILLIES</Animated.Text>
          <Text style={s.titleMain}>ZOMBILLIES</Text>
        </View>
        <Text style={s.tagLine1}>THE UNDEAD. THE UNREFINED.</Text>
        <Text style={s.tagLine2}>THE DVD-ARMED.</Text>
      </Animated.View>

      {/* ── High score ── */}
      {hs > 0 && (
        <View style={s.hsBadge}>
          <Text style={s.hsLabel}>BEST SCORE</Text>
          <Text style={s.hsVal}>{hs.toLocaleString()}</Text>
        </View>
      )}

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

      <Text style={[s.tip, { bottom: botOff + 16 }]}>
        Throw DVDs. Silence the horde. Survive.
      </Text>
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
  titleBlock: { alignItems: 'flex-start', paddingHorizontal: 22, maxWidth: SW * 0.65 },
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
    alignSelf: 'flex-start', marginTop: 18, marginLeft: 22,
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
});
