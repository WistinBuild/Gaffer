/**
 * NFT metadata + card-image helpers shared by the public token-metadata routes
 * (/metadata/[id], /players/[id]) and the SVG image routes.
 *
 * Metadata follows the ERC-721 / OpenSea JSON standard so wallets and explorers
 * render cards out of the box. Images are generated as inline SVG (no external
 * art dependency) and served from /api/card-image/*.
 */
import players from "@/data/players.json";

export interface PlayerRow {
  id: string;
  name: string;
  shortName: string;
  nation: string;
  nationCode: string;
  position: string;
  rating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

const BY_ID: Record<string, PlayerRow> = Object.fromEntries(
  (players as PlayerRow[]).map((p) => [p.id, p]),
);

export function getPlayer(id: string): PlayerRow | undefined {
  return BY_ID[id];
}

export const POSITION_NAME = ["GK", "DEF", "MID", "FWD", "FLEX"] as const;
export const RARITY_NAME = ["Bronze", "Silver", "Gold", "Icon"] as const;
export const RARITY_COLOR = ["#CD7F32", "#C0C0C0", "#FFD700", "#8A5CF6"] as const;

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function attr(trait_type: string, value: string | number) {
  return { trait_type, value };
}

// ─── Squad-card metadata (GafferNFT) ─────────────────────────────────────────
export interface SquadCard {
  playerId: string;
  position: number;
  rarity: number;
  tournamentPts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export function buildSquadMetadata(tokenId: string, card: SquadCard) {
  const p = getPlayer(card.playerId);
  const name = p?.name ?? card.playerId;
  const rarity = RARITY_NAME[card.rarity] ?? "Bronze";
  const pos = POSITION_NAME[card.position] ?? "FLEX";
  return {
    name: `${name} — ${rarity} #${tokenId}`,
    description:
      `Gaffer squad card. ${name} (${pos}) has earned ${card.tournamentPts} ` +
      `tournament points across Squad Wars. Cards forge to higher rarity as they win. Soulbound.`,
    image: `${siteUrl()}/api/card-image/squad/${tokenId}`,
    external_url: `${siteUrl()}/card/${tokenId}`,
    attributes: [
      attr("Player", name),
      attr("Position", pos),
      attr("Rarity", rarity),
      attr("Tournament Points", card.tournamentPts),
      attr("Goals", card.goals),
      attr("Assists", card.assists),
      attr("Clean Sheets", card.cleanSheets),
      ...(p ? [attr("Nation", p.nation), attr("Overall", p.rating)] : []),
      attr("Soulbound", "true"),
    ],
  };
}

// ─── Marketplace player metadata (PlayerMint) ────────────────────────────────
export interface PlayerToken {
  playerId: string;
  position: number;
  rating: number;
  isLegend: boolean;
  mintedAt: number;
}

export function buildPlayerMetadata(tokenId: string, info: PlayerToken) {
  const p = getPlayer(info.playerId);
  const name = p?.name ?? info.playerId;
  const pos = POSITION_NAME[info.position] ?? "FLEX";
  return {
    name: `${name}${info.isLegend ? " ⭐ Legend" : ""} #${tokenId}`,
    description:
      `Gaffer player card. ${name} (${pos}, OVR ${info.rating})` +
      `${info.isLegend ? " — a Legend edition." : "."} Collectible minted from the Gaffer marketplace.`,
    image: `${siteUrl()}/api/card-image/player/${tokenId}`,
    external_url: `${siteUrl()}/player/${tokenId}`,
    attributes: [
      attr("Player", name),
      attr("Position", pos),
      attr("Overall", info.rating),
      attr("Legend", info.isLegend ? "true" : "false"),
      ...(p
        ? [
            attr("Nation", p.nation),
            attr("Pace", p.pace),
            attr("Shooting", p.shooting),
            attr("Passing", p.passing),
            attr("Defending", p.defending),
            attr("Physical", p.physical),
          ]
        : []),
    ],
  };
}

// ─── SVG card renderer ───────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string),
  );
}

interface CardArt {
  name: string;
  position: string;
  rating: number;
  accent: string;      // rarity / accent color
  badge: string;       // e.g. "Gold" or "Legend"
  nation?: string;
  stats: Array<{ label: string; value: string | number }>;
}

export function renderCardSVG(a: CardArt): string {
  const rows = a.stats
    .map(
      (s, i) =>
        `<text x="60" y="${430 + i * 46}" class="lbl">${esc(String(s.label))}</text>` +
        `<text x="360" y="${430 + i * 46}" class="val" text-anchor="end">${esc(String(s.value))}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640" viewBox="0 0 420 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#131c30"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${a.accent}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.15"/>
    </linearGradient>
    <style>
      .name{font:700 34px system-ui,Segoe UI,Roboto,sans-serif;fill:#fff}
      .sub{font:500 18px system-ui,sans-serif;fill:#9fb0cc}
      .rate{font:800 72px system-ui,sans-serif;fill:${a.accent}}
      .pos{font:700 20px system-ui,sans-serif;fill:#0b1220}
      .badge{font:700 16px system-ui,sans-serif;fill:#0b1220;letter-spacing:1px}
      .lbl{font:500 22px system-ui,sans-serif;fill:#9fb0cc}
      .val{font:700 22px system-ui,sans-serif;fill:#fff}
      .brand{font:800 20px system-ui,sans-serif;fill:#fff;letter-spacing:3px}
    </style>
  </defs>
  <rect x="0" y="0" width="420" height="640" rx="28" fill="url(#bg)"/>
  <rect x="8" y="8" width="404" height="624" rx="24" fill="none" stroke="${a.accent}" stroke-opacity="0.5" stroke-width="2"/>
  <rect x="36" y="36" width="120" height="34" rx="17" fill="url(#accent)"/>
  <text x="52" y="60" class="badge">${esc(a.badge.toUpperCase())}</text>
  <text x="384" y="60" class="brand" text-anchor="end">GAFFER</text>
  <text x="60" y="150" class="rate">${a.rating}</text>
  <circle cx="320" cy="128" r="34" fill="${a.accent}"/>
  <text x="320" y="136" class="pos" text-anchor="middle">${esc(a.position)}</text>
  <text x="60" y="232" class="name">${esc(a.name)}</text>
  ${a.nation ? `<text x="60" y="266" class="sub">${esc(a.nation)}</text>` : ""}
  <line x1="60" y1="320" x2="360" y2="320" stroke="${a.accent}" stroke-opacity="0.35" stroke-width="2"/>
  ${rows}
</svg>`;
}
