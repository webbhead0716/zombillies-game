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
- Lifetime stats (kills/bosses/bestWave) must bank at every wave clear and at save&quit via banked-delta counters (killsBanked/bossBanked), never death-only — players who save&quit may rarely die, leaving hat unlocks unreachable.
- Save/continue: one save slot (`zb_run`); the ONLY snapshot writer is the wave-clear intermission (pre-perk state). SAVE & QUIT just banks teeth — never snapshot mid-wave or post-perk state, or perk-stacking/reward-farming exploits open up. Death banks only unbanked teeth (teethBanked) then clears the slot, in awaited order.
- Meta-progression lives in `lib/progress.ts` (teeth currency, shop upgrades, hats, lifetime stats, daily-challenge seed/modifier — all AsyncStorage, fail-silent). Run persistence on death must stay one-shot (ref guard) and upgrade loading must never buff/heal a run already in progress; shop purchases are serialized with a buying lock.
- Death flow: all death persistence AND the router.replace to gameover live in one persistedRef-guarded async with try/catch/finally — navigation must be in finally so a storage failure never strands the player; delta bank markers make partial banking safe.
- Bounties/achievements live in `lib/meta.ts` (date-seeded 3 daily quests, permanent badges); progress banks with delta counters (runnerBanked/noHitBanked inside bankQuestAch) at the same bank points as teeth/stats (wave clear, death, save&quit). Daily login streak (`zb_dstreak`) awards once per day on daily-run death.
- Endless mode: no snapshot ever (like daily), auto random perk at wave clear then startNextWave inline, separate best key `zb_endless_hs`, unlocked at lifetime bestWave ≥ 10.
- Hats grant run bonuses (dmg/spd/hp/teeth fields on HATS) applied only in the fresh-run mount guard; continue runs inherit them via snapshot mults — don't reapply on resume.
- Round structure: rounds progress rightward (`roundStart` += ROUND_LEN per wave); midway checkpoint = full heal once per round; endpoint flag is a movement wall until all zombies dead, then crossing it triggers an intermission stats screen with a NEXT WAVE button (startNextWave must stay phase-guarded against double-taps). Boss every 3rd wave (>1). Mic mode kills zombies on contact. Menu plays bluegrass via useFocusEffect; game screen takes over the same track.
