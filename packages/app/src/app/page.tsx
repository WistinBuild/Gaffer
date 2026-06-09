import Link from "next/link";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { Backdrop } from "@/components/ui/Backdrop";
import { EnterPitchButton } from "@/components/ui/EnterPitchButton";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

// ─── Mock live data (replace with chain reads in Stage 4) ─────────────────────
const MARQUEE_ITEMS = [
  { label: "MD3", value: "VINICIUS · 24 PTS", accent: "gold" },
  { label: "MD3", value: "BELLINGHAM · 18 PTS", accent: "white" },
  { label: "MD3", value: "MBAPPÉ · 31 PTS ⚡", accent: "electric" },
  { label: "LIVE", value: "8 WARS ACTIVE", accent: "red" },
  { label: "POT", value: "0.48 ETH STAKED", accent: "gold" },
  { label: "MD3", value: "KANE · 22 PTS", accent: "white" },
  { label: "NEW", value: "+ICON · VINICIUS JR.", accent: "electric" },
  { label: "MD4", value: "KICK-OFF IN 14h 22m", accent: "gold" },
  { label: "LIVE", value: "1,247 MANAGERS ONLINE", accent: "electric" },
  { label: "MD3", value: "VAN DIJK · 16 PTS", accent: "white" },
];

const WAR_ROOM = [
  { challenger: "0x4a7…dE12",    stake: "0.05", matchday: 4, minsLeft: 842, featured: true,  captain: "mbappe",     opp: "bellingham" },
  { challenger: "Cristiano21",   stake: "0.10", matchday: 4, minsLeft: 842, featured: false, captain: "vinicius",   opp: "kane" },
  { challenger: "0x9c1…7Fa3",    stake: "0.02", matchday: 4, minsLeft: 842, featured: false, captain: "saka",       opp: "musiala" },
  { challenger: "tikitaka.eth",  stake: "0.25", matchday: 4, minsLeft: 842, featured: false, captain: "rodri",      opp: "modric" },
];

const STAGES = [
  { code: "GROUP", mult: "1.0×", note: "MD 1–3", here: true },
  { code: "R16",   mult: "1.2×", note: "MD 4–5", here: false },
  { code: "QF",    mult: "1.5×", note: "MD 6",   here: false },
  { code: "SF",    mult: "2.0×", note: "MD 7",   here: false },
  { code: "FINAL", mult: "3.0×", note: "MD 8",   here: false },
];

const LEADERBOARD = [
  { rank: 1, name: "elGoatManager", w: 12, l: 1, win_rate: 92, profit: "+1.84" },
  { rank: 2, name: "0x4a7…dE12",    w: 11, l: 3, win_rate: 79, profit: "+1.42" },
  { rank: 3, name: "tikitaka.eth",  w: 10, l: 4, win_rate: 71, profit: "+0.98" },
  { rank: 4, name: "Cristiano21",   w:  9, l: 5, win_rate: 64, profit: "+0.51" },
  { rank: 5, name: "0x9c1…7Fa3",    w:  8, l: 5, win_rate: 62, profit: "+0.33" },
];

const FORGED_THIS_WEEK = [
  { id: "vinicius",   from: "GOLD",   to: "ICON",   reason: "31 pts vs France",        at: "2h ago" },
  { id: "saka",       from: "SILVER", to: "GOLD",   reason: "Hat-trick MD3",            at: "6h ago" },
  { id: "ruben_dias", from: "SILVER", to: "GOLD",   reason: "Clean sheet + assist",     at: "9h ago" },
  { id: "musiala",    from: "GOLD",   to: "ICON",   reason: "MD3 MOTM",                 at: "1d ago" },
];

const SQUAD_OF_WEEK = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function Portal() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden">
      {/* ═══ BROADCAST TICKER ════════════════════════════════════════ */}
      <BroadcastTicker />

      {/* ═══ HERO ARENA — VS face-off ════════════════════════════════ */}
      <section className="relative pt-24 pb-24 sm:pt-32 sm:pb-32 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.stadiumNight} opacity={0.42} blur={2} overlay="hero" blend="luminosity" scale={1.08} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-40" />
        <Particles count={12} />

        <HudChip position="top-left"     label="MD 4 · KICKOFF" value="14:22:11" tone="gold" />
        <HudChip position="top-right"    label="MANAGERS ONLINE" value="1,247"   tone="electric" />
        <HudChip position="bottom-left"  label="STAKED · WK"    value="48.2 ETH" tone="white" />
        <HudChip position="bottom-right" label="WARS NOW"       value="08"       tone="red" />

        <div className="relative mx-auto max-w-7xl">
          {/* Wordmark */}
          <div className="reveal flex items-center gap-3" style={{ ["--stagger-delay" as any]: "0ms" }}>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full overflow-hidden ring-1 ring-gaffer-gold/40 hover-lift">
              <img src="/logo.svg" alt="GAFFER" className="h-full w-full object-cover" draggable={false} />
            </span>
            <span className="font-display text-white text-3xl tracking-[0.18em]">
              <LetterWave text="GAFFER" glow="gold" charDelay={20} liftPx={5} />
            </span>
            <span className="ml-2 font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">
              World Cup 2026 · Base
            </span>
          </div>

          {/* Diagonal headline */}
          <div className="relative mt-14 sm:mt-20">
            <h1 className="font-display text-white text-[18vw] sm:text-[14vw] lg:text-[11rem] leading-[0.82] tracking-wide">
              <div className="reveal" style={{ ["--stagger-delay" as any]: "100ms" }}>
                <LetterWave text="DRAFT." glow="white" charDelay={25} liftPx={12} />
              </div>
              <div className="reveal sm:translate-x-[8vw] bg-gradient-to-r from-gaffer-gold via-[#FBE9A5] to-gaffer-gold bg-clip-text text-transparent" style={{ ["--stagger-delay" as any]: "200ms" }}>
                <LetterWave text="BATTLE." glow="gold" charDelay={30} liftPx={14} />
              </div>
              <div className="reveal text-gaffer-electric" style={{ ["--stagger-delay" as any]: "300ms", textShadow: "0 0 40px rgba(34, 197, 141,0.4)" }}>
                <LetterWave text="EARN." glow="electric" charDelay={35} liftPx={14} />
              </div>
            </h1>
          </div>

          {/* Subtitle + entry CTA */}
          <div className="reveal mt-12 flex flex-wrap items-end justify-between gap-6" style={{ ["--stagger-delay" as any]: "440ms" }}>
            <p className="max-w-md text-[15px] sm:text-base text-white/65 leading-relaxed">
              <HoverWord glow="white">Five</HoverWord>{" "}
              <HoverWord glow="gold">World Cup 2026</HoverWord>{" "}
              <HoverWord glow="white">players,</HoverWord>{" "}
              <HoverWord glow="white">minted</HoverWord>{" "}
              <HoverWord glow="white">as</HoverWord>{" "}
              <HoverWord glow="electric">NFTs.</HoverWord>{" "}
              <HoverWord glow="white">Stake</HoverWord>{" "}
              <HoverWord glow="gold">ETH.</HoverWord>{" "}
              <HoverWord glow="white">Outscore</HoverWord>{" "}
              <HoverWord glow="white">your</HoverWord>{" "}
              <HoverWord glow="white">opponent.</HoverWord>{" "}
              <HoverWord glow="white">Forge</HoverWord>{" "}
              <HoverWord glow="electric">bronze</HoverWord>{" "}
              <HoverWord glow="white">into</HoverWord>{" "}
              <HoverWord glow="gold">icon.</HoverWord>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <EnterPitchButton />
              <Link href="/squad" className="group inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-5 py-3 text-white/85 transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-white/[0.08]">
                <span className="font-medium text-[14px]">Skip → Draft directly</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <Arrow size={11} />
                </span>
              </Link>
            </div>
          </div>

          {/* VS FACE-OFF STAGE */}
          <div className="reveal relative mt-10 lg:mt-0 lg:absolute lg:right-0 lg:top-20 lg:w-[42%] xl:w-[44%]" style={{ ["--stagger-delay" as any]: "560ms" }}>
            <VersusStage />
          </div>
        </div>
      </section>

      {/* ═══ WAR ROOM ════════════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-24 sm:py-32">
        <Backdrop src={FOOTBALL_IMAGERY.crowd} opacity={0.18} blur={5} overlay="strong" blend="luminosity" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={<><LiveDot /> WAR ROOM · TONIGHT</>}
            title={<><LetterWave text="Eight wars open." glow="white" charDelay={15} liftPx={6} /><br/><span className="text-gaffer-electric"><LetterWave text="Pick your fight." glow="electric" charDelay={18} liftPx={6} /></span></>}
            right={<Link href="/wars" className="font-mono text-[12px] tracking-[0.2em] uppercase text-white/60 hover:text-gaffer-gold transition-colors hover-word hover-word-gold">Browse all →</Link>}
          />
          <div className="mt-10 space-y-3">
            {WAR_ROOM.map((w, i) => (
              <div key={i} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 80}ms` }}>
                <WarRoomRow {...w} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FORGED THIS WEEK ════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-24 sm:py-32">
        <Backdrop src={FOOTBALL_IMAGERY.boot} opacity={0.14} blur={4} overlay="strong" blend="luminosity" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={<><span className="text-gaffer-electric">▲</span> FORGED THIS WEEK</>}
            title={<><LetterWave text="Bronze cards" glow="white" charDelay={20} liftPx={8} /><br/><span className="text-gaffer-gold"><LetterWave text="become legends." glow="gold" charDelay={22} liftPx={8} /></span></>}
            right={<p className="font-mono text-[11px] tracking-[0.2em] text-white/40 max-w-[28ch] text-right uppercase">Every fantasy point you earn<br/>compounds onto your NFT — permanent.</p>}
          />
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {FORGED_THIS_WEEK.map((f, i) => (
              <div key={f.id} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 80}ms` }}>
                <ForgedCard player={pick(f.id)} from={f.from as any} to={f.to as any} reason={f.reason} at={f.at} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TOURNAMENT PATH ════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-24 sm:py-32">
        <Backdrop src={FOOTBALL_IMAGERY.trophy} opacity={0.18} blur={3} overlay="strong" blend="luminosity" position="center 30%" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={<><span className="text-gaffer-gold">★</span> PATH TO THE TROPHY</>}
            title={<><LetterWave text="Knockouts" glow="white" charDelay={22} liftPx={8} />{" "}<span className="text-gaffer-gold"><LetterWave text="compound." glow="gold" charDelay={22} liftPx={8} /></span></>}
            right={<p className="font-mono text-[11px] tracking-[0.2em] text-white/40 max-w-[28ch] text-right uppercase">Every stage multiplies your points.<br/>One Final = three Group MDs.</p>}
          />
          <div className="mt-12 relative">
            <div className="hidden sm:block absolute top-[34%] left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-gaffer-gold/30 to-transparent" />
            <div className="grid grid-cols-5 gap-1 sm:gap-3">
              {STAGES.map((s, i) => (
                <div key={s.code} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 80}ms` }}>
                  <StageNode {...s} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SQUAD OF THE WEEK ══════════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-24 sm:py-32">
        <Backdrop src={FOOTBALL_IMAGERY.pitchAerial} opacity={0.12} blur={1} overlay="strong" blend="overlay" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={<>⌘ SQUAD OF THE WEEK</>}
            title={<><LetterWave text="elGoatManager's" glow="gold" charDelay={18} liftPx={6} /><br/><span className="text-white"><LetterWave text="undefeated five." glow="white" charDelay={20} liftPx={6} /></span></>}
            right={<div className="text-right space-y-1"><div className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">Record this week</div><div className="font-display text-3xl text-gaffer-electric tabular-nums">5–0</div><div className="font-mono text-[10px] tracking-[0.2em] text-gaffer-gold/80 uppercase">+0.42 ETH</div></div>}
          />
          <div className="mt-12 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
            <div className="rounded-[calc(2rem-0.375rem)] bg-gradient-to-b from-gaffer-pitch/30 via-gaffer-surface/50 to-gaffer-black hairline inner-glow p-6 sm:p-10 relative overflow-hidden">
              <div className="pointer-events-none absolute inset-8 rounded-2xl border border-gaffer-electric/10" />
              <div className="pointer-events-none absolute left-1/2 top-8 bottom-8 w-px bg-gaffer-electric/10" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-gaffer-electric/10" />
              <div className="relative flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {SQUAD_OF_WEEK.map((id, i) => {
                  const p = pick(id);
                  const rarity = id === "mbappe" ? "ICON" : (id === "van_dijk" || id === "bellingham" || id === "rodri") ? "GOLD" : "SILVER";
                  const isCapt = id === "mbappe";
                  const rot = [-6, 3, -2, 4, -3][i];
                  return (
                    <div key={id} style={{ transform: `rotate(${rot}deg)` }}>
                      <PlayerCard player={p} rarity={rarity as any} size="sm" isCaptain={isCapt} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LIVE LEADERBOARD ══════════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-24 sm:py-32">
        <Backdrop src={FOOTBALL_IMAGERY.goldenHour} opacity={0.2} blur={4} overlay="strong" blend="luminosity" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={<><LiveDot /> LIVE LEADERBOARD</>}
            title={<><LetterWave text="Top dogs" glow="white" charDelay={22} liftPx={8} /><br/><span className="text-gaffer-gold"><LetterWave text="eating well." glow="gold" charDelay={24} liftPx={8} /></span></>}
            right={<Link href="/leaderboard" className="font-mono text-[12px] tracking-[0.2em] uppercase text-white/60 hover:text-gaffer-gold transition-colors hover-word hover-word-gold">Full board →</Link>}
          />
          <div className="mt-12 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
            <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 backdrop-blur-sm hairline inner-glow overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase border-b border-white/5">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Manager</div>
                <div className="col-span-2 text-right">W / L</div>
                <div className="col-span-2 text-right">Win rate</div>
                <div className="col-span-2 text-right">Profit</div>
              </div>
              {LEADERBOARD.map((m, i) => (
                <div key={m.rank} className="reveal grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-5 items-center border-b border-white/5 last:border-b-0 hover-lift hover:bg-white/[0.02]" style={{ ["--stagger-delay" as any]: `${i * 70}ms` }}>
                  <div className="col-span-1 flex items-center gap-2">
                    {m.rank === 1 ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-gold text-gaffer-black animate-hot-edge">
                        <Crown />
                      </span>
                    ) : (
                      <span className="font-display text-2xl text-white/40 tabular-nums">{String(m.rank).padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="col-span-1 sm:col-span-5">
                    <div className={`font-semibold ${m.rank === 1 ? "text-gaffer-gold font-display text-2xl tracking-wide" : "text-white text-base"}`}>
                      <HoverWord glow={m.rank === 1 ? "gold" : "white"}>{m.name}</HoverWord>
                    </div>
                    {m.rank === 1 && (
                      <div className="font-mono text-[10px] tracking-[0.2em] text-gaffer-gold/70 uppercase mt-0.5">Reigning champion</div>
                    )}
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-right font-mono">
                    <span className="text-gaffer-electric tabular-nums">{m.w}</span>
                    <span className="text-white/30 mx-1">/</span>
                    <span className="text-gaffer-red tabular-nums">{m.l}</span>
                  </div>
                  <div className="hidden sm:flex sm:col-span-2 justify-end items-center gap-2">
                    <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-gaffer-electric to-gaffer-gold" style={{ width: `${m.win_rate}%` }} />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-white/80">{m.win_rate}%</span>
                  </div>
                  <div className="col-span-2 sm:col-span-2 text-right font-display text-2xl tabular-nums text-gaffer-electric" style={{ textShadow: "0 0 16px rgba(34, 197, 141,0.25)" }}>
                    {m.profit}
                    <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 ml-1">ETH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA — GAME ON ═══════════════════════════════════ */}
      <section className="relative px-4 sm:px-8 py-32 overflow-hidden">
        <Backdrop src={FOOTBALL_IMAGERY.tunnel} opacity={0.45} blur={2} overlay="hero" blend="luminosity" scale={1.1} />
        <Particles count={20} />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-gaffer-red/15 hairline px-3 py-1 hover-lift" style={{ ["--stagger-delay" as any]: "0ms" }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase">MD4 — kickoff in 14h</span>
          </div>
          <h2 className="reveal mt-8 font-display text-[22vw] sm:text-[18vw] lg:text-[15rem] leading-[0.82] tracking-wide text-white" style={{ ["--stagger-delay" as any]: "120ms" }}>
            <LetterWave text="GAME" glow="white" charDelay={40} liftPx={20} />
            <span className="inline-block ml-4 sm:ml-8 text-gaffer-electric" style={{ textShadow: "0 0 60px rgba(34, 197, 141,0.5)" }}>
              <LetterWave text="ON." glow="electric" charDelay={50} liftPx={20} />
            </span>
          </h2>
          <div className="reveal mt-12 flex flex-wrap items-center justify-center gap-4" style={{ ["--stagger-delay" as any]: "240ms" }}>
            <EnterPitchButton>DRAFT YOUR SQUAD</EnterPitchButton>
          </div>
          <p className="reveal mt-6 font-mono text-[11px] tracking-[0.22em] text-white/40 uppercase" style={{ ["--stagger-delay" as any]: "320ms" }}>
            <HoverWord glow="electric">No fee to mint</HoverWord> · <HoverWord glow="gold">5% protocol fee</HoverWord> · <HoverWord glow="white">95% to winners</HoverWord>
          </p>
        </div>
      </section>

      {/* ═══ SITE-MAP FOOTER — every page connected ═══════════════ */}
      <SiteFooter />
    </main>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function BroadcastTicker() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="fixed top-4 inset-x-4 sm:inset-x-8 z-30">
      <div className="rounded-full p-[1.5px] bg-white/[0.04] hairline-strong overflow-hidden">
        <div className="rounded-full bg-gaffer-black/80 backdrop-blur-md hairline overflow-hidden flex items-stretch">
          <div className="flex items-center gap-2 pl-4 pr-4 py-2 bg-gaffer-red/20 border-r border-white/10 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
            <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-red uppercase font-semibold">Live feed</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-8 py-2 animate-marquee whitespace-nowrap will-change-transform">
              {items.map((it, i) => (
                <span key={i} className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] uppercase shrink-0">
                  <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold tracking-[0.2em] ${
                    it.accent === "gold" ? "bg-gaffer-gold/15 text-gaffer-gold"
                    : it.accent === "electric" ? "bg-gaffer-electric/15 text-gaffer-electric"
                    : it.accent === "red" ? "bg-gaffer-red/15 text-gaffer-red"
                    : "bg-white/10 text-white/70"
                  }`}>{it.label}</span>
                  <span className="text-white/80">{it.value}</span>
                  <span className="text-white/20 ml-4">▰</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HudChip({ position, label, value, tone }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right"; label: string; value: string; tone: "gold" | "electric" | "white" | "red" }) {
  const pos = { "top-left": "top-20 left-4 sm:left-10", "top-right": "top-20 right-4 sm:right-10", "bottom-left": "bottom-8 left-4 sm:left-10", "bottom-right": "bottom-8 right-4 sm:right-10" }[position];
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white", red: "text-gaffer-red" }[tone];
  return (
    <div className={`hidden md:flex absolute ${pos} flex-col gap-1 z-10 cursor-default hover-lift`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1 w-1 rounded-full ${accent.replace("text-", "bg-")} animate-live-dot`} />
        <span className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</span>
      </div>
      <div className={`font-display text-2xl ${accent} tabular-nums animate-scoreboard tracking-wider leading-none`}>{value}</div>
    </div>
  );
}

function Particles({ count = 12 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => ({
    x: (i * 113.7) % 100, y: (i * 79.3) % 100, delay: (i * 0.7) % 5, dur: 6 + (i % 4), i,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 -z-[5] overflow-hidden">
      {items.map((p) => (
        <span key={p.i} className="absolute h-1 w-1 rounded-full bg-gaffer-gold/40" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          animation: `float-bob ${p.dur}s ease-in-out ${p.delay}s infinite`,
          boxShadow: "0 0 6px rgba(212,175,55,0.6)",
        }} />
      ))}
    </div>
  );
}

function VersusStage() {
  return (
    <div className="relative h-[420px] sm:h-[480px]">
      <div className="absolute left-[2%] top-[8%] -rotate-[10deg]">
        <div className="animate-float-slow">
          <div className="relative">
            <PlayerCard player={pick("mbappe")} rarity="ICON" size="md" />
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.22em] text-gaffer-electric whitespace-nowrap">
              <HoverWord glow="electric">YOUR CAPTAIN</HoverWord>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-[2%] top-[16%] rotate-[10deg]">
        <div className="animate-float-slow-delay-2">
          <div className="relative">
            <PlayerCard player={pick("kane")} rarity="GOLD" size="md" />
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.22em] text-white/50 whitespace-nowrap">
              <HoverWord glow="white">THEIR CAPTAIN</HoverWord>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative cursor-default">
          <div className="absolute inset-0 blur-2xl bg-gaffer-gold/30 rounded-full scale-150" />
          <div className="relative font-display text-7xl sm:text-8xl text-gaffer-gold tracking-wider hover-word hover-word-gold" style={{ textShadow: "0 0 30px rgba(212,175,55,0.5)" }}>VS</div>
        </div>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[88%]">
        <div className="rounded-full p-[1.5px] bg-white/[0.04] hairline-strong">
          <div className="rounded-full bg-gaffer-black/80 backdrop-blur hairline px-5 py-3 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-white/40 tracking-[0.18em] text-[10px]">YOU</span>
              <span className="font-display text-3xl text-gaffer-electric tabular-nums animate-scoreboard leading-none">87</span>
            </div>
            <div className="flex items-center gap-2 text-white/30">
              <span className="text-[10px] tracking-[0.18em]">MD4 · LIVE</span>
              <span className="h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl text-white/80 tabular-nums leading-none">64</span>
              <span className="text-white/40 tracking-[0.18em] text-[10px]">THEM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, right }: { eyebrow: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-6">
      <div>
        <div className="reveal inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase hover-lift">{eyebrow}</div>
        <h2 className="reveal mt-5 font-display text-white text-5xl sm:text-7xl leading-[0.88]" style={{ ["--stagger-delay" as any]: "100ms" }}>{title}</h2>
      </div>
      {right && <div className="reveal" style={{ ["--stagger-delay" as any]: "180ms" }}>{right}</div>}
    </div>
  );
}

function WarRoomRow({ challenger, stake, matchday, minsLeft, featured, captain, opp }: { challenger: string; stake: string; matchday: number; minsLeft: number; featured: boolean; captain: string; opp: string }) {
  const hrs = Math.floor(minsLeft / 60);
  const mins = minsLeft % 60;
  return (
    <div className={`group relative rounded-2xl p-[1.5px] hover-lift ${featured ? "bg-gradient-to-r from-gaffer-gold/60 via-white/10 to-gaffer-electric/40" : "bg-white/[0.04] hairline-strong"}`}>
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5 grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-6 items-center">
        <div className="col-span-1 hidden md:flex flex-col items-center">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/40">MD</span>
          <span className="font-display text-3xl text-white leading-none tabular-nums">{matchday}</span>
        </div>
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={`/players/${pick(captain).id}.png`} alt="" className="h-12 w-12 rounded-full object-cover bg-gaffer-pitch ring-1 ring-gaffer-gold/40 transition-transform duration-300 ease-out-strong group-hover:scale-110" style={{ filter: "drop-shadow(0 4px 12px rgba(212,175,55,0.3))" }} draggable={false} />
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] text-gaffer-gold/70 uppercase">Captain</div>
              <div className="font-semibold text-sm text-white truncate max-w-[14ch]">
                <HoverWord glow="gold">{pick(captain).shortName}</HoverWord>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-1 md:col-span-3">
          <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">Challenger</div>
          <div className="font-semibold text-sm text-white truncate"><HoverWord glow="white">{challenger}</HoverWord></div>
          {featured && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gaffer-gold/15 px-2 py-0.5 animate-hot-edge">
              <span className="text-[8px] font-bold tracking-[0.2em] text-gaffer-gold">★ FEATURED</span>
            </div>
          )}
        </div>
        <div className="hidden md:flex col-span-2 items-center justify-center gap-2">
          <span className="font-display text-2xl text-white/30">vs</span>
          <img src={`/players/${pick(opp).id}.png`} alt="" className="h-9 w-9 rounded-full object-cover bg-gaffer-pitch ring-1 ring-white/15 opacity-70 transition-opacity duration-300 group-hover:opacity-100" draggable={false} />
        </div>
        <div className="col-span-1 md:col-span-2 text-right md:text-center">
          <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">Stake</div>
          <div className="font-display text-2xl text-gaffer-gold tabular-nums leading-none mt-0.5">{stake}<span className="font-mono text-[10px] tracking-[0.15em] text-white/40 ml-1">ETH</span></div>
        </div>
        <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">KO IN</span>
            <span className="font-mono text-sm text-white tabular-nums">{hrs}h {String(mins).padStart(2,"0")}m</span>
          </div>
          <Link href="/wars" className="group/btn inline-flex items-center gap-2 rounded-full bg-white/5 hairline px-4 py-2 text-white/85 transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold hover:text-gaffer-black">
            <span className="font-semibold text-xs tracking-wider">ACCEPT</span>
            <Arrow size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ForgedCard({ player, from, to, reason, at }: { player: Player; from: "BRONZE" | "SILVER" | "GOLD" | "ICON"; to: "BRONZE" | "SILVER" | "GOLD" | "ICON"; reason: string; at: string }) {
  const toColor = to === "ICON" ? "#7FE3C0" : to === "GOLD" ? "#F5D26C" : to === "SILVER" ? "#E5E5E5" : "#E0A668";
  return (
    <div className="rounded-2xl p-[1.5px] hover-lift bg-gradient-to-br from-white/15 via-white/5 to-transparent">
      <div className="h-full rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl" style={{ background: `${toColor}33` }} />
        <div className="relative flex items-center gap-3">
          <img src={`/players/${player.id}.png`} alt={player.name} className="h-14 w-14 rounded-full object-cover bg-gaffer-pitch ring-2" style={{ borderColor: toColor, boxShadow: `0 0 16px ${toColor}66` }} draggable={false} />
          <div className="min-w-0">
            <div className="font-display text-lg text-white leading-none truncate"><HoverWord glow={to === "ICON" ? "electric" : "gold"}>{player.shortName}</HoverWord></div>
            <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">{at}</div>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase">
          <span className="text-white/40">{from}</span>
          <Arrow size={10} />
          <span style={{ color: toColor }}>{to}</span>
        </div>
        <div className="relative mt-2 text-[12px] text-white/65 leading-snug">{reason}</div>
      </div>
    </div>
  );
}

function StageNode({ code, mult, note, here }: { code: string; mult: string; note: string; here: boolean }) {
  return (
    <div className="relative group hover-lift">
      <div className={`relative rounded-2xl p-[1.5px] ${here ? "bg-gradient-to-b from-gaffer-electric/70 to-gaffer-electric/0 animate-hot-edge" : "bg-white/[0.04] hairline-strong"}`}>
        <div className={`rounded-[calc(1rem-1.5px)] hairline inner-glow p-3 sm:p-5 text-center ${here ? "bg-gaffer-pitch/40" : "bg-gaffer-surface/60"}`}>
          {here && (<div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gaffer-electric text-gaffer-black px-2 py-0.5 font-mono text-[8px] tracking-[0.2em] font-bold whitespace-nowrap">● YOU ARE HERE</div>)}
          <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{note}</div>
          <div className={`font-display text-2xl sm:text-3xl mt-2 leading-none tracking-wider ${here ? "text-gaffer-electric" : "text-white"}`}>
            <HoverWord glow={here ? "electric" : code === "FINAL" ? "gold" : "white"}>{code}</HoverWord>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className={`font-display text-3xl sm:text-5xl leading-none tabular-nums ${code === "FINAL" ? "text-gaffer-gold" : "text-white/85"}`} style={code === "FINAL" ? { textShadow: "0 0 30px rgba(212,175,55,0.5)" } : undefined}>{mult}</div>
            <div className="font-mono text-[8px] tracking-[0.22em] text-white/30 uppercase mt-1">multiplier</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  const sections = [
    { title: "Play", links: [
      { href: "/squad",       label: "Build your squad",   sub: "Draft your five NFTs" },
      { href: "/wars",        label: "Squad Wars",         sub: "1v1 matchday battles" },
      { href: "/predict",     label: "Prediction markets", sub: "Outrights · matches · novelty" },
    ]},
    { title: "Standings", links: [
      { href: "/leaderboard", label: "Leaderboard",        sub: "Top managers · live" },
      { href: "/profile",     label: "My Gaffer",          sub: "Your squad · stats · trophies" },
      { href: "/feed",        label: "Live feed",          sub: "Every war · every forging" },
    ]},
    { title: "Learn", links: [
      { href: "/rules",       label: "How it works",       sub: "Rules · scoring · stages" },
      { href: "/marketplace", label: "Mint a player",      sub: "Legends · current stars · all NFTs" },
      { href: "/rules",       label: "Scoring + stages",   sub: "Per-position points · 1× → 3×" },
    ]},
  ];
  return (
    <footer className="relative px-6 sm:px-12 lg:px-16 pt-20 pb-12 border-t border-white/5">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <img
              src="/logo.svg"
              alt="GAFFER"
              className="h-20 w-20 rounded-2xl object-cover ring-1 ring-gaffer-gold/30 hover-lift"
              draggable={false}
            />
            <div>
              <div className="font-display text-white text-5xl sm:text-6xl tracking-[0.08em] leading-none">
                <LetterWave text="GAFFER" glow="gold" charDelay={22} liftPx={6} />
              </div>
              <p className="mt-3 max-w-md text-white/45 text-sm">On-chain fantasy football manager for World Cup 2026. Draft real players. Stake ETH. Forge legends.</p>
            </div>
          </div>
          <EnterPitchButton>ENTER THE PITCH</EnterPitchButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-14">
          {sections.map((s) => (
            <div key={s.title}>
              <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/70 uppercase mb-4">{s.title}</div>
              <div className="space-y-3">
                {s.links.map((l) => (
                  <Link key={l.href + l.label} href={l.href} className="block group hover-lift">
                    <div className="font-display text-xl text-white leading-none group-hover:text-gaffer-gold transition-colors duration-200">
                      <HoverWord glow="gold">{l.label}</HoverWord>
                    </div>
                    <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-1">{l.sub}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-white/40">
          <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.22em] uppercase">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
              Testnet live
            </span>
            <span>Base · Base L2</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/40">
            <Link href="/rules" className="hover:text-white transition-colors hover-word hover-word-white">Rules</Link>
            <Link href="/feed" className="hover:text-white transition-colors hover-word hover-word-white">Live feed</Link>
            <Link href="/marketplace" className="hover:text-white transition-colors hover-word hover-word-white">Market</Link>
            <Link href="/profile" className="hover:text-white transition-colors hover-word hover-word-white">My gaffer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Crown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4L3 18z" />
    </svg>
  );
}

function LiveDot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot mr-1" />;
}
