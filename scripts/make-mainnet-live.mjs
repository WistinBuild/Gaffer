import sharp from "sharp";
import fs from "fs";
import path from "path";

// "We're live on Base mainnet" announcement — a FRESH, fully-generated look
// (no reused stadium photo): celebratory Base-blue field, gold light beams,
// confetti and a bold lockup. 1600x900 (16:9), ideal for an X in-stream post.
const APP = "/workspaces/Gaffer/packages/app/public";
const OUT = path.join(APP, "mainnet-live.jpg");
const W = 1600, H = 900;
const CX = W / 2;

const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "").trim();

// ── deterministic confetti (no Math.random — stable output) ───────────────────
const COLORS = ["#E7C75A", "#22C58D", "#3D7BFF", "#FFFFFF", "#F5D26C"];
let confetti = "";
for (let i = 0; i < 64; i++) {
  const x = (i * 197.3) % W;
  const y = ((i * 113.7) % (H * 0.62));
  const c = COLORS[i % COLORS.length];
  const s = 5 + (i % 4) * 3;
  const rot = (i * 47) % 360;
  const op = 0.35 + ((i * 13) % 50) / 100;
  if (i % 3 === 0) {
    confetti += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(s/2).toFixed(1)}" fill="${c}" opacity="${op.toFixed(2)}"/>`;
  } else {
    confetti += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${s}" height="${(s*0.55).toFixed(1)}" rx="1.5" fill="${c}" opacity="${op.toFixed(2)}" transform="rotate(${rot} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }
}

// ── radiating light beams behind the lockup ───────────────────────────────────
let beams = "";
const BEAM_CY = 388;
for (let i = 0; i < 12; i++) {
  const ang = (i * 30 + 8) * Math.PI / 180;
  const len = 1300;
  const x2 = CX + Math.cos(ang) * len;
  const y2 = BEAM_CY + Math.sin(ang) * len;
  beams += `<polygon points="${CX},${BEAM_CY} ${(x2-26).toFixed(0)},${y2.toFixed(0)} ${(x2+26).toFixed(0)},${y2.toFixed(0)}" fill="url(#beam)" opacity="${i % 2 ? 0.10 : 0.16}"/>`;
}

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#0A1B3D"/>
      <stop offset="42%" stop-color="#0A1226"/>
      <stop offset="100%" stop-color="#05070B"/>
    </linearGradient>
    <radialGradient id="blueGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1E5BFF" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#0A1B3D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldGlow" cx="50%" cy="43%" r="34%">
      <stop offset="0%" stop-color="#E7C75A" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#E7C75A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E7C75A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#E7C75A" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="45%" stop-color="#E7C75A"/><stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="46%" r="80%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="12" flood-color="#000" flood-opacity="0.9"/>
    </filter>
  </defs>

  <!-- base field -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g>${beams}</g>
  <rect width="${W}" height="${H}" fill="url(#blueGlow)"/>
  <rect width="${W}" height="${H}" fill="url(#goldGlow)"/>

  <!-- confetti -->
  <g>${confetti}</g>

  <!-- subtle pitch baseline -->
  <g opacity="0.5" stroke="#5C7CC0" stroke-opacity="0.18" fill="none" stroke-width="2">
    <line x1="0" y1="724" x2="${W}" y2="724"/>
    <circle cx="${CX}" cy="724" r="78"/>
    <line x1="${CX}" y1="646" x2="${CX}" y2="802"/>
  </g>

  <rect width="${W}" height="${H}" fill="url(#vig)"/>

  <!-- live pill -->
  <g filter="url(#soft)">
    <rect x="${CX-235}" y="120" width="470" height="58" rx="29" fill="#05070B" fill-opacity="0.6" stroke="#3D7BFF" stroke-opacity="0.7"/>
    <circle cx="${CX-198}" cy="149" r="8" fill="#22C58D"/>
    <text x="${CX-168}" y="158" text-anchor="start" font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="23" letter-spacing="5" fill="#9FC0FF">LIVE ON BASE MAINNET</text>
  </g>

  <!-- logo + wordmark -->
  <g filter="url(#soft)">
    <svg x="${CX-372}" y="248" width="172" height="172" viewBox="0 0 512 512">${logo}</svg>
    <text x="${CX-178}" y="396" font-family="DejaVu Sans, sans-serif" font-weight="bold"
          font-size="172" letter-spacing="10" fill="url(#goldText)" stroke="#3A2D08" stroke-width="1.2">GAFFER</text>
  </g>

  <!-- headline -->
  <text x="${CX}" y="552" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-weight="bold"
        font-size="66" letter-spacing="2" fill="#FFFFFF">WE'RE LIVE ON MAINNET</text>

  <!-- $GAFFER token row -->
  <g filter="url(#soft)">
    <rect x="${CX-330}" y="600" width="660" height="58" rx="29" fill="#05070B" fill-opacity="0.55" stroke="#E7C75A" stroke-opacity="0.5"/>
    <text x="${CX-300}" y="637" text-anchor="start"
          font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="24" letter-spacing="3" fill="#E7C75A">$GAFFER</text>
    <text x="${CX-150}" y="637" text-anchor="start"
          font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="21" letter-spacing="1" fill="#FFFFFF" fill-opacity="0.92">IS LIVE</text>
  </g>

  <!-- tagline -->
  <text x="${CX}" y="712" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-size="24" letter-spacing="1"
        fill="#FFFFFF" fill-opacity="0.82">On-chain fantasy football · Draft players as NFTs · Stake USDC · Win the pot</text>

  <!-- url -->
  <text x="${CX}" y="812" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="31" letter-spacing="4" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.5">  ·  @gaffer_game</tspan></text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
