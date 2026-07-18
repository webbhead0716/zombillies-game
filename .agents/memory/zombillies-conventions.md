---
name: Zombillies conventions
description: Durable quirks/decisions for the Zombillies Expo game artifact
---
- Pre-existing typecheck errors NOT to fix or count against new work: `gameover.tsx` router path typing and `hooks/useColors.ts` cast. Filter them when running tsc.
  **Why:** They predate agent work; user hasn't asked to fix them.
- All sprites/backgrounds are drawn with View shapes (no image assets) in a single `game.tsx`; keep that approach when adding visuals.
- Audio: `lib/sound.ts` uses expo-audio with pooled SFX + looping music; web autoplay is unlocked by retrying `music.play()` inside `playSfx` (SFX fire from user gestures). Music assets are AI-generated MP3s in `assets/audio/`.
- Power-up rules the user approved: ketchup/chili persist until Bill takes damage; mic power-up is TIMED (invincible + fast) and swaps music to rockabilly, back to bluegrass on expiry.
- Physics: side collision for obstacles must be swept (resolve to the side from previous wx) or fast movement tunnels through.
