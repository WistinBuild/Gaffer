import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: BEBAS } = loadBebas("normal", {
  weights: ["400"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const { fontFamily: MONO } = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const FPS = 30;
export const INTRO_DURATION = 700; // ~23.3s

// ─── Brand ────────────────────────────────────────────────────────────────
const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F6E29A";
const GOLD_DEEP = "#A87E22";
const ELECTRIC = "#22C58D";
const MINT = "#7FE3C0";
const INK = "#05070B";

const goldText: React.CSSProperties = {
  backgroundImage: `linear-gradient(160deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DEEP} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const useSpring = (delay = 0, config?: Parameters<typeof spring>[0]["config"]) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: config ?? { damping: 16, mass: 0.7 } });
};

// ─── Continuous background (slow Ken-Burns zoom + scrim) ─────────────────────
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, INTRO_DURATION], [1.06, 1.22]);
  const drift = interpolate(frame, [0, INTRO_DURATION], [-12, 12]);
  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <Img
        src={staticFile("cosmic-stadium.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${drift}px)`,
        }}
      />
      {/* scrim for legibility */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,11,0.55) 0%, rgba(5,7,11,0.12) 35%, rgba(5,7,11,0.35) 70%, rgba(5,7,11,0.85) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Scene 1 — Logo reveal ───────────────────────────────────────────────────
const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpring(0, { damping: 14, mass: 0.8 });
  const wordIn = useSpring(12);
  const subIn = useSpring(26);
  const logoScale = interpolate(pop, [0, 1], [0.4, 1]);
  const logoRot = interpolate(pop, [0, 1], [-18, 0]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <Img
          src={staticFile("logo.svg")}
          style={{
            width: 200,
            height: 200,
            opacity: pop,
            transform: `scale(${logoScale}) rotate(${logoRot}deg)`,
            filter: "drop-shadow(0 24px 60px rgba(212,175,55,0.45))",
          }}
        />
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              fontFamily: BEBAS,
              fontSize: 240,
              lineHeight: 0.9,
              letterSpacing: 8,
              ...goldText,
              transform: `translateY(${interpolate(wordIn, [0, 1], [180, 0])}px)`,
              opacity: wordIn,
            }}
          >
            GAFFER
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: 16,
          color: MINT,
          opacity: subIn,
          transform: `translateY(${interpolate(subIn, [0, 1], [24, 0])}px)`,
        }}
      >
        ON-CHAIN FANTASY FOOTBALL
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2 — Hook ──────────────────────────────────────────────────────────
const SceneHook: React.FC = () => {
  const big = useSpring(2, { damping: 18, mass: 0.9 });
  const sub = useSpring(16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: BEBAS,
          fontSize: 300,
          lineHeight: 0.86,
          letterSpacing: 6,
          textAlign: "center",
          color: "#fff",
          opacity: big,
          transform: `scale(${interpolate(big, [0, 1], [0.8, 1])})`,
          textShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        WORLD CUP <span style={goldText}>2026</span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: 14,
          color: MINT,
          opacity: sub,
        }}
      >
        LIVE ON BASE · PLAY IN USDC
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3 — Feature beats ────────────────────────────────────────────────
const Beat: React.FC<{ kicker: string; title: string; body: string }> = ({
  kicker,
  title,
  body,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inAnim = useSpring(0, { damping: 18 });
  const out = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slide = interpolate(inAnim, [0, 1], [70, 0]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "flex-start",
        justifyContent: "center",
        paddingLeft: 180,
        opacity: Math.min(inAnim, out),
      }}
    >
      <div style={{ transform: `translateX(${slide}px)` }}>
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 12,
            color: ELECTRIC,
            marginBottom: 14,
          }}
        >
          ◇ {kicker}
        </div>
        <div
          style={{
            fontFamily: BEBAS,
            fontSize: 170,
            lineHeight: 0.9,
            letterSpacing: 4,
            ...goldText,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 36,
            letterSpacing: 1,
            color: "rgba(255,255,255,0.85)",
            marginTop: 18,
            maxWidth: 1150,
          }}
        >
          {body}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneFeatures: React.FC = () => {
  const beats = [
    {
      kicker: "DRAFT",
      title: "REAL PLAYERS, REAL NFTs",
      body: "Mint World Cup icons as ERC-721 cards. Build your five.",
    },
    {
      kicker: "STAKE & BATTLE",
      title: "OUTSCORE YOUR RIVAL",
      body: "Wager USDC head-to-head on matchday. Winner takes 95% of the pot.",
    },
    {
      kicker: "FORGE",
      title: "BRONZE TO ICON",
      body: "Cards permanently level up as your players earn tournament points.",
    },
  ];
  return (
    <>
      {beats.map((b, i) => (
        <Sequence key={i} from={i * 90} durationInFrames={90}>
          <Beat {...b} />
        </Sequence>
      ))}
    </>
  );
};

// ─── Scene 4 — Card showcase ─────────────────────────────────────────────────
const PlayerCard: React.FC<{
  file: string;
  name: string;
  rating: number;
  price: string;
  index: number;
}> = ({ file, name, rating, price, index }) => {
  const enter = useSpring(index * 6, { damping: 15, mass: 0.8 });
  const y = interpolate(enter, [0, 1], [120, 0]);
  const rot = interpolate(index, [0, 4], [-8, 8]);
  return (
    <div
      style={{
        width: 280,
        height: 392,
        borderRadius: 26,
        padding: 3,
        background: `linear-gradient(160deg, ${MINT}, rgba(127,227,192,0.15), transparent)`,
        opacity: enter,
        transform: `translateY(${y}px) rotate(${rot}deg)`,
        boxShadow: "0 40px 80px -30px rgba(0,0,0,0.8)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 23,
          overflow: "hidden",
          background: "linear-gradient(180deg, #0f3d2e, #06140f)",
        }}
      >
        <Img
          src={staticFile(`players/${file}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 55%, rgba(3,12,9,0.92) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 18,
            fontFamily: BEBAS,
            fontSize: 64,
            lineHeight: 0.8,
            color: "#fff",
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {rating}
        </div>
        <div style={{ position: "absolute", bottom: 18, left: 18, right: 18 }}>
          <div style={{ fontFamily: BEBAS, fontSize: 40, letterSpacing: 2, color: "#fff" }}>
            {name}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: 1,
              ...goldText,
            }}
          >
            {price} USDC
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneCards: React.FC = () => {
  const head = useSpring(0, { damping: 18 });
  const cards = [
    { file: "pele", name: "PELÉ", rating: 98, price: "1.00" },
    { file: "maradona", name: "MARADONA", rating: 97, price: "0.78" },
    { file: "zidane", name: "ZIDANE", rating: 96, price: "0.84" },
    { file: "cruyff", name: "CRUYFF", rating: 96, price: "0.89" },
    { file: "ronaldinho", name: "R10", rating: 95, price: "0.86" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div
        style={{
          fontFamily: BEBAS,
          fontSize: 110,
          letterSpacing: 6,
          color: "#fff",
          opacity: head,
          transform: `translateY(${interpolate(head, [0, 1], [-40, 0])}px)`,
          marginBottom: 36,
        }}
      >
        MINT THE <span style={goldText}>GREATS</span>
      </div>
      <div style={{ display: "flex", gap: 26 }}>
        {cards.map((c, i) => (
          <PlayerCard key={c.file} {...c} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5 — CTA ───────────────────────────────────────────────────────────
const SceneCTA: React.FC = () => {
  const logoIn = useSpring(0, { damping: 14, mass: 0.8 });
  const urlIn = useSpring(14);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <Img
        src={staticFile("logo.svg")}
        style={{
          width: 150,
          height: 150,
          opacity: logoIn,
          transform: `scale(${interpolate(logoIn, [0, 1], [0.6, 1])})`,
          filter: "drop-shadow(0 20px 50px rgba(212,175,55,0.5))",
        }}
      />
      <div
        style={{
          fontFamily: BEBAS,
          fontSize: 200,
          letterSpacing: 10,
          ...goldText,
          opacity: logoIn,
          marginTop: 8,
        }}
      >
        GAFFER
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 44,
          letterSpacing: 8,
          color: "#fff",
          opacity: urlIn,
          transform: `translateY(${interpolate(urlIn, [0, 1], [24, 0])}px)`,
        }}
      >
        gaffer.games
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 30,
          letterSpacing: 6,
          color: MINT,
          opacity: urlIn,
          marginTop: 16,
        }}
      >
        @gaffer_game · MINT LEGENDS FROM 1 USDC
      </div>
    </AbsoluteFill>
  );
};

// ─── Composition root ────────────────────────────────────────────────────────
export const GafferIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Background />
      {/* subtle scanline texture */}
      <AbsoluteFill
        style={{
          opacity: 0.06,
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "overlay",
        }}
      />
      <Sequence from={0} durationInFrames={120}>
        <SceneLogo />
      </Sequence>
      <Sequence from={118} durationInFrames={100}>
        <SceneHook />
      </Sequence>
      <Sequence from={216} durationInFrames={270}>
        <SceneFeatures />
      </Sequence>
      <Sequence from={486} durationInFrames={120}>
        <SceneCards />
      </Sequence>
      <Sequence from={606} durationInFrames={94}>
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
