import sharp from "sharp";
import fs from "fs";
import path from "path";

const APP = "/workspaces/Gaffer/packages/app/public";
const SRC = path.join(APP, "cosmic-stadium.jpg");
const OUT = path.join(APP, "og.jpg");

const W = 1200, H = 630;

const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "").trim();

const overlay = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="45%" stop-color="#E7C75A"/><stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05070B" stop-opacity="0.55"/>
      <stop offset="42%" stop-color="#05070B" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#05070B" stop-opacity="0.86"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="44%" r="78%">
      <stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.6"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="11" flood-color="#000" flood-opacity="0.9"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>

  <!-- live pill -->
  <g filter="url(#soft)">
    <rect x="${W/2-235}" y="86" width="470" height="50" rx="25" fill="#05070B" fill-opacity="0.55" stroke="#22C58D" stroke-opacity="0.6"/>
    <circle cx="${W/2-200}" cy="111" r="7" fill="#22C58D"/>
    <text x="${W/2-172}" y="119" text-anchor="start" font-family="DejaVu Sans Mono, monospace" font-weight="bold"
          font-size="22" letter-spacing="6" fill="#7FE3C0">LIVE ON BASE SEPOLIA</text>
  </g>

  <!-- logo + wordmark -->
  <g filter="url(#soft)">
    <svg x="${W/2-300}" y="190" width="150" height="150" viewBox="0 0 512 512">${logo}</svg>
    <text x="${W/2-128}" y="318" font-family="DejaVu Sans, sans-serif" font-weight="bold"
          font-size="140" letter-spacing="8" fill="url(#goldText)" stroke="#3A2D08" stroke-width="1.1">GAFFER</text>
  </g>

  <!-- tagline -->
  <text x="${W/2}" y="408" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="27" letter-spacing="6" fill="#FFFFFF">ON-CHAIN FANTASY FOOTBALL · WORLD CUP 2026</text>

  <!-- bio line -->
  <text x="${W/2}" y="452" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans, sans-serif" font-size="23" letter-spacing="1"
        fill="#FFFFFF" fill-opacity="0.82">Draft players as NFTs · Stake USDC · Outscore rivals · Forge Bronze → Icon</text>

  <!-- url -->
  <text x="${W/2}" y="556" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="30" letter-spacing="4" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.5">  ·  @gaffer_game</tspan></text>
</svg>`;

const bg = await sharp(SRC)
  .resize(W, H, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.9, saturation: 1.12 })
  .toBuffer();

await sharp(bg)
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
