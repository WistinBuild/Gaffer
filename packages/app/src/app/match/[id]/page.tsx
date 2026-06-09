"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { MiniPitch, type Celebration } from "@/components/ui/MiniPitch";
import { playCrowd, playKick, playWhistle, playSuccess, playFail } from "@/lib/sounds";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";
import { enrichPlayer } from "@/lib/player-attributes";
import { DECISION_LIBRARY, pickDecision } from "@/lib/decisions";
import { activeSynergies } from "@/lib/synergies";
import {
  initPlayerState,
  successProbability,
  resolveDecision,
  applyOutcomeToState,
  synergyBuffFor,
  type DecisionOutcome,
} from "@/lib/match-engine";
import type {
  DugholePlayer,
  MatchState,
  PlayerMatchState,
  DecisionTemplate,
  DecisionOption,
} from "@/types/dughole";

const players = playersData as Player[];
const TOTAL_DECISIONS = 8;
const DECISION_TIMER_MS = 12000;
const SIM_TICK_MS = 350; // minute advances per tick when simulating between decisions

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const warId = params?.id as string;

  // Load setup from sessionStorage (set by /squad-setup/[id])
  const setup = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(`match_setup_${warId}`);
    if (!raw) {
      // Fallback default setup
      return {
        squad: ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"],
        captainId: "mbappe",
        benchedId: "bellingham",
        mentality: "Balanced",
        roles: {},
        instructions: {},
        equippedCards: {},
      };
    }
    return JSON.parse(raw);
  }, [warId]);

  const squad: DugholePlayer[] = useMemo(
    () => (setup?.squad ?? []).map((id: string) => enrichPlayer(players.find((p) => p.id === id)!)),
    [setup],
  );

  const synergies = useMemo(() => activeSynergies(squad), [squad]);

  const [state, setState] = useState<MatchState | null>(null);
  const [phase, setPhase] = useState<"intro" | "live" | "decision" | "complete">("intro");

  // ─── Real-war mode — when the war is on-chain (bot or future human),
  // we hide success probabilities and apply harsher repercussions for wrong
  // calls so the stakes feel real. Determined by sessionStorage flag set by
  // /wars when the user accepts/creates a staked war.
  const [isRealWar, setIsRealWar] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag =
      sessionStorage.getItem(`bot_war_${warId}`) === "1" ||
      sessionStorage.getItem(`real_war_${warId}`) === "1";
    setIsRealWar(flag);
  }, [warId]);

  // ─── Music ducking — silence background music while the match is live,
  // let cheers + SFX carry the moment. Restore when match completes or user leaves.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("gaffer:music-duck"));
    return () => {
      window.dispatchEvent(new Event("gaffer:music-unduck"));
    };
  }, []);

  useEffect(() => {
    if (phase === "complete" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("gaffer:music-unduck"));
      // Full-time whistle + crowd
      playWhistle();
      setTimeout(() => playCrowd(4), 350);
    }
  }, [phase]);
  const [currentDecision, setCurrentDecision] = useState<{
    template: DecisionTemplate;
    player: PlayerMatchState;
    probs: number[];
  } | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    pts: number;
    oppPts: number;
    label: string;
    banner: DecisionOutcome["banner"];
  } | null>(null);
  const [celebration, setCelebration] = useState<Celebration>(null);

  // Initialize match state on mount
  useEffect(() => {
    if (!setup || squad.length === 0) return;
    const deck: PlayerMatchState[] = squad
      .filter((p) => p.id !== setup.benchedId)
      .map(initPlayerState);
    setState({
      warId,
      minute: 0,
      yourScore: 0,
      oppScore: 0,
      momentum: 0,
      deck,
      decisionsTaken: [],
      active: null,
      status: "live",
      setup: setup as any,
    });
    // After short intro, start
    const t = setTimeout(() => setPhase("live"), 1800);
    return () => clearTimeout(t);
  }, [setup, squad, warId]);

  // Simulation tick — advances minute until next decision should fire
  useEffect(() => {
    if (phase !== "live" || !state) return;
    if (state.decisionsTaken.length >= TOTAL_DECISIONS) {
      // Match complete
      setPhase("complete");
      return;
    }
    // Compute next decision minute
    const decisionsLeft = TOTAL_DECISIONS - state.decisionsTaken.length;
    const minutesLeft = 90 - state.minute;
    const stride = Math.max(4, Math.floor(minutesLeft / decisionsLeft));
    const fireAt = Math.min(89, state.minute + stride);

    const interval = setInterval(() => {
      setState((s) => {
        if (!s) return s;
        const next = Math.min(s.minute + 2, fireAt);
        // Slight passive score drift for both sides
        const yourDrift = Math.random() < 0.18 ? 1 : 0;
        const oppDrift = Math.random() < 0.18 ? 1 : 0;
        if (next >= fireAt) {
          // Time to fire a decision
          const positions = s.deck.map((d) => d.player.position);
          const template = pickDecision(new Set(s.decisionsTaken.map((d) => d.decisionId)), next, positions);
          if (!template) {
            return { ...s, minute: next, status: "complete" };
          }
          // Pick a deck player matching the filter (captain gets bias)
          const eligible = s.deck.filter((d) =>
            !template.position_filter || template.position_filter.includes(d.player.position),
          );
          const player = eligible.find((d) => d.player.id === s.setup.captainId) ?? eligible[0] ?? s.deck[0];

          const synergyTotal = (attr: any) => synergyBuffFor(attr, synergies);
          const probs = template.options.map((o) =>
            successProbability(o, player, s.momentum, synergyTotal(o.primary_attr)),
          );

          // Pause for decision
          setCurrentDecision({ template, player, probs });
          setPhase("decision");
          clearInterval(interval);
          return { ...s, minute: next, yourScore: s.yourScore + yourDrift, oppScore: s.oppScore + oppDrift };
        }
        return { ...s, minute: next, yourScore: s.yourScore + yourDrift, oppScore: s.oppScore + oppDrift };
      });
    }, SIM_TICK_MS);

    return () => clearInterval(interval);
  }, [phase, state, synergies]);

  // ─── Pick a decision option ──────────────────────────────────────────────
  const chooseOption = useCallback(
    (option: DecisionOption) => {
      if (!state || !currentDecision) return;
      const idx = currentDecision.template.options.findIndex((o) => o.id === option.id);
      const prob = currentDecision.probs[idx];
      const isCaptainPlay = currentDecision.player.player.id === state.setup.captainId;
      const outcome = resolveDecision(option, prob, isCaptainPlay);
      let newState = applyOutcomeToState(
        state,
        currentDecision.template,
        option,
        currentDecision.player,
        outcome,
      );

      // ─── Real-war repercussion — every wrong call hands the opponent
      // an extra point. On-chain stakes mean misclicks should bite.
      if (isRealWar && !outcome.success) {
        const bonusPenalty =
          outcome.failType === "concede_penalty" ? 2
          : outcome.failType === "concede_goal"   ? 1
          : 1;
        newState = {
          ...newState,
          oppScore: newState.oppScore + bonusPenalty,
        };
        outcome.oppPts = (outcome.oppPts ?? 0) + bonusPenalty;
      }

      // Trigger celebration based on outcome
      let celeb: Celebration = null;
      if (outcome.success && outcome.successType === "goal") {
        celeb = { type: "goal_you", label: option.label };
        playCrowd(3.2);
        playKick();
      } else if (outcome.success && outcome.successType === "save") {
        celeb = { type: "save", label: option.label };
        playKick();
      } else if (!outcome.success && outcome.failType === "concede_penalty") {
        celeb = { type: "penalty_opp", label: outcome.banner.subtitle };
        playKick();
      } else if (!outcome.success && outcome.failType === "concede_goal") {
        celeb = { type: "goal_opp", label: outcome.banner.subtitle };
        playKick();
      }

      setLastResult({
        success: outcome.success,
        pts: outcome.pts,
        oppPts: outcome.oppPts,
        label: option.label,
        banner: outcome.banner,
      });
      setState(newState);
      setCurrentDecision(null);

      if (celeb) {
        setCelebration(celeb);
        // Hold celebration longer than result flash
        setTimeout(() => setCelebration(null), 2400);
        setTimeout(() => { setLastResult(null); setPhase("live"); }, 2600);
      } else {
        setTimeout(() => { setLastResult(null); setPhase("live"); }, 1800);
      }
    },
    [state, currentDecision],
  );

  // ─── Timer — auto-pick highest prob on expiry ────────────────────────────
  useEffect(() => {
    if (phase !== "decision" || !currentDecision) return;
    const t = setTimeout(() => {
      const best = currentDecision.template.options[
        currentDecision.probs.indexOf(Math.max(...currentDecision.probs))
      ];
      chooseOption(best);
    }, DECISION_TIMER_MS);
    return () => clearTimeout(t);
  }, [phase, currentDecision, chooseOption]);

  if (!state) {
    return (
      <>
        <Navbar />
        <main className="relative min-h-[100dvh] flex items-center justify-center">
          <div className="font-display text-white text-3xl">Loading match…</div>
        </main>
      </>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8 overflow-hidden">
        <Backdrop src={FOOTBALL_IMAGERY.stadiumNight} opacity={0.35} blur={2} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-6xl">
          {/* SCOREBOARD */}
          <Scoreboard state={state} synergies={synergies.length} />

          {/* MOMENTUM */}
          <MomentumBar momentum={state.momentum} />

          {/* MINI PITCH — live 2D simulation */}
          <div className="mt-6">
            <MiniPitch
              yourSquad={state.deck.map((d) => ({
                id: d.player.id,
                position: d.player.position as any,
                isCaptain: d.player.id === state.setup.captainId,
              }))}
              activePlayerId={currentDecision?.player.player.id ?? null}
              yourScore={state.yourScore}
              oppScore={state.oppScore}
              tickMs={1100}
              celebration={celebration}
              paused={phase === "decision" || phase === "complete"}
            />
          </div>

          {/* MAIN AREA */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT — deck status */}
            <div className="lg:col-span-4 space-y-3">
              <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-1">
                On the pitch
              </div>
              {state.deck.map((d) => (
                <PlayerStatus
                  key={d.player.id}
                  ps={d}
                  isCaptain={d.player.id === state.setup.captainId}
                  isActive={currentDecision?.player.player.id === d.player.id}
                />
              ))}
            </div>

            {/* RIGHT — decision / live narration */}
            <div className="lg:col-span-8">
              {phase === "intro" && <IntroSplash />}
              {phase === "live" && !lastResult && <LivePulse state={state} />}
              {lastResult && <ResultFlash result={lastResult} />}
              {phase === "decision" && currentDecision && (
                <DecisionPanel
                  template={currentDecision.template}
                  player={currentDecision.player}
                  probs={currentDecision.probs}
                  isCaptain={currentDecision.player.player.id === state.setup.captainId}
                  onPick={chooseOption}
                  timerMs={DECISION_TIMER_MS}
                  hideProbs={isRealWar}
                />
              )}
              {phase === "complete" && (
                <CompletePanel state={state} warId={warId} isRealWar={isRealWar} onContinue={() => router.push(`/war/${warId}`)} />
              )}
            </div>
          </div>

          {/* DECISION LOG */}
          {state.decisionsTaken.length > 0 && phase !== "complete" && (
            <div className="mt-10 rounded-2xl p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[14px] bg-gaffer-surface/60 hairline inner-glow p-5">
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-3">
                  Decision log · {state.decisionsTaken.length}/{TOTAL_DECISIONS}
                </div>
                <div className="space-y-1.5 text-sm font-mono">
                  {state.decisionsTaken.slice().reverse().slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center gap-3 text-white/70">
                      <span className="text-white/30 tabular-nums">{String(d.minute).padStart(2, "0")}'</span>
                      <span className={d.success ? "text-gaffer-electric" : "text-gaffer-red"}>
                        {d.success ? "✓" : "✗"}
                      </span>
                      <span className="text-white/55">{DECISION_LIBRARY.find((t) => t.id === d.decisionId)?.options.find((o) => o.id === d.optionId)?.label}</span>
                      <span className="ml-auto tabular-nums" style={{ color: d.success ? "#7FE3C0" : "#FF6B6B" }}>
                        {d.success ? "+" : ""}{d.pointsScored}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function Scoreboard({ state, synergies }: { state: MatchState; synergies: number }) {
  return (
    <div className="rounded-[2rem] p-[1.5px] bg-gradient-to-r from-gaffer-gold/40 via-white/10 to-gaffer-electric/30">
      <div className="rounded-[calc(2rem-1.5px)] bg-gaffer-black/80 backdrop-blur-md hairline inner-glow px-6 py-5 grid grid-cols-3 items-center">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">You</div>
          <div className="font-display text-7xl text-gaffer-electric tabular-nums leading-none animate-scoreboard" style={{ textShadow: "0 0 24px rgba(34, 197, 141,0.4)" }}>
            {String(state.yourScore).padStart(2, "0")}
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Minute</div>
          <div className="font-display text-5xl text-white tabular-nums leading-none">
            {String(state.minute).padStart(2, "0")}'
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gaffer-red/15 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
            <span className="font-mono text-[9px] tracking-[0.22em] text-gaffer-red uppercase">Live · {synergies} synergies</span>
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Them</div>
          <div className="font-display text-7xl text-white/80 tabular-nums leading-none">
            {String(state.oppScore).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
}

function MomentumBar({ momentum }: { momentum: number }) {
  // -10..+10 mapped to 0..100% with 50% being neutral
  const pct = 50 + (momentum / 10) * 50;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-1">
        <span>Them</span>
        <span>Momentum {momentum > 0 ? "+" : ""}{momentum}</span>
        <span>You</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="bg-gaffer-red/60" style={{ width: `${100 - pct}%` }} />
          <div className="bg-gaffer-electric/60" style={{ width: `${pct}%`, boxShadow: "0 0 10px rgba(34, 197, 141,0.3)" }} />
        </div>
      </div>
    </div>
  );
}

function PlayerStatus({ ps, isCaptain, isActive }: { ps: PlayerMatchState; isCaptain: boolean; isActive: boolean }) {
  return (
    <div className={`rounded-xl p-3 hairline transition-all duration-200 ${
      isActive ? "bg-gaffer-electric/10 ring-1 ring-gaffer-electric animate-hot-edge" : "bg-gaffer-surface/60"
    }`}>
      <div className="flex items-center gap-3">
        <img src={`/players/${ps.player.id}.png`} alt="" className="h-10 w-10 rounded-full object-cover bg-gaffer-pitch ring-1 ring-white/15" draggable={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm truncate">{ps.player.shortName}</span>
            {isCaptain && <span className="rounded-full bg-gaffer-electric text-gaffer-black px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]">C 2×</span>}
          </div>
          <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">{ps.player.position}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <StatBar label="STA" value={ps.stamina} max={100} color="#F5D26C" />
        <StatBar label="COM" value={ps.composure} max={20}  color="#7FE3C0" />
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-white/40 tracking-[0.18em]">{label}</span>
        <span className="text-white/80 tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full transition-all duration-500 ease-out-strong" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function IntroSplash() {
  return (
    <div className="rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-gold/40 to-transparent">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-10 text-center">
        <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold uppercase mb-2">Kick off</div>
        <div className="font-display text-6xl text-white tracking-wider">
          <LetterWave text="GAME ON." glow="gold" charDelay={50} liftPx={16} />
        </div>
        <div className="mt-3 font-mono text-[11px] tracking-[0.22em] text-white/55 uppercase">
          Eight decisions. Ninety minutes. Outscore them.
        </div>
      </div>
    </div>
  );
}

function LivePulse({ state }: { state: MatchState }) {
  return (
    <div className="rounded-2xl p-1.5 bg-white/[0.04] hairline-strong">
      <div className="rounded-[14px] bg-gaffer-surface/60 hairline inner-glow p-8 text-center min-h-[280px] flex flex-col items-center justify-center gap-3">
        <span className="inline-flex h-3 w-3 rounded-full bg-gaffer-electric animate-live-dot" />
        <div className="font-display text-3xl text-white">Match in progress…</div>
        <div className="font-mono text-[11px] tracking-[0.22em] text-white/45 uppercase">
          Minute {state.minute}' · waiting for next moment
        </div>
      </div>
    </div>
  );
}

function ResultFlash({ result }: { result: { success: boolean; pts: number; oppPts: number; label: string; banner: DecisionOutcome["banner"] } }) {
  const color =
    result.banner.tone === "good" ? "#7FE3C0" :
    result.banner.tone === "bad"  ? "#FF6B6B" : "#F5D26C";
  return (
    <div className="rounded-2xl p-1.5 animate-hot-edge" style={{ background: `linear-gradient(135deg, ${color}55, transparent)` }}>
      <div className="rounded-[14px] bg-gaffer-surface/80 hairline inner-glow p-8 text-center">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color }}>
          {result.banner.title}
        </div>
        <div className="font-display text-2xl text-white mb-1 leading-tight">{result.label}</div>
        <div className="font-mono text-[11px] tracking-[0.18em] text-white/55 uppercase mb-4">
          {result.banner.subtitle}
        </div>
        <div className="flex items-center justify-center gap-6">
          {result.pts !== 0 && (
            <div>
              <div className="font-display text-5xl tabular-nums leading-none" style={{ color: result.pts > 0 ? "#7FE3C0" : "#FF6B6B", textShadow: `0 0 18px ${color}33` }}>
                {result.pts > 0 ? "+" : ""}{result.pts}
              </div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-white/45 uppercase mt-1">You</div>
            </div>
          )}
          {result.oppPts > 0 && (
            <div>
              <div className="font-display text-5xl text-gaffer-red tabular-nums leading-none" style={{ textShadow: "0 0 18px rgba(226, 85, 99,0.4)" }}>
                +{result.oppPts}
              </div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-white/45 uppercase mt-1">Them</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionPanel({
  template, player, probs, isCaptain, onPick, timerMs, hideProbs = false,
}: {
  template: DecisionTemplate;
  player: PlayerMatchState;
  probs: number[];
  isCaptain: boolean;
  onPick: (o: DecisionOption) => void;
  timerMs: number;
  hideProbs?: boolean;
}) {
  const [remaining, setRemaining] = useState(timerMs);

  useEffect(() => {
    setRemaining(timerMs);
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      setRemaining(Math.max(0, timerMs - elapsed));
    }, 50);
    return () => clearInterval(t);
  }, [timerMs, template.id]);

  const pct = (remaining / timerMs) * 100;

  return (
    <div className="rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-electric/60 via-gaffer-gold/20 to-transparent animate-hot-edge">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/80 backdrop-blur-md hairline inner-glow p-6 sm:p-8">
        {/* Player + timer */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src={`/players/${player.player.id}.png`} alt="" className="h-14 w-14 rounded-full object-cover bg-gaffer-pitch ring-2 ring-gaffer-electric" draggable={false} />
            <div>
              <div className="font-display text-2xl text-white">
                <HoverWord glow="electric">{player.player.shortName}</HoverWord>
              </div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
                {player.player.position} · {template.category.replace("_", " ")}
                {isCaptain && <span className="ml-2 text-gaffer-electric">· CAPTAIN 2×</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl text-gaffer-electric tabular-nums leading-none">
              {(remaining / 1000).toFixed(1)}
            </div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">seconds</div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-gaffer-electric to-gaffer-gold transition-all duration-100" style={{ width: `${pct}%` }} />
        </div>

        {/* Situation */}
        <p className="text-white text-lg leading-snug mb-6">
          {template.situation(player.player)}
        </p>

        {/* Options */}
        <div className="space-y-3">
          {template.options.map((o, i) => (
            <button
              key={o.id}
              onClick={() => onPick(o)}
              className="group w-full text-left rounded-xl p-4 bg-white/[0.04] hairline hover:bg-white/[0.08] transition-all duration-150 ease-out-strong active:scale-[0.99] hover-lift relative overflow-hidden"
            >
              {/* Probability bar — hidden in real-war mode (no telemetry) */}
              {!hideProbs && (
                <div className="absolute inset-y-0 left-0 transition-all duration-700"
                  style={{
                    width: `${probs[i]}%`,
                    background: probs[i] > 60 ? "linear-gradient(to right, rgba(34, 197, 141,0.18), rgba(34, 197, 141,0.02))"
                              : probs[i] > 35 ? "linear-gradient(to right, rgba(212,175,55,0.18), rgba(212,175,55,0.02))"
                                              : "linear-gradient(to right, rgba(255,107,107,0.18), rgba(255,107,107,0.02))",
                  }}
                />
              )}
              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-xl text-white leading-none mb-1">{o.label}</div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
                    <span className="text-white/45">{o.primary_attr.replace("_", " ")} · {player.player.attrs[o.primary_attr]}/20</span>
                    <span className={`rounded-full px-2 py-0.5 ${
                      o.risk === "low" ? "bg-gaffer-electric/15 text-gaffer-electric"
                      : o.risk === "medium" ? "bg-gaffer-gold/15 text-gaffer-gold"
                      : "bg-gaffer-red/15 text-gaffer-red"
                    }`}>
                      {o.risk} risk
                    </span>
                    <span className="text-white/45">+{o.reward_pts}</span>
                    {!hideProbs && (
                      <span className="rounded-full px-2 py-0.5 bg-gaffer-red/10 text-gaffer-red/80" title="If this fails">
                        fail → {consequenceShort(o.failConsequence)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {hideProbs ? (
                    <>
                      <div className="font-display text-3xl tabular-nums leading-none text-white/30">??%</div>
                      <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">hidden</div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-3xl tabular-nums leading-none" style={{
                        color: probs[i] > 60 ? "#7FE3C0" : probs[i] > 35 ? "#F5D26C" : "#FF6B6B",
                      }}>
                        {probs[i]}%
                      </div>
                      <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">success</div>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 font-mono text-[10px] tracking-[0.22em] uppercase text-center">
          {hideProbs ? (
            <span className="text-gaffer-red/70">
              ★ Real-war mode · probabilities hidden · wrong calls give the opponent a goal ★
            </span>
          ) : (
            <span className="text-white/30">Timeout → highest probability auto-picks</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FullTimeConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        i,
        x: (i * 137.5) % 100,
        delay: (i % 7) * 0.12,
        dur: 2.4 + (i % 5) * 0.35,
        color: ["#D4AF37", "#22C58D", "#FFFFFF", "#F5D26C", "#7FE3C0"][i % 5],
      })),
    [],
  );
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.i}
            className="absolute h-2 w-2 rounded-sm"
            style={{
              left: `${p.x}%`,
              top: "-10px",
              background: p.color,
              animation: `ft-confetti ${p.dur}s linear ${p.delay}s forwards`,
              boxShadow: `0 0 6px ${p.color}88`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes ft-confetti {
          0%   { transform: translateY(-10vh) rotate(0); opacity: 1; }
          100% { transform: translateY(120vh) rotate(540deg); opacity: 0.6; }
        }
        :global(.ft-shake) {
          animation: ft-shake 0.6s cubic-bezier(.36,.07,.19,.97);
        }
        @keyframes ft-shake {
          0%, 100% { transform: translateX(0); }
          10%,30%,50%,70%,90% { transform: translateX(-6px); }
          20%,40%,60%,80%      { transform: translateX(6px);  }
        }
      `}</style>
    </>
  );
}

function consequenceShort(c: string): string {
  return {
    concede_goal:    "goal conceded",
    concede_penalty: "PENALTY",
    yellow_card:     "yellow",
    free_kick_opp:   "free kick",
    injury:          "injury",
    lose_possession: "lose poss.",
  }[c] ?? c;
}

function CompletePanel({ state, warId, isRealWar, onContinue }: { state: MatchState; warId: string; isRealWar: boolean; onContinue: () => void }) {
  const won = state.yourScore > state.oppScore;
  const drew = state.yourScore === state.oppScore;
  const accuracy = state.decisionsTaken.length === 0
    ? 0
    : Math.round((state.decisionsTaken.filter((d) => d.success).length / state.decisionsTaken.length) * 100);

  // ─── End-of-match reveal animation ────────────────────────────────────
  const [revealStage, setRevealStage] = useState<"flash" | "scoreboard" | "verdict" | "done">("flash");
  useEffect(() => {
    if (won)         playSuccess();
    else if (!drew)  playFail();
    const t1 = setTimeout(() => setRevealStage("scoreboard"), 700);
    const t2 = setTimeout(() => setRevealStage("verdict"),    1500);
    const t3 = setTimeout(() => setRevealStage("done"),       2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── On-chain finalize state ──────────────────────────────────────────
  const [isBotWar, setIsBotWar] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsBotWar(sessionStorage.getItem(`bot_war_${warId}`) === "1");
  }, [warId]);

  const [finalize, setFinalize] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [finalizeErr, setFinalizeErr] = useState<string | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<{
    resolveTxHash?: string; winner?: string; challengerScore?: string; opponentScore?: string;
  } | null>(null);

  async function finalizeOnChain() {
    if (finalize === "pending" || finalize === "done") return;
    setFinalize("pending");
    setFinalizeErr(null);
    try {
      const res = await fetch("/api/bot/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `bot/finalize ${res.status}`);
      setFinalizeResult({
        resolveTxHash: j.resolveTxHash,
        winner: j.winner,
        challengerScore: j.challengerScore,
        opponentScore: j.opponentScore,
      });
      setFinalize("done");
    } catch (e) {
      setFinalizeErr(e instanceof Error ? e.message : String(e));
      setFinalize("error");
    }
  }

  const verdictColor = won ? "text-gaffer-electric" : drew ? "text-white" : "text-gaffer-red";
  const verdictGlow  = won ? "0 0 60px rgba(34, 197, 141,0.6)" : drew ? "0 0 30px rgba(255,255,255,0.3)" : "0 0 40px rgba(255,107,107,0.5)";
  const verdictText  = won ? "VICTORY" : drew ? "DRAW" : "DEFEAT";

  return (
    <div className={`relative rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-gold/60 via-white/10 to-gaffer-electric/40 animate-hot-edge overflow-hidden ${revealStage === "flash" ? "ft-shake" : ""}`}>
      {/* Win-only confetti */}
      {won && revealStage !== "flash" && <FullTimeConfetti />}

      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/80 hairline inner-glow p-10 text-center relative">
        {/* White-out flash when whistle blows */}
        <div className="absolute inset-0 pointer-events-none rounded-[calc(2rem-0.375rem)]" style={{
          background: won ? "rgba(34, 197, 141,0.45)" : drew ? "rgba(255,255,255,0.35)" : "rgba(255,107,107,0.4)",
          opacity: revealStage === "flash" ? 1 : 0,
          transition: "opacity 700ms cubic-bezier(0.4,0,0.2,1)",
        }} />

        <div className="font-mono text-[10px] tracking-[0.32em] text-gaffer-gold uppercase mb-3 relative"
          style={{ opacity: revealStage === "flash" ? 0 : 1, transition: "opacity 400ms 300ms ease-out" }}>
          ★ FULL TIME ★
        </div>

        {/* SCOREBOARD — slams in */}
        <div className="font-display text-7xl sm:text-8xl tabular-nums text-white relative" style={{
          opacity: revealStage === "flash" ? 0 : 1,
          transform: revealStage === "flash" ? "scale(0.4)" : "scale(1)",
          transition: "transform 600ms cubic-bezier(0.22,1.6,0.36,1), opacity 400ms ease-out",
          textShadow: revealStage !== "flash" ? "0 0 40px rgba(212,175,55,0.4)" : "none",
        }}>
          <span className={state.yourScore > state.oppScore ? "text-gaffer-electric" : ""}>
            {String(state.yourScore).padStart(2, "0")}
          </span>
          <span className="text-white/25 mx-3">—</span>
          <span className={state.oppScore > state.yourScore ? "text-gaffer-red" : ""}>
            {String(state.oppScore).padStart(2, "0")}
          </span>
        </div>

        {/* VERDICT — slam reveal */}
        <div className={`font-display text-6xl sm:text-7xl tracking-[0.12em] mt-6 relative ${verdictColor}`} style={{
          opacity: revealStage === "verdict" || revealStage === "done" ? 1 : 0,
          transform: revealStage === "verdict" || revealStage === "done" ? "translateY(0) scale(1)" : "translateY(20px) scale(0.85)",
          transition: "transform 500ms cubic-bezier(0.22,1.6,0.36,1), opacity 300ms ease-out",
          textShadow: revealStage === "verdict" || revealStage === "done" ? verdictGlow : "none",
        }}>
          {verdictText}
        </div>

        {/* Sub-line */}
        {isRealWar && (
          <div className="mt-3 font-mono text-[10px] tracking-[0.28em] text-gaffer-gold/80 uppercase relative"
            style={{ opacity: revealStage === "done" ? 1 : 0, transition: "opacity 400ms ease-out" }}>
            {won ? "★ pot is yours — finalize on-chain" : drew ? "Stake refunded" : "Pot lost to opponent"}
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-6 rounded-full bg-white/[0.04] hairline px-6 py-3 font-mono text-[11px] tracking-[0.22em] uppercase relative"
          style={{ opacity: revealStage === "done" ? 1 : 0, transition: "opacity 400ms 100ms ease-out" }}>
          <span>Decision accuracy · <span className="text-gaffer-gold">{accuracy}%</span></span>
          <span>·</span>
          <span>{state.decisionsTaken.length} moments resolved</span>
        </div>

        {isBotWar && finalize !== "done" && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={finalizeOnChain}
              disabled={finalize === "pending"}
              className="group inline-flex items-center gap-3 rounded-full bg-gaffer-electric pl-7 pr-2 py-3 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:brightness-110 disabled:opacity-60 animate-hot-edge"
            >
              <span className="font-display text-xl tracking-wider">
                {finalize === "pending" ? "SETTLING ON-CHAIN…" : "FINALIZE & CLAIM POT"}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gaffer-black/15">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase max-w-md">
              ★ Treasury finalizes the matchday and resolves the war on-chain. Winner receives 95% of the pot.
            </p>
            {finalizeErr && (
              <p className="font-mono text-[10px] tracking-[0.18em] text-gaffer-red/80 max-w-md uppercase">
                {finalizeErr.slice(0, 200)}
              </p>
            )}
          </div>
        )}

        {finalize === "done" && (
          <div className="mt-8 rounded-2xl bg-gaffer-electric/10 hairline p-5 inline-block text-left">
            <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase mb-2">★ Settled on-chain ★</div>
            <div className="font-display text-2xl text-white">
              {finalizeResult?.winner && finalizeResult.winner !== "0x0000000000000000000000000000000000000000"
                ? <>Winner <span className="text-gaffer-electric">{finalizeResult.winner.slice(0, 6)}…{finalizeResult.winner.slice(-4)}</span></>
                : <>Draw refunded</>}
            </div>
            <div className="font-mono text-[11px] tracking-[0.18em] text-white/55 mt-2">
              CHAIN SCORE · {finalizeResult?.challengerScore}–{finalizeResult?.opponentScore}
            </div>
            {finalizeResult?.resolveTxHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${finalizeResult.resolveTxHash}`}
                target="_blank" rel="noreferrer"
                className="block mt-3 font-mono text-[10px] tracking-[0.22em] text-gaffer-gold hover:brightness-110 underline uppercase"
              >
                View tx ↗
              </a>
            )}
          </div>
        )}

        <button
          onClick={onContinue}
          className="mt-8 group inline-flex items-center gap-3 rounded-full bg-gaffer-gold pl-8 pr-2 py-3 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
        >
          <span className="font-display text-xl tracking-wider">SEE RESULT</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
