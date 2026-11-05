// Sound is synthesised with the Web Audio API - no audio files to ship, load or
// cache, which keeps the Android bundle small and means nothing can 404.

let ctx = null;
let muted = readBool("sq.muted", false);

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Mobile browsers start the context suspended until a user gesture.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq, start = 0, dur = 0.15, type = "sine", gain = 0.18, slideTo }) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

  // Short attack, exponential release - avoids the click you get from a hard stop.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sound = {
  tap: () => tone({ freq: 420, dur: 0.05, type: "triangle", gain: 0.07 }),

  correct: () => {
    tone({ freq: 523.25, dur: 0.12, type: "triangle", gain: 0.16 });
    tone({ freq: 659.25, start: 0.09, dur: 0.12, type: "triangle", gain: 0.16 });
    tone({ freq: 783.99, start: 0.18, dur: 0.22, type: "triangle", gain: 0.18 });
  },

  wrong: () => {
    tone({ freq: 220, dur: 0.18, type: "sawtooth", gain: 0.1, slideTo: 130 });
  },

  coin: () => {
    tone({ freq: 987.77, dur: 0.07, type: "square", gain: 0.09 });
    tone({ freq: 1318.51, start: 0.06, dur: 0.16, type: "square", gain: 0.09 });
  },

  bonus: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, start: i * 0.07, dur: 0.28, type: "triangle", gain: 0.15 })
    );
  },

  levelUp: () => {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, start: i * 0.06, dur: 0.3, type: "sine", gain: 0.16 })
    );
  },

  reward: () => {
    tone({ freq: 659.25, dur: 0.1, type: "triangle", gain: 0.14 });
    tone({ freq: 880, start: 0.1, dur: 0.24, type: "triangle", gain: 0.16 });
  },
};

export function buzz(pattern = 12) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration unsupported - not worth surfacing */
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  writeBool("sq.muted", muted);
  if (!muted) sound.tap();
  return muted;
}

// ---- tiny localStorage helpers (guarded: private mode can throw on access) ----

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked - settings just won't persist */
  }
}

function readBool(key, fallback) {
  const v = readJSON(key, null);
  return typeof v === "boolean" ? v : fallback;
}

function writeBool(key, value) {
  writeJSON(key, Boolean(value));
}
