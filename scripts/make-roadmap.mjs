import sharp from "sharp";
import fs from "fs";
import path from "path";

// GAFFER Roadmap — professional 4-phase timeline. Fully generated (no photo).
// 1600x900 (16:9) for an X in-stream post.
const APP = "/workspaces/Gaffer/packages/app/public";
const OUT = path.join(APP, "gaffer-roadmap.jpg");
const W = 1600, H = 900;

const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "").trim();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PHASES = [
  {
    no: "01", status: "LIVE NOW", accent: "#22C58D",
    title: "LAUNCH",
    items: ["Live on Base mainnet", "$GAFFER token launched", "Mint players as NFTs", "Squad Wars · Oracle settles"],
  },
  {
    no: "02", status: "NEXT", accent: "#E7C75A",
    title: "$GAFFER UTILITY",
    items: ["In-game token: mint & stake", "Reward token for wins", "$GAFFER staking & forging", "Holder perks"],
  },
  {
    no: "03", status: "FLYWHEEL", accent: "#3D7BFF",
    title: "BUYBACK ENGINE",
    items: ["NFT mint USDC → buyback", "Refills the rewards pool", "Deflationary by design", "Value loops to players"],
  },
  {
    no: "04", status: "SEASON", accent: "#C9A6FF",
    title: "WORLD CUP 2026",
    items: ["Live WC2026 matchday scoring", "Seasonal leaderboards", "Prize pots & tournaments", "Community governance"],
  },
];

// ── card geometry ──
const CARD_W = 348, GAP = 28, CARD_H = 470, TOP = 286;
const totalW = PHASES.length * CARD_W + (PHASES.length - 1) * GAP;
const startX = (W - totalW) / 2;

function card(p, i) {
  const x = startX + i * (CARD_W + GAP);
  const items = p.items.map((it, j) => `
    <g transform="translate(${x + 30}, ${TOP + 188 + j * 56})">
      <circle cx="6" cy="-5" r="4" fill="${p.accent}"/>
      <text x="22" y="0" font-family="DejaVu Sans, sans-serif" font-size="19" fill="#FFFFFF" fill-opacity="0.88">${esc(it)}</text>
    </g>`).join("");
  return `
  <g>
    <rect x="${x}" y="${TOP}" width="${CARD_W}" height="${CARD_H}" rx="22" fill="#0B1322" fill-opacity="0.72" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="1.5"/>
    <rect x="${x}" y="${TOP}" width="${CARD_W}" height="6" rx="3" fill="${p.accent}"/>
    <!-- phase number -->
    <text x="${x + 30}" y="${TOP + 88}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="64"
          fill="${p.accent}" fill-opacity="0.28">${p.no}</text>
    <!-- status pill -->
    <rect x="${x + CARD_W - 30 - (p.status.length * 12 + 26)}" y="${TOP + 40}" width="${p.status.length * 12 + 26}" height="34" rx="17"
          fill="${p.accent}" fill-opacity="0.16" stroke="${p.accent}" stroke-opacity="0.5"/>
    <text x="${x + CARD_W - 30 - 13}" y="${TOP + 63}" text-anchor="end" font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="14" letter-spacing="2" fill="${p.accent}">${p.status}</text>
    <!-- title -->
    <text x="${x + 30}" y="${TOP + 150}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="30"
          letter-spacing="1" fill="#FFFFFF">${esc(p.title)}</text>
    ${items}
  </g>`;
}

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#0A1730"/><stop offset="45%" stop-color="#0A1020"/><stop offset="100%" stop-color="#05070B"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="6%" r="70%">
      <stop offset="0%" stop-color="#1E5BFF" stop-opacity="0.32"/><stop offset="60%" stop-color="#0A1730" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="45%" stop-color="#E7C75A"/><stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="9" flood-color="#000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- header -->
  <g filter="url(#soft)">
    <svg x="${W/2 - 305}" y="74" width="60" height="60" viewBox="0 0 512 512">${logo}</svg>
    <text x="${W/2 - 232}" y="124" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="62"
          letter-spacing="6" fill="url(#goldText)">GAFFER</text>
    <text x="${W/2 + 92}" y="124" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="62"
          letter-spacing="6" fill="#FFFFFF">ROADMAP</text>
  </g>
  <text x="${W/2}" y="186" text-anchor="middle" font-family="DejaVu Sans Mono, monospace"
        font-size="20" letter-spacing="5" fill="#7FA0E0">ON-CHAIN FANTASY FOOTBALL · BUILT ON BASE</text>

  <!-- connecting timeline line -->
  <line x1="${startX + 20}" y1="${TOP - 26}" x2="${startX + totalW - 20}" y2="${TOP - 26}" stroke="#2A3550" stroke-width="2" stroke-dasharray="2 8"/>

  ${PHASES.map(card).join("")}

  <!-- footer -->
  <text x="${W/2}" y="858" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="26" letter-spacing="4" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.5">  ·  @gaffer_game</tspan></text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
