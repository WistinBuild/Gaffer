"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGaffer, useHasMinted, useSquadCards } from "@/lib/useGaffer";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";
import { enrichPlayer, ATTR_LABELS } from "@/lib/player-attributes";
import { activeSynergies } from "@/lib/synergies";
import { SKILL_CARDS } from "@/lib/skill-cards";
import type { Instruction, Mentality, DugholePlayer } from "@/types/dughole";

const players = playersData as Player[];
const RARITY_NAMES = ["BRONZE", "SILVER", "GOLD", "ICON"] as const;

// Demo squad shown when the user has no on-chain squad yet (not connected, or hasn't minted).
const FALLBACK_SQUAD_IDS = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];

const ROLES_BY_POS: Record<string, { id: string; name: string; desc: string }[]> = {
  GK:  [
    { id: "sweeper",     name: "Sweeper Keeper",  desc: "Comes off line, plays out from the back" },
    { id: "shotstopper", name: "Shot Stopper",    desc: "Stays on line, focuses on saves" },
  ],
  DEF: [
    { id: "ball_playing", name: "Ball-Playing CB", desc: "Steps into midfield, switches play" },
    { id: "stopper",      name: "Stopper",         desc: "Aggressive, steps in for tackles" },
    { id: "covering",     name: "Covering CB",     desc: "Sits deep, sweeps behind partner" },
  ],
  MID: [
    { id: "deep_playmaker", name: "Deep Playmaker", desc: "Sits in front of defence, dictates tempo" },
    { id: "box_to_box",     name: "Box to Box",     desc: "Engine that covers the whole pitch" },
    { id: "advanced_pm",    name: "Advanced Playmaker", desc: "Operates between the lines" },
    { id: "ball_winner",    name: "Ball Winner",    desc: "Hunts second balls, breaks up play" },
  ],
  FWD: [
    { id: "poacher",       name: "Poacher",       desc: "Stays central, exploits space in the box" },
    { id: "target_man",    name: "Target Man",    desc: "Holds up play, brings teammates in" },
    { id: "false_nine",    name: "False Nine",    desc: "Drops deep to create chances" },
    { id: "press_forward", name: "Press Forward", desc: "Hunts defenders, disrupts build-up" },
  ],
  FLEX: [{ id: "free_role", name: "Free Role", desc: "Picks position based on phase" }],
};

const INSTRUCTIONS: Instruction[] = [
  "Sit Deep",
  "Overlap",
  "Stay Wide",
  "Cut Inside",
  "Press High",
  "Hold Position",
];

const MENTALITIES: { id: Mentality; desc: string }[] = [
  { id: "Defensive", desc: "Sit deep, hit on the counter" },
  { id: "Balanced",  desc: "Standard shape, react to flow" },
  { id: "Attacking", desc: "Push high, commit numbers forward" },
  { id: "Counter",   desc: "Bait the press, transition fast" },
];

export default function SquadSetupPage() {
  const params = useParams();
  const router = useRouter();
  const warId = params?.id as string;
  const { address, pubkey } = useGaffer();

  // ─── Read on-chain squad (falls back to demo five if not connected / not minted) ───
  const { data: hasMinted } = useHasMinted(pubkey);
  const { data: squadCards } = useSquadCards(pubkey); // ChainCard[] | null (null = not minted)

  const chainSquadIds: string[] = useMemo(() => {
    if (!squadCards || squadCards.length === 0) return [];
    const ids = squadCards
      .map((c) => c.playerId ?? "")
      .filter((id) => id && players.some((p) => p.id === id));
    return ids.length === 5 ? ids : [];
  }, [squadCards]);

  const cardRarityById = useMemo(() => {
    const map: Record<string, (typeof RARITY_NAMES)[number]> = {};
    squadCards?.forEach((c) => {
      if (c?.playerId) map[c.playerId] = RARITY_NAMES[c.rarity] ?? "BRONZE";
    });
    return map;
  }, [squadCards]);

  const isUsingChainSquad = chainSquadIds.length === 5;
  // FALLBACK_SQUAD_IDS is internal scaffolding only — it keeps the hooks below from
  // crashing before the gate renders. It is never shown (see the gate before return).
  const SQUAD_IDS = isUsingChainSquad ? chainSquadIds : FALLBACK_SQUAD_IDS;

  // Enrich squad with full attributes
  const squad: DugholePlayer[] = useMemo(
    () => SQUAD_IDS.map((id) => enrichPlayer(players.find((p) => p.id === id)!)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [SQUAD_IDS.join(",")],
  );

  const [roles, setRoles] = useState<Record<string, string>>(() =>
    Object.fromEntries(squad.map((p) => [p.id, ROLES_BY_POS[p.position]?.[0]?.id ?? "free_role"])),
  );
  const [instructions, setInstructions] = useState<Record<string, Instruction>>(() =>
    Object.fromEntries(squad.map((p) => [p.id, "Hold Position" as Instruction])),
  );
  const [mentality, setMentality] = useState<Mentality>("Balanced");
  const [captainId, setCaptainId] = useState<string>(squad[4].id); // default Mbappé
  const [benchedId, setBenchedId] = useState<string>(squad[3].id); // default Bellingham
  const [equippedCards, setEquippedCards] = useState<Record<string, string[]>>({});

  const synergies = activeSynergies(squad);

  // Track newly-unlocked synergies for the pop animation
  const prevSynergyIds = useRef<Set<string>>(new Set());
  const [newSynergyIds, setNewSynergyIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(synergies.map((s) => s.id));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevSynergyIds.current.has(id)) fresh.add(id);
    });
    if (fresh.size > 0) {
      setNewSynergyIds(fresh);
      setTimeout(() => setNewSynergyIds(new Set()), 800);
    }
    prevSynergyIds.current = currentIds;
  }, [synergies]);

  // Track captain/bench toggle bumps for animation
  const [captainBump, setCaptainBump] = useState(0);
  const [benchBump, setBenchBump] = useState(0);

  // Lock-in transition state
  const [lockingIn, setLockingIn] = useState(false);

  function lockIn() {
    setLockingIn(true);
    setTimeout(() => doLockIn(), 1000);
  }

  function doLockIn() {
    // Save to sessionStorage so /match can read it without a backend
    if (typeof window !== "undefined") {
      const setup = {
        squad: SQUAD_IDS,
        roles,
        instructions,
        mentality,
        captainId,
        benchedId,
        equippedCards,
      };
      sessionStorage.setItem(`match_setup_${warId}`, JSON.stringify(setup));
    }
    router.push(`/match/${warId}`);
  }

  // Gate: never render the scaffolding squad — show a real state until the
  // manager's on-chain squad is loaded.
  if (!address) return <SetupGate title="Connect your wallet" sub="Connect to load your squad and set up this war." />;
  if (hasMinted === false || squadCards === null) return <SetupGate title="No squad yet" sub="Mint your five-player squad before setting up a war." href="/squad" cta="Mint a squad" />;
  if (!isUsingChainSquad) return <SetupGate title="Loading your squad…" sub="Reading your cards from the chain." />;

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.tactics} opacity={0.22} blur={3} overlay="hero" blend="luminosity" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <div>
              <Link href={`/wars`} className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.22em] uppercase text-white/50 hover:text-white transition-colors mb-3">
                ← Back to wars
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-electric/15 hairline px-3 py-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">
                  Pre-match · War #{warId}
                </span>
              </div>
              <h1 className="mt-4 font-display text-white text-6xl sm:text-7xl leading-[0.88]">
                <LetterWave text="Set" glow="white" charDelay={28} liftPx={10} />{" "}
                <span className="text-gaffer-gold">
                  <LetterWave text="your shape." glow="gold" charDelay={26} liftPx={10} />
                </span>
              </h1>
              <p className="mt-3 text-white/55 max-w-xl">
                One captain (2× decisions). One bench (sits out). Roles, instructions, mentality.
                Once locked, the match runs live.
              </p>
            </div>

            <button
              onClick={lockIn}
              className="group inline-flex items-center gap-3 rounded-full bg-gaffer-electric pl-7 pr-2 py-3 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:brightness-110 animate-hot-edge"
            >
              <span className="font-display text-xl tracking-wider">LOCK IN · KICK OFF</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT — squad cards + per-player config */}
            <div className="lg:col-span-8 space-y-6">
              {/* Squad row */}
              <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gradient-to-b from-gaffer-pitch/30 via-gaffer-surface/50 to-gaffer-black hairline inner-glow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                      Your five
                    </div>
                    <div className={`font-mono text-[9px] tracking-[0.22em] uppercase rounded-full px-2 py-0.5 ${
                      isUsingChainSquad
                        ? "bg-gaffer-electric/15 text-gaffer-electric"
                        : "bg-white/[0.06] text-white/45"
                    }`}>
                      {isUsingChainSquad ? "● ON-CHAIN" : "Demo squad"}
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3 mb-6">
                    {squad.map((p) => {
                      const isCapt = captainId === p.id;
                      const isBench = benchedId === p.id;
                      return (
                        <div key={p.id} className="flex flex-col items-center gap-2">
                          <PlayerCard
                            player={p}
                            rarity={
                              cardRarityById[p.id] ??
                              (p.id === "mbappe" ? "ICON" : ["van_dijk","bellingham","rodri"].includes(p.id) ? "GOLD" : "SILVER")
                            }
                            size="sm"
                            isCaptain={isCapt}
                            isBenched={isBench}
                            tilt={false}
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                if (captainId !== p.id) setCaptainBump((b) => b + 1);
                                setCaptainId(p.id);
                                if (benchedId === p.id) setBenchedId(squad.find((q) => q.id !== p.id)!.id);
                              }}
                              className={`px-2 py-0.5 rounded-full font-mono text-[9px] tracking-[0.18em] font-bold transition-all duration-150 ease-out-strong active:scale-95 ${
                                isCapt
                                  ? `bg-gaffer-electric text-gaffer-black shadow-[0_0_10px_rgba(34, 197, 141,0.5)] ${captainBump > 0 ? "animate-badge-pop" : ""}`
                                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                              }`}
                              key={`c-${p.id}-${isCapt ? captainBump : 0}`}
                            >
                              C
                            </button>
                            <button
                              onClick={() => {
                                if (benchedId !== p.id) setBenchBump((b) => b + 1);
                                setBenchedId(p.id);
                                if (captainId === p.id) setCaptainId(squad.find((q) => q.id !== p.id)!.id);
                              }}
                              className={`px-2 py-0.5 rounded-full font-mono text-[9px] tracking-[0.18em] font-bold transition-all duration-150 ease-out-strong active:scale-95 ${
                                isBench
                                  ? `bg-white/20 text-white ${benchBump > 0 ? "animate-badge-pop" : ""}`
                                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                              }`}
                              key={`b-${p.id}-${isBench ? benchBump : 0}`}
                            >
                              B
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Per-player setup */}
              <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6">
                  <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-4">
                    Roles + instructions
                  </div>
                  <div className="space-y-4">
                    {squad.map((p) => (
                      <PlayerSetupRow
                        key={p.id}
                        player={p}
                        role={roles[p.id]}
                        onRole={(r) => setRoles({ ...roles, [p.id]: r })}
                        instruction={instructions[p.id]}
                        onInstruction={(i) => setInstructions({ ...instructions, [p.id]: i })}
                        equipped={equippedCards[p.id] ?? []}
                        onCard={(cards) => setEquippedCards({ ...equippedCards, [p.id]: cards })}
                        isBench={benchedId === p.id}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — mentality + synergies */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28 lg:self-start">
              {/* Mentality */}
              <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6">
                  <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-4">
                    Team mentality
                  </div>
                  <div className="space-y-2">
                    {MENTALITIES.map((m) => {
                      const sel = mentality === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMentality(m.id)}
                          className={`w-full text-left rounded-xl px-4 py-3 transition-all duration-150 ease-out-strong active:scale-[0.99] ${
                            sel ? "bg-gaffer-gold text-gaffer-black" : "bg-white/[0.03] hairline text-white/80 hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="font-display text-lg leading-none">{m.id}</div>
                          <div className={`font-mono text-[10px] tracking-[0.15em] uppercase mt-1 ${sel ? "text-gaffer-black/70" : "text-white/40"}`}>
                            {m.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Synergies */}
              <div className="rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-gold/40 to-transparent">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold uppercase">
                      Active synergies
                    </div>
                    <div className="font-display text-3xl text-gaffer-gold tabular-nums leading-none">{synergies.length}</div>
                  </div>
                  {synergies.length === 0 ? (
                    <div className="text-white/45 text-sm">
                      No synergies active. Try swapping players or roles to discover them.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {synergies.map((s) => {
                        const isNew = newSynergyIds.has(s.id);
                        return (
                        <div
                          key={s.id}
                          className={`relative rounded-xl p-3 bg-gaffer-gold/8 hairline hover-lift ${isNew ? "animate-synergy-pop" : ""}`}
                          style={isNew ? { boxShadow: "0 0 0 1px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.25)" } : undefined}
                        >
                          {isNew && (
                            <span className="absolute -top-2 right-2 rounded-full bg-gaffer-electric text-gaffer-black px-2 py-0.5 font-mono text-[8px] tracking-[0.2em] font-bold animate-badge-pop">
                              ★ UNLOCKED
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-gaffer-gold text-base">★</span>
                            <div className="font-display text-base text-white">
                              <HoverWord glow="gold">{s.name}</HoverWord>
                            </div>
                          </div>
                          <div className="font-mono text-[10px] tracking-[0.15em] text-white/55 uppercase mt-1 leading-relaxed">
                            {s.description}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(s.buff).map(([k, v]) => (
                              <span key={k} className="rounded-full bg-gaffer-electric/15 px-2 py-0.5 font-mono text-[9px] tracking-[0.15em] text-gaffer-electric uppercase">
                                +{v} {ATTR_LABELS[k as keyof typeof ATTR_LABELS]}
                              </span>
                            ))}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LOCK-IN TRANSITION OVERLAY */}
        {lockingIn && (
          <div className="fixed inset-0 z-[100] pointer-events-none">
            <div
              className="absolute inset-0 bg-gaffer-black"
              style={{ animation: "portal-bg 1000ms cubic-bezier(0.23, 1, 0.32, 1) forwards", opacity: 0 }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle at center, rgba(34, 197, 141,0.4) 0%, transparent 50%)",
                animation: "portal-bloom 1000ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="font-display text-gaffer-electric text-7xl tracking-[0.15em]"
                style={{ textShadow: "0 0 60px rgba(34, 197, 141,0.7)", animation: "portal-text 1000ms cubic-bezier(0.23, 1, 0.32, 1) forwards", opacity: 0 }}
              >
                LOCKED
              </div>
              <div
                className="mt-3 font-mono text-[11px] tracking-[0.3em] text-white/80 uppercase"
                style={{ animation: "portal-text 1000ms cubic-bezier(0.23, 1, 0.32, 1) 200ms forwards", opacity: 0 }}
              >
                ★ Kick off ★
              </div>
            </div>
            <style jsx>{`
              @keyframes portal-bg {
                0% { opacity: 0; } 30% { opacity: 0.95; } 100% { opacity: 1; }
              }
              @keyframes portal-bloom {
                0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; }
              }
              @keyframes portal-text {
                0% { opacity: 0; transform: translateY(20px) scale(0.92); }
                40% { opacity: 1; transform: translateY(0) scale(1); }
                100% { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        )}
      </main>
    </>
  );
}

function PlayerSetupRow({
  player, role, onRole, instruction, onInstruction, equipped, onCard, isBench,
}: {
  player: DugholePlayer;
  role: string;
  onRole: (r: string) => void;
  instruction: Instruction;
  onInstruction: (i: Instruction) => void;
  equipped: string[];
  onCard: (cards: string[]) => void;
  isBench: boolean;
}) {
  const roles = ROLES_BY_POS[player.position] ?? ROLES_BY_POS.FLEX;
  return (
    <div className={`rounded-xl p-4 hairline transition-opacity ${isBench ? "bg-white/[0.02] opacity-50" : "bg-white/[0.03]"}`}>
      <div className="flex items-center gap-3 mb-3">
        <img src={`/players/${player.id}.png`} alt="" className="h-10 w-10 rounded-full object-cover bg-gaffer-pitch ring-1 ring-white/20" draggable={false} />
        <div className="flex-1">
          <div className="font-display text-lg text-white leading-none">{player.shortName}</div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
            {player.position} · {player.personality} · age {player.age}
          </div>
        </div>
        {isBench && (
          <span className="rounded-full bg-white/15 text-white/80 px-2 py-1 font-mono text-[9px] tracking-[0.18em] font-bold">BENCH</span>
        )}
      </div>

      {/* Role */}
      <div className="mb-3">
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mb-1">Role</div>
        <select
          value={role}
          onChange={(e) => onRole(e.target.value)}
          disabled={isBench}
          className="w-full bg-gaffer-black/40 hairline rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-gaffer-gold/40 disabled:opacity-50"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id} className="bg-gaffer-surface">{r.name} — {r.desc}</option>
          ))}
        </select>
      </div>

      {/* Instruction pills */}
      <div className="mb-3">
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mb-1">Instruction</div>
        <div className="flex flex-wrap gap-1">
          {INSTRUCTIONS.map((i) => (
            <button
              key={i}
              onClick={() => onInstruction(i)}
              disabled={isBench}
              className={`px-2.5 py-1 rounded-full font-mono text-[10px] tracking-[0.15em] uppercase transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                instruction === i ? "bg-gaffer-gold text-gaffer-black" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Skill cards */}
      <div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mb-1">Skill cards (max 2)</div>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_CARDS.filter((c) => !c.position_restriction || c.position_restriction.includes(player.position as any)).map((c) => {
            const on = equipped.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => {
                  if (on) onCard(equipped.filter((x) => x !== c.id));
                  else if (equipped.length < 2) onCard([...equipped, c.id]);
                }}
                disabled={isBench}
                title={c.description}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] uppercase transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                  on ? "bg-gaffer-electric/15 text-gaffer-electric ring-1 ring-gaffer-electric/40" : "bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                <span className="text-sm">{c.glyph}</span>
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SetupGate({ title, sub, href, cta }: { title: string; sub: string; href?: string; cta?: string }) {
  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="font-mono text-[10px] tracking-[0.32em] text-gaffer-gold/70 uppercase mb-3">War setup</div>
          <h1 className="font-display text-4xl sm:text-5xl text-white leading-none">{title}</h1>
          <p className="mt-4 text-white/55 text-sm">{sub}</p>
          {href && cta && (
            <Link
              href={href}
              className="inline-flex items-center gap-2 mt-7 rounded-full bg-gaffer-gold px-5 py-2.5
                text-gaffer-black font-semibold text-sm transition-transform duration-150
                ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
            >
              {cta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
