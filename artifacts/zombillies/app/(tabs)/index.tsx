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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');
const WEB_TOP = Platform.OS === 'web' ? 67 : 0;
const WEB_BOT = Platform.OS === 'web' ? 34 : 0;
const HS_KEY = 'zb_hs';

// Pre-calculate decorations to avoid Math.random() in render
const STARS = Array.from({ length: 55 }, (_, i) => ({
  x: ((i * 131) % SW),
  y: ((i * 83) % (SH * 0.55)),
  size: i % 5 === 0 ? 1.5 : 0.8,
  opacity: 0.4 + (i % 5) * 0.12,
}));

const BG_TREES = Array.from({ length: 12 }, (_, i) => ({
  x: ((i * SW) / 12) + (i % 3 === 0 ? 10 : i % 3 === 1 ? -15 : 0),
  w: 18 + (i % 4) * 7,
  h: 95 + (i % 5) * 22,
}));

const TOMBSTONES = Array.from({ length: 9 }, (_, i) => ({
  x: ((i * SW) / 9) + (i % 3) * 8,
  w: 20 + (i % 3) * 10,
  h: 28 + (i % 4) * 12,
}));

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [hs, setHs] = useState(0);

  const titleY = useRef(new Animated.Value(-80)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bloodDrip = useRef(new Animated.Value(0)).current;

  const topOff = insets.top + WEB_TOP;
  const botOff = insets.bottom + WEB_BOT;

  useEffect(() => {
    AsyncStorage.getItem(HS_KEY).then(v => {
      if (v) setHs(parseInt(v));
    });

    // Title slide in
    Animated.parallel([
      Animated.spring(titleY, { toValue: 0, friction: 6, tension: 45, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    // Pulse play button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    ).start();

    // Blood glow pulse on title
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    // Blood drip
    Animated.loop(
      Animated.sequence([
        Animated.timing(bloodDrip, { toValue: 1, duration: 500, delay: 800, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(bloodDrip, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });
  const dripScale = bloodDrip.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#04070F', '#0B1525', '#060E06']}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      {STARS.map((star, i) => (
        <View
          key={i}
          style={[
            s.star,
            {
              left: star.x,
              top: star.y + topOff,
              width: star.size * 2,
              height: star.size * 2,
              borderRadius: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}

      {/* Moon */}
      <View style={[s.moon, { top: topOff + 28, right: 44 }]}>
        <View style={s.moonShadow} />
      </View>

      {/* Background trees */}
      {BG_TREES.map((t, i) => (
        <View
          key={i}
          style={[
            s.bgTree,
            {
              left: t.x - t.w / 2,
              bottom: botOff + 90,
              width: t.w,
              height: t.h,
              borderTopLeftRadius: t.w / 2,
              borderTopRightRadius: t.w / 2,
            },
          ]}
        />
      ))}

      {/* Ground */}
      <View style={[s.ground, { bottom: botOff + 56 }]} />
      <View style={[s.groundGrass, { bottom: botOff + 88 }]} />

      {/* Tombstones */}
      {TOMBSTONES.map((ts, i) => (
        <View
          key={i}
          style={[
            s.tombstone,
            {
              left: ts.x,
              bottom: botOff + 82,
              width: ts.w,
              height: ts.h,
              borderTopLeftRadius: ts.w / 2,
              borderTopRightRadius: ts.w / 2,
            },
          ]}
        />
      ))}

      {/* Title block */}
      <Animated.View
        style={[
          s.titleBlock,
          { paddingTop: topOff + 55, opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}
      >
        <Text style={s.titleEye}>— BRACE YOURSELF —</Text>

        {/* Glow layer behind title */}
        <View style={s.titleStack}>
          <Animated.Text style={[s.titleGlow, { opacity: glowOpacity }]}>
            ZOMBILLIES
          </Animated.Text>
          <Text style={s.titleMain}>ZOMBILLIES</Text>
        </View>

        {/* Blood drip on Z */}
        <Animated.View
          style={[s.bloodDrip, { transform: [{ scaleY: dripScale }] }]}
        />

        <Text style={s.titleTag}>ZOMBIE BRAWLER</Text>
      </Animated.View>

      {/* High score badge */}
      {hs > 0 && (
        <View style={s.hsBadge}>
          <Text style={s.hsLabel}>BEST SCORE</Text>
          <Text style={s.hsVal}>{hs.toLocaleString()}</Text>
        </View>
      )}

      {/* Play button */}
      <Animated.View style={[s.playWrap, { transform: [{ scale: pulseAnim }] }]}>
        <Pressable
          style={({ pressed }) => [s.playBtn, pressed && s.playBtnPressed]}
          onPress={() => router.push('/(tabs)/game')}
        >
          <Ionicons name="play" size={26} color="#FFF" style={{ marginLeft: 4 }} />
          <Text style={s.playTxt}>PLAY</Text>
        </Pressable>
      </Animated.View>

      <Text style={[s.tip, { bottom: botOff + 18 }]}>Survive the zombie horde to beat your score</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  star: { position: 'absolute', backgroundColor: '#FFFFCC' },
  moon: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#CEC06A',
    shadowColor: '#D4C060',
    shadowRadius: 22,
    shadowOpacity: 0.65,
    shadowOffset: { width: 0, height: 0 },
  },
  moonShadow: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#9A8E48',
    opacity: 0.45,
  },
  bgTree: { position: 'absolute', backgroundColor: '#060E04' },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#100802',
  },
  groundGrass: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#1E3C0C',
  },
  tombstone: {
    position: 'absolute',
    backgroundColor: '#1A2020',
    borderWidth: 1,
    borderColor: '#252E2E',
  },
  titleBlock: { alignItems: 'center', paddingHorizontal: 20 },
  titleEye: {
    color: '#5A3333',
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleStack: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGlow: {
    position: 'absolute',
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#CC2200',
    textShadowColor: '#CC2200',
    textShadowRadius: 28,
    textShadowOffset: { width: 0, height: 0 },
  },
  titleMain: {
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#F5C842',
    textShadowColor: '#000',
    textShadowRadius: 6,
    textShadowOffset: { width: 2, height: 4 },
  },
  bloodDrip: {
    width: 5,
    height: 22,
    backgroundColor: '#CC2200',
    borderRadius: 3,
    marginTop: -4,
    alignSelf: 'flex-start',
    marginLeft: 14,
    transformOrigin: 'top',
  },
  titleTag: {
    color: '#CC2200',
    fontSize: 12,
    letterSpacing: 7,
    fontWeight: '800',
    marginTop: 8,
  },
  hsBadge: {
    alignSelf: 'center',
    marginTop: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: '#3A2A0A',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hsLabel: {
    color: '#7A6020',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 2,
  },
  hsVal: { color: '#F5C842', fontSize: 26, fontWeight: '900' },
  playWrap: { alignSelf: 'center', marginTop: 38 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#CC2200',
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 60,
    shadowColor: '#CC2200',
    shadowRadius: 18,
    shadowOpacity: 0.65,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  playBtnPressed: { backgroundColor: '#A01600', shadowOpacity: 0.25 },
  playTxt: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tip: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#3A4A2A',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
