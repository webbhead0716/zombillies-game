// ── Sound manager ──────────────────────────────────────────────────────────────
// Music + SFX via expo-audio. All calls are fire-and-forget and fail silently
// so audio problems can never break gameplay.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SRC = {
  throw: require('../assets/audio/sfx_throw.mp3'),
  hit: require('../assets/audio/sfx_hit.mp3'),
  powerup: require('../assets/audio/sfx_powerup.mp3'),
  hurt: require('../assets/audio/sfx_hurt.mp3'),
  gameover: require('../assets/audio/sfx_gameover.mp3'),
} as const;

export type SfxName = keyof typeof SRC;

const MUSIC_SRC = require('../assets/audio/music_bluegrass.mp3');

let audioModeSet = false;
async function ensureAudioMode() {
  if (audioModeSet) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    audioModeSet = true; // only mark done on success so failures retry
  } catch {
    // non-fatal
  }
}

// SFX players — a small pool per sound so rapid re-triggers don't cut off.
const POOL_SIZE: Record<SfxName, number> = {
  throw: 3,
  hit: 3,
  powerup: 1,
  hurt: 1,
  gameover: 1,
};
const pools = new Map<SfxName, { players: AudioPlayer[]; idx: number }>();
const lastPlayed = new Map<SfxName, number>();
// Minimum ms between replays of the same sound (chili rapid-fire protection)
const THROTTLE: Record<SfxName, number> = {
  throw: 90,
  hit: 120,
  powerup: 250,
  hurt: 250,
  gameover: 1000,
};

function getPool(name: SfxName) {
  let pool = pools.get(name);
  if (!pool) {
    pool = {
      players: Array.from({ length: POOL_SIZE[name] }, () => {
        const p = createAudioPlayer(SRC[name]);
        p.volume = name === 'throw' ? 0.55 : 0.85;
        return p;
      }),
      idx: 0,
    };
    pools.set(name, pool);
  }
  return pool;
}

export function playSfx(name: SfxName) {
  try {
    ensureAudioMode();
    const now = Date.now();
    const last = lastPlayed.get(name) ?? 0;
    if (now - last < THROTTLE[name]) return;
    lastPlayed.set(name, now);

    const pool = getPool(name);
    const p = pool.players[pool.idx];
    pool.idx = (pool.idx + 1) % pool.players.length;
    p.seekTo(0);
    p.play();

    // On web, autoplay policy may have blocked music at mount time. SFX only
    // fire from user gestures, so this is a safe place to unlock the music.
    if (musicWanted && music && !music.playing) music.play();
  } catch {
    // never let audio break the game
  }
}

// ── Music ──────────────────────────────────────────────────────────────────────
let music: AudioPlayer | null = null;
let musicWanted = false;

export function startMusic() {
  try {
    ensureAudioMode();
    musicWanted = true;
    if (!music) {
      music = createAudioPlayer(MUSIC_SRC);
      music.loop = true;
      music.volume = 0.45;
    }
    music.play();
  } catch {
    // non-fatal
  }
}

export function stopMusic() {
  try {
    musicWanted = false;
    music?.pause();
    music?.seekTo(0);
  } catch {
    // non-fatal
  }
}

/** Release all audio players. Call when leaving the game screen. */
export function disposeAudio() {
  try {
    musicWanted = false;
    music?.pause();
    music?.remove();
    music = null;
    for (const pool of pools.values()) {
      for (const p of pool.players) {
        try { p.pause(); p.remove(); } catch {}
      }
    }
    pools.clear();
    lastPlayed.clear();
  } catch {
    // non-fatal
  }
}

export function duckMusic(volume = 0.18) {
  try {
    if (music) music.volume = volume;
  } catch {}
}

export function restoreMusic() {
  try {
    if (music) music.volume = 0.45;
  } catch {}
}
