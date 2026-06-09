"use client";

import { useEffect, useRef, useState } from "react";
import { isMuted } from "@/lib/sounds";

const PLAYLIST = [
  { src: "/music/symphony.mp3",   title: "Symphony — Clean Bandit" },
  { src: "/music/tv-off.mp3",     title: "TV Off — Kendrick Lamar" },
  { src: "/music/stir-fry.mp3",   title: "Stir Fry — Migos" },
  { src: "/music/hayya-hayya.mp3", title: "Hayya Hayya — WC 2022" },
];

const VOLUME_DEFAULT = 0.32; // foreground music — anthem energy on Enter the Pitch
const VOLUME_DUCKED  = 0.0;  // silent during matches; SFX + cheers take over
const DUCK_FADE_MS   = 450;
const STORAGE_KEY = "gaffer_music_active";

/**
 * Persistent background music player. Activates ONLY after the user clicks
 * Enter the Pitch (which writes the flag). Auto-cycles through playlist,
 * persists across pages via being mounted in the root layout.
 */
export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [ducked, setDucked] = useState(false);
  const duckedRef = useRef(false);

  // Smooth volume ramp (used by ducking + mute)
  function rampVolume(target: number, ms: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const start = audio.volume;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      audio.volume = start + (target - start) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Duck / unduck listeners — fired by match page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDuck = () => {
      duckedRef.current = true;
      setDucked(true);
      if (!isMuted()) rampVolume(VOLUME_DUCKED, DUCK_FADE_MS);
    };
    const onUnduck = () => {
      duckedRef.current = false;
      setDucked(false);
      if (!isMuted()) rampVolume(VOLUME_DEFAULT, DUCK_FADE_MS);
    };
    window.addEventListener("gaffer:music-duck", onDuck);
    window.addEventListener("gaffer:music-unduck", onUnduck);
    return () => {
      window.removeEventListener("gaffer:music-duck", onDuck);
      window.removeEventListener("gaffer:music-unduck", onUnduck);
    };
  }, []);

  // Poll for activation flag (set by EnterPitchButton)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const flag = sessionStorage.getItem(STORAGE_KEY) === "1";
      if (flag !== active) setActive(flag);
    };
    check();
    const interval = setInterval(check, 500);
    // Also listen for direct events
    const onActivate = () => {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setActive(true);
    };
    window.addEventListener("gaffer:music-activate", onActivate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("gaffer:music-activate", onActivate);
    };
  }, [active]);

  // Init audio element on activation
  useEffect(() => {
    if (!active || audioRef.current) return;
    const audio = new Audio(PLAYLIST[trackIdx].src);
    audio.volume = isMuted() || duckedRef.current ? 0 : VOLUME_DEFAULT;
    audio.addEventListener("ended", () => {
      setTrackIdx((i) => (i + 1) % PLAYLIST.length);
    });
    audio.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // autoplay may still fail; user can hit play
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Track change — swap audio source
  useEffect(() => {
    if (!audioRef.current || !active) return;
    audioRef.current.src = PLAYLIST[trackIdx].src;
    audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
  }, [trackIdx, active]);

  // Mute sync — global mute toggle from SoundToggle in nav
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const m = isMuted();
      setMutedState(m);
      if (audioRef.current) {
        audioRef.current.volume = m || duckedRef.current ? 0 : VOLUME_DEFAULT;
      }
    };
    sync();
    const id = setInterval(sync, 400);
    return () => clearInterval(id);
  }, []);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }
  function next() {
    setTrackIdx((i) => (i + 1) % PLAYLIST.length);
  }
  function close() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setActive(false);
  }

  if (!active) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] pointer-events-auto">
      <div
        className="rounded-full p-[1.5px] bg-gradient-to-br from-gaffer-gold/60 via-white/10 to-gaffer-electric/40"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="rounded-full bg-gaffer-black/85 backdrop-blur-md hairline inner-glow flex items-center gap-2 px-3 py-2">
          {/* Animated equalizer bars */}
          <div className="flex items-end gap-[2px] h-5 w-6">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  background: i % 2 === 0 ? "#D4AF37" : "#22C58D",
                  animation: playing && !muted
                    ? `eq-bar-${i} ${0.6 + i * 0.1}s ease-in-out infinite`
                    : "none",
                  height: playing && !muted ? "100%" : "20%",
                  transition: "height 200ms",
                }}
              />
            ))}
          </div>

          {/* Title — visible when expanded */}
          <span
            className={`overflow-hidden font-mono text-[10px] tracking-[0.22em] uppercase text-white/85 transition-all duration-300 ease-out-strong ${
              expanded ? "max-w-[200px] opacity-100 ml-1" : "max-w-0 opacity-0"
            } whitespace-nowrap`}
          >
            {ducked ? "★ ON THE PITCH ★" : PLAYLIST[trackIdx].title}
          </span>

          {/* Controls — visible when expanded */}
          <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-out-strong ${
            expanded ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
          }`}>
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors active:scale-90"
            >
              {playing ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button
              onClick={next}
              aria-label="Skip"
              className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors active:scale-90"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
            <button
              onClick={close}
              aria-label="Stop music"
              className="h-7 w-7 rounded-full bg-gaffer-red/15 hover:bg-gaffer-red/30 flex items-center justify-center transition-colors active:scale-90 text-gaffer-red"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes eq-bar-0 { 0%, 100% { height: 30%; } 50% { height: 90%; } }
        @keyframes eq-bar-1 { 0%, 100% { height: 60%; } 50% { height: 30%; } }
        @keyframes eq-bar-2 { 0%, 100% { height: 40%; } 50% { height: 100%; } }
        @keyframes eq-bar-3 { 0%, 100% { height: 80%; } 50% { height: 50%; } }
      `}</style>
    </div>
  );
}
