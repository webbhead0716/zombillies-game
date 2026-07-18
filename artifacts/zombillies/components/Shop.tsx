// ── Shared General Store — used by the menu, pause overlay, and intermission ──
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playSfx } from '../lib/sound';
import {
  HATS, UPG_DEFS, hatUnlocked, upgCost,
  loadHat, loadStats, loadTeeth, loadUpgrades,
  saveHat, saveUpgrades, spendTeeth,
  type LifetimeStats, type Upgrades,
} from '../lib/progress';

const SW = Dimensions.get('window').width;

interface Props {
  onClose: () => void;
  /** Fired after a successful upgrade purchase so a live run can apply it. */
  onPurchased?: (key: keyof Upgrades, upgrades: Upgrades) => void;
  /** Fired when the player switches hats. */
  onHatChange?: (hatId: string) => void;
}

export default function Shop({ onClose, onPurchased, onHatChange }: Props) {
  const [teeth, setTeeth] = useState(0);
  const [upg, setUpg] = useState<Upgrades>({ hp: 0, dmg: 0, mic: 0 });
  const [stats, setStats] = useState<LifetimeStats>({ kills: 0, bosses: 0, bestWave: 0 });
  const [hatId, setHatId] = useState('classic');
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    loadTeeth().then(setTeeth);
    loadUpgrades().then(setUpg);
    loadStats().then(setStats);
    loadHat().then(setHatId);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, s.wrap]}>
      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.title}>GENERAL STORE</Text>
          <Text style={s.teeth}>🦷 {teeth}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.section}>PERMANENT UPGRADES</Text>
          {UPG_DEFS.map(d => {
            const lvl = upg[d.key];
            const maxed = lvl >= d.max;
            const cost = upgCost(lvl);
            const afford = teeth >= cost;
            return (
              <View key={d.key} style={s.upgRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.upgName}>
                    {d.name} <Text style={s.upgLvl}>{'●'.repeat(lvl)}{'○'.repeat(d.max - lvl)}</Text>
                  </Text>
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
                      setUpg(next);
                      setTeeth(left);
                      playSfx('powerup');
                      onPurchased?.(d.key, next);
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

          <Text style={s.section}>TRUCKER CAPS</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {HATS.map(h => {
              const unlocked = hatUnlocked(h, stats);
              const active = hatId === h.id;
              return (
                <Pressable
                  key={h.id}
                  disabled={!unlocked}
                  style={[s.hatCell, active && s.hatCellOn, !unlocked && { opacity: 0.4 }]}
                  onPress={async () => {
                    await saveHat(h.id);
                    setHatId(h.id);
                    playSfx('powerup');
                    onHatChange?.(h.id);
                  }}
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

          <Text style={s.foot}>
            Lifetime: {stats.kills.toLocaleString()} kills · {stats.bosses} bosses · earn teeth by killing zombies
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  card: {
    width: SW - 32, maxHeight: '82%',
    backgroundColor: '#0D0A14', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)',
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: '#F5C842', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  teeth: { color: '#C8B888', fontSize: 15, fontWeight: '900' },
  section: { color: '#7A6A40', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16, marginBottom: 8 },
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
  foot: { color: 'rgba(255,255,255,0.35)', fontSize: 9.5, marginTop: 14, textAlign: 'center' },
});
