---
name: Zombillies conventions
description: Durable quirks/decisions for the Zombillies Expo game artifact
---
- Pre-existing typecheck error NOT to fix or count against new work: `hooks/useColors.ts` cast. Filter it when running tsc. (`gameover.tsx` route typing was fixed — expo-router typed routes need `'/(tabs)'`, not `'/(tabs)/'`.)
  **Why:** Predates agent work; user hasn't asked to fix it.
- All sprites/backgrounds are drawn with View shapes (no image assets) in a single `game.tsx`; keep that approach when adding visuals.
- Audio: `lib/sound.ts` uses expo-audio with pooled SFX + looping music; web autoplay is unlocked by retrying `music.play()` inside `playSfx` (SFX fire from user gestures). Music assets are AI-generated MP3s in `assets/audio/`.
- Power-up rules the user approved: ketchup/chili persist until Bill takes damage; mic power-up is TIMED (invincible + fast) and swaps music to rockabilly, back to bluegrass on expiry.
- Physics: side collision for obstacles must be swept (resolve to the side from previous wx) or fast movement tunnels through.
- Enemy stats are per-enemy fields (spd/dmg/scale/charger) set in spawnEnemy from ETYPE_STATS + wave scaling — don't reintroduce global ENEMY_SPD/ENEMY_DMG semantics in tick logic. Bosses alternate brute/charger; charger lunges via `e.step % cycle` (step only advances while moving, by design).
- Sound mute lives in `lib/sound.ts` (`setMuted`/`getMuted`); unmute must use `getMusic(currentTrack).play()` (lazy player may not exist yet if muted at start). Pause is a GS phase; tick loop keeps running setFrame so overlays stay interactive.
- Meta-progression lives in `lib/progress.ts` (teeth currency, shop upgrades, hats, lifetime stats, daily-challenge seed/modifier — all AsyncStorage, fail-silent). Run persistence on death must stay one-shot (ref guard) and upgrade loading must never buff/heal a run already in progress; shop purchases are serialized with a buying lock.
- Round structure: rounds progress rightward (`roundStart` += ROUND_LEN per wave); midway checkpoint = full heal once per round; endpoint flag is a movement wall until all zombies dead, then crossing it triggers an intermission stats screen with a NEXT WAVE button (startNextWave must stay phase-guarded against double-taps). Boss every 3rd wave (>1). Mic mode kills zombies on contact. Menu plays bluegrass via useFocusEffect; game screen takes over the same track.
