import sharp from "sharp";
import fs from "fs";
import path from "path";

// Announcement image: "$GAFFER is live · Mainnet migration in progress".
// 1600x900 (16:9) — the ideal single-image ratio for an X in-stream post.
const APP = "/workspaces/Gaffer/packages/app/public";
const SRC = path.join(APP, "cosmic-stadium.jpg");
const OUT = path.join(APP, "mainnet-post.jpg");

const W = 1600, H = 900;

const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "").trim();

const overlay = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="45%" stop-color="#E7C75A"/><stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05070B" stop-opacity="0.58"/>
      <stop offset="40%" stop-color="#05070B" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#05070B" stop-opacity="0.88"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="44%" r="78%">
      <stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="12" flood-color="#000" flood-opacity="0.9"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>

  <!-- token-live pill -->
  <g filter="url(#soft)">
    <rect x="${W/2-210}" y="118" width="420" height="58" rx="29" fill="#05070B" fill-opacity="0.55" stroke="#22C58D" stroke-opacity="0.6"/>
    <circle cx="${W/2-176}" cy="147" r="8" fill="#22C58D"/>
    <text x="${W/2-148}" y="156" text-anchor="start" font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="24" letter-spacing="6" fill="#7FE3C0">$GAFFER · NOW LIVE</text>
  </g>

  <!-- logo + wordmark lockup -->
  <g filter="url(#soft)">
    <svg x="${W/2-380}" y="246" width="170" height="170" viewBox="0 0 512 512">${logo}</svg>
    <text x="${W/2-188}" y="392" font-family="DejaVu Sans, sans-serif" font-weight="bold"
          font-size="168" letter-spacing="10" fill="url(#goldText)" stroke="#3A2D08" stroke-width="1.2">GAFFER</text>
  </g>

  <!-- headline -->
  <text x="${W/2}" y="540" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-weight="bold"
        font-size="62" letter-spacing="3" fill="#FFFFFF">$GAFFER IS LIVE</text>

  <!-- migration line -->
  <g filter="url(#soft)">
    <rect x="${W/2-300}" y="586" width="600" height="56" rx="28" fill="#05070B" fill-opacity="0.5" stroke="#E7C75A" stroke-opacity="0.45"/>
    <text x="${W/2}" y="623" text-anchor="middle"
          font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="26" letter-spacing="5" fill="#E7C75A">MAINNET MIGRATION IN PROGRESS</text>
  </g>

  <!-- tagline -->
  <text x="${W/2}" y="700" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-size="25" letter-spacing="1"
        fill="#FFFFFF" fill-opacity="0.85">On-chain fantasy football · World Cup 2026 · Draft, stake, outscore, forge</text>

  <!-- url -->
  <text x="${W/2}" y="800" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="32" letter-spacing="4" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.5">  ·  @gaffer_game</tspan></text>
</svg>`;

const bg = await sharp(SRC)
  .resize(W, H, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.9, saturation: 1.12 })
  .toBuffer();

await sharp(bg)
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
