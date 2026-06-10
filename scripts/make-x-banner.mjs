import sharp from "sharp";
import fs from "fs";
import path from "path";

const APP = "/workspaces/Gaffer/packages/app/public";
const SRC = path.join(APP, "cosmic-stadium.jpg");
const OUT = path.join(APP, "x-banner.jpg");

const W = 1500, H = 500;

// Inline the logo badge (its own viewBox keeps its gradients isolated).
const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "")
  .trim();

const overlay = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FBEFC0"/>
      <stop offset="45%" stop-color="#E7C75A"/>
      <stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#05070B" stop-opacity="0.55"/>
      <stop offset="38%"  stop-color="#05070B" stop-opacity="0.18"/>
      <stop offset="70%"  stop-color="#05070B" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#05070B" stop-opacity="0.72"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="46%" r="75%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="10" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>

  <!-- legibility scrim + vignette -->
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>

  <!-- center lockup: logo badge + GAFFER wordmark -->
  <g filter="url(#soft)">
    <svg x="372" y="150" width="170" height="170" viewBox="0 0 512 512">${logo}</svg>
    <text x="560" y="290" font-family="DejaVu Sans, sans-serif" font-weight="bold"
          font-size="150" letter-spacing="10" fill="url(#goldText)"
          stroke="#3A2D08" stroke-width="1.2">GAFFER</text>
  </g>

  <!-- tagline -->
  <text x="${W/2}" y="372" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="27" letter-spacing="7" fill="#7FE3C0">ON-CHAIN FANTASY FOOTBALL · WORLD CUP 2026</text>

  <!-- sub-line / bio -->
  <text x="${W/2}" y="412" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-size="22" letter-spacing="2"
        fill="#FFFFFF" fill-opacity="0.85">Draft real players as NFTs · Stake USDC · Outscore rivals · Forge Bronze to Icon</text>

  <!-- url chip bottom-right -->
  <text x="${W-44}" y="463" text-anchor="end" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="24" letter-spacing="3" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.55">  ·  @gaffer_game</tspan></text>
</svg>`;

const bg = await sharp(SRC)
  .resize(W, H, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.92, saturation: 1.12 })
  .toBuffer();

await sharp(bg)
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(OUT);

const { size } = fs.statSync(OUT);
const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(size/1024).toFixed(0)}KB`);
