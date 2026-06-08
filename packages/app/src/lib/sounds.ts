/**
 * Web-Audio-API synthesized sound effects for the GAFFER portal entry.
 *
 * Why synthesized? No asset dependency, works offline, never 404s, ~0 KB
 * payload. If `/public/sounds/kick.mp3` and `/crowd.mp3` are present they
 * are used preferentially for higher fidelity — drop your own samples to
 * upgrade without code changes.
 */

let _ctx: AudioContext | null = null;
let _muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  try {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return _ctx;
  } catch {
    return null;
  }
}

// Resume context on first user gesture (autoplay policy)
export async function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {}
  }
}

export function setMuted(m: boolean) {
  _muted = m;
  if (typeof window !== "undefined") {
    localStorage.setItem("gaffer_muted", m ? "1" : "0");
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem("gaffer_muted") === "1") _muted = true;
  return _muted;
}

// ─── Realistic-ish KICK ─────────────────────────────────────────────────────
// Two-layer: low-frequency thump + high-frequency click for "leather snap"
export function playKick() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Try real sample first; fall back to synthesis
  if (tryPlaySample("/sounds/kick.mp3", 1.0)) return;

  const now = ctx.currentTime;

  // Layer A — body of kick (low thump)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  gain.gain.setValueAtTime(0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  // Layer B — click/snap (high-frequency burst through bandpass)
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2200;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.4, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  src.connect(filter).connect(clickGain).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.05);
}

// ─── Realistic-ish CROWD CHEER ─────────────────────────────────────────────
// Filtered pink-ish noise with slow amplitude modulation = stadium roar
export function playCrowd(duration = 4) {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  if (tryPlaySample("/sounds/crowd.mp3", 0.65, duration)) return;

  const now = ctx.currentTime;

  // Pink noise buffer
  const sampleRate = ctx.sampleRate;
  const bufferLength = sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
  const data = buffer.getChannelData(0);

  // Voss-McCartney-ish pink noise
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferLength; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.05;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // Bandpass filter to push it into "crowd voice" frequency band
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.7;

  // Slow LFO modulating amplitude → cheering ebb & flow
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.4;
  lfoGain.gain.value = 0.15;
  lfo.connect(lfoGain);

  const masterGain = ctx.createGain();
  // Envelope: fade in, sustain with LFO, fade out
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.55, now + 0.4);
  masterGain.gain.setValueAtTime(0.55, now + duration - 1.2);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  lfoGain.connect(masterGain.gain);

  src.connect(bp).connect(masterGain).connect(ctx.destination);
  lfo.start(now);
  src.start(now);
  src.stop(now + duration);
  lfo.stop(now + duration);
}

// Try to play a real audio file. Returns true if the request was issued
// (caller should skip synthesis), false if the file is known-missing.
const _sampleAvail: Record<string, boolean | "unknown"> = {};
function tryPlaySample(path: string, volume = 1, _duration?: number): boolean {
  if (typeof window === "undefined") return false;
  if (_sampleAvail[path] === false) return false;

  // Optimistically attempt; mark unavailable on error
  try {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play()
      .then(() => {
        _sampleAvail[path] = true;
      })
      .catch(() => {
        _sampleAvail[path] = false;
      });
    return _sampleAvail[path] === true;
  } catch {
    _sampleAvail[path] = false;
    return false;
  }
}

// ─── Cross-navigation handoff ──────────────────────────────────────────────
const ARRIVAL_KEY = "gaffer_just_entered";

export function markPitchEntry() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ARRIVAL_KEY, String(Date.now()));
}

export function consumePitchEntry(): boolean {
  if (typeof window === "undefined") return false;
  const t = sessionStorage.getItem(ARRIVAL_KEY);
  if (!t) return false;
  const age = Date.now() - Number(t);
  sessionStorage.removeItem(ARRIVAL_KEY);
  return age < 5000;
}

// ─── UI Click — punchy 80ms percussive ────────────────────────────────────
export function playClick() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(g).connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.09);
}

// ─── Subtle hover tick — quieter, higher pitch ────────────────────────────
export function playHover() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1800;
  g.gain.setValueAtTime(0.04, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  osc.connect(g).connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.05);
}

// ─── Swoosh — noise sweep for page nav / transitions ──────────────────────
export function playSwoosh() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.35;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, now);
  bp.frequency.exponentialRampToValueAtTime(3000, now + dur);
  bp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now); src.stop(now + dur);
}

// ─── Success — 3-note ascending arpeggio (C-E-G major) ────────────────────
export function playSuccess() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.31);
  });
}

// ─── Fail — 2-note descending ──────────────────────────────────────────────
export function playFail() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [440, 311.13].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const t = now + i * 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.36);
  });
}

// ─── Coin — metallic clink for mints / payouts ────────────────────────────
export function playCoin() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Two stacked sine osc — high overtones = metallic ring
  [988, 1568].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.4);
    g.gain.setValueAtTime(0.18 / (i + 1), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(g).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.55);
  });
}

// ─── Whistle — referee long whistle (match end / kickoff) ─────────────────
export function playWhistle() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(2200, now);
  // Add tiny vibrato via second oscillator → no, just static high pitch
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
  g.gain.setValueAtTime(0.25, now + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  osc.connect(g).connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.6);
}

// ─── Level up — major triad chord ─────────────────────────────────────────
export function playLevelUp() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [392, 493.88, 587.33, 783.99].forEach((freq) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(g).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.75);
  });
}

