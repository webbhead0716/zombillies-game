import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const WEB_TOP = Platform.OS === 'web' ? 67 : 0;
const WEB_BOT = Platform.OS === 'web' ? 34 : 0;

// Pre-calc background blood drops
const DROPS = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 137) % 390),
  delay: i * 180,
  h: 18 + (i % 4) * 12,
}));

export default function GameOverScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    score: string;
    wave: string;
    hs: string;
    newHs: string;
    kills: string;
    hits: string;
    bosses: string;
    teeth: string;
    daily: string;
    endless: string;
    streak: string;
    streakBonus: string;
    ach: string;
  }>();

  const score = parseInt(params.score ?? '0');
  const wave = parseInt(params.wave ?? '1');
  const hs = parseInt(params.hs ?? '0');
  const isNewHs = params.newHs === '1';
  const kills = parseInt(params.kills ?? '0');
  const hits = parseInt(params.hits ?? '0');
  const bosses = parseInt(params.bosses ?? '0');
  const teeth = parseInt(params.teeth ?? '0');
  const isDaily = params.daily === '1';
  const isEndless = params.endless === '1';
  const streak = parseInt(params.streak ?? '0');
  const streakBonus = parseInt(params.streakBonus ?? '0');
  const newAch = (params.ach ?? '').split('|').filter(Boolean);
  const [shared, setShared] = React.useState(false);

  const onShare = async () => {
    const msg = `💀 ZOMBILLIES${isEndless ? ' ENDLESS' : ''} — I survived to wave ${wave} with ${score.toLocaleString()} points and ${kills} zombie kills! Think you can beat me? 💿🧟`;
    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share) await nav.share({ text: msg });
        else if (nav?.clipboard) { await nav.clipboard.writeText(msg); setShared(true); setTimeout(() => setShared(false), 2000); }
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  };

  const topOff = insets.top + WEB_TOP;
  const botOff = insets.bottom + WEB_BOT;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const hsBounce = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // Shake game over title
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(shakeX, { toValue: 14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();

    // Content fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
    ]).start();

    // New high score bounce
    if (isNewHs) {
      Animated.loop(
        Animated.sequence([
          Animated.spring(hsBounce, { toValue: 1.08, friction: 5, useNativeDriver: true }),
          Animated.spring(hsBounce, { toValue: 1, friction: 5, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#050810', '#160505', '#0A0101']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Blood drops at top */}
      {DROPS.map((d, i) => (
        <View
          key={i}
          style={[s.bloodDrop, { left: d.x, top: topOff + 5, height: d.h + 10 }]}
        />
      ))}

      <Animated.View
        style={[
          s.content,
          {
            paddingTop: topOff + 48,
            paddingBottom: botOff + 20,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* GAME OVER */}
        <Animated.Text style={[s.gameOverTxt, { transform: [{ translateX: shakeX }] }]}>
          GAME OVER
        </Animated.Text>

        {/* Stats card */}
        <View style={s.statsCard}>
          {isDaily && <Text style={s.dailyBadge}>📅 DAILY CHALLENGE RUN</Text>}
          {isEndless && <Text style={[s.dailyBadge, { color: '#FF8A3C' }]}>♾️ ENDLESS RUN</Text>}
          {/* Shareable run summary */}
          <Text style={s.runSummary}>
            WAVE {wave} · {kills} KILLS{bosses > 0 ? ` · ${bosses} BOSS${bosses > 1 ? 'ES' : ''}` : ''}
          </Text>
          <View style={s.divider} />
          <View style={s.statRow}>
            <Text style={s.statLabel}>WAVE REACHED</Text>
            <Text style={s.statVal}>{wave}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.statRow}>
            <Text style={s.statLabel}>ZOMBIES KILLED</Text>
            <Text style={s.statVal}>{kills}</Text>
          </View>

          <View style={s.statRow}>
            <Text style={s.statLabel}>HITS TAKEN</Text>
            <Text style={s.statVal}>{hits}</Text>
          </View>

          <View style={s.statRow}>
            <Text style={s.statLabel}>TEETH EARNED</Text>
            <Text style={s.statVal}>🦷 {teeth}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.statRow}>
            <Text style={s.statLabel}>SCORE</Text>
            <Text style={s.statValBig}>{score.toLocaleString()}</Text>
          </View>

          {isDaily && streak > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.statRow}>
                <Text style={s.statLabel}>DAILY STREAK</Text>
                <Text style={s.statVal}>🔥 {streak}{streakBonus > 0 ? `  +${streakBonus} 🦷` : ''}</Text>
              </View>
            </>
          )}

          {newAch.length > 0 && (
            <View style={s.achBox}>
              {newAch.map(n => (
                <Text key={n} style={s.achTxt}>🏅 {n} UNLOCKED!</Text>
              ))}
            </View>
          )}

          {isNewHs ? (
            <Animated.View style={[s.newHsBadge, { transform: [{ scale: hsBounce }] }]}>
              <Text style={s.newHsTxt}>NEW HIGH SCORE!</Text>
            </Animated.View>
          ) : (
            hs > 0 && (
              <>
                <View style={s.divider} />
                <View style={s.statRow}>
                  <Text style={s.statLabel}>BEST</Text>
                  <Text style={s.statVal}>{hs.toLocaleString()}</Text>
                </View>
              </>
            )
          )}
        </View>

        {/* Tip */}
        <Text style={s.tipTxt}>
          {score < 500
            ? 'Tip: Use the attack button when zombies are close!'
            : score < 2000
            ? 'Tip: Jump over groups of zombies to split them up!'
            : 'Nice run. Can you beat your score?'}
        </Text>

        {/* Buttons */}
        <View style={s.btns}>
          <Pressable
            style={({ pressed }) => [s.playAgainBtn, pressed && s.playAgainBtnPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace('/(tabs)/game');
            }}
          >
            <Ionicons name="refresh" size={22} color="#FFF" />
            <Text style={s.playAgainTxt}>PLAY AGAIN</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.menuBtn, pressed && s.menuBtnPressed]}
            onPress={onShare}
          >
            <Ionicons name="share-social" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={s.menuTxt}>{shared ? 'COPIED!' : 'SHARE SCORE'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.menuBtn, pressed && s.menuBtnPressed]}
            onPress={() => {
              router.replace('/(tabs)');
            }}
          >
            <Ionicons name="home" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={s.menuTxt}>MENU</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  bloodDrop: {
    position: 'absolute',
    width: 5,
    backgroundColor: '#CC2200',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    opacity: 0.75,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  gameOverTxt: {
    fontSize: 52,
    fontWeight: '900',
    color: '#CC2200',
    letterSpacing: 3,
    textShadowColor: '#CC2200',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
    marginBottom: 36,
  },
  statsCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: '#2A1010',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 26,
    gap: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#5A3030',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  statVal: {
    color: '#F5C842',
    fontSize: 24,
    fontWeight: '800',
  },
  statValBig: {
    color: '#F5C842',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
  },
  divider: { height: 1, backgroundColor: '#1E0A0A' },
  dailyBadge: {
    color: '#9BC0FF', fontSize: 10, fontWeight: '900', letterSpacing: 2,
    textAlign: 'center', marginBottom: 6,
  },
  runSummary: {
    color: '#C8B888', fontSize: 13, fontWeight: '900', letterSpacing: 1.5,
    textAlign: 'center', marginBottom: 4,
  },
  achBox: {
    backgroundColor: 'rgba(180,138,255,0.1)',
    borderWidth: 1, borderColor: '#4A3A6A', borderRadius: 10,
    paddingVertical: 8, alignItems: 'center', gap: 3,
  },
  achTxt: { color: '#B48AFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  newHsBadge: {
    backgroundColor: 'rgba(204,34,0,0.18)',
    borderWidth: 1,
    borderColor: '#CC2200',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newHsTxt: {
    color: '#F5C842',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tipTxt: {
    color: '#3A4030',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
    letterSpacing: 0.3,
  },
  btns: { width: '100%', gap: 14, marginTop: 32 },
  playAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#CC2200',
    paddingVertical: 18,
    borderRadius: 60,
    shadowColor: '#CC2200',
    shadowRadius: 14,
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  playAgainBtnPressed: { backgroundColor: '#9E1800', shadowOpacity: 0.2 },
  playAgainTxt: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuBtnPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  menuTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
