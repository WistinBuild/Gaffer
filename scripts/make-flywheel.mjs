import sharp from "sharp";
import fs from "fs";
import path from "path";

// $GAFFER Flywheel — circular value-loop diagram. Fully generated (no photo).
// 1600x900 (16:9) for an X in-stream post.
const APP = "/workspaces/Gaffer/packages/app/public";
const OUT = path.join(APP, "gaffer-flywheel.jpg");
const W = 1600, H = 900;

const logo = fs.readFileSync(path.join(APP, "logo.svg"), "utf8")
  .replace(/^<\?xml.*?\?>/s, "").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CX = 800, CY = 506, R = 272;        // loop centre + node ring radius
const NODE_W = 300, NODE_H = 108;
const HUB_R = 102;                         // centre hub radius
const deg = (d) => (d * Math.PI) / 180;
const P = (a, r = R) => [CX + r * Math.cos(deg(a)), CY + r * Math.sin(deg(a))];

// 4 nodes around the ring (angles: -90 top, 0 right, 90 bottom, 180 left)
const NODES = [
  { a: -90, accent: "#3D7BFF", step: "1", title: "MINT NFTs", sub: "Players mint cards · pay in USDC" },
  { a:   0, accent: "#E7C75A", step: "2", title: "BUYBACK", sub: "USDC buys $GAFFER on-market" },
  { a:  90, accent: "#22C58D", step: "3", title: "REWARDS", sub: "$GAFFER to winners & stakers" },
  { a: 180, accent: "#C9A6FF", step: "4", title: "GROWTH", sub: "More players → more mints" },
];

function node(n) {
  const [cx, cy] = P(n.a);
  const x = cx - NODE_W / 2, y = cy - NODE_H / 2;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="18" fill="#0B1322" fill-opacity="0.95" stroke="${n.accent}" stroke-opacity="0.55" stroke-width="1.6"/>
    <circle cx="${x + 38}" cy="${y + NODE_H / 2}" r="24" fill="${n.accent}" fill-opacity="0.16" stroke="${n.accent}" stroke-opacity="0.7"/>
    <text x="${x + 38}" y="${y + NODE_H / 2 + 9}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="26" fill="${n.accent}">${n.step}</text>
    <text x="${x + 76}" y="${y + 44}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="25" letter-spacing="1" fill="#FFFFFF">${esc(n.title)}</text>
    <text x="${x + 76}" y="${y + 74}" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#FFFFFF" fill-opacity="0.7">${esc(n.sub)}</text>
  </g>`;
}

// clockwise arc arrows between adjacent nodes
function arrow(a1, a2, color) {
  const [x1, y1] = P(a1, R);
  const [x2, y2] = P(a2, R);
  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}"
    fill="none" stroke="${color}" stroke-width="3.5" stroke-opacity="0.85" marker-end="url(#arrow)"/>`;
}

const arrows = [
  arrow(-58, -32, "#7FA0E0"),
  arrow(32, 58, "#E7C75A"),
  arrow(122, 148, "#22C58D"),
  arrow(212, 238, "#C9A6FF"),
].join("");

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#0A1730"/><stop offset="45%" stop-color="#0A1020"/><stop offset="100%" stop-color="#05070B"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="56%" r="45%">
      <stop offset="0%" stop-color="#E7C75A" stop-opacity="0.20"/><stop offset="70%" stop-color="#0A1730" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="45%" stop-color="#E7C75A"/><stop offset="100%" stop-color="#B8901F"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFFFFF" fill-opacity="0.9"/>
    </marker>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="9" flood-color="#000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- header -->
  <g filter="url(#soft)">
    <svg x="${W/2 - 330}" y="58" width="56" height="56" viewBox="0 0 512 512">${logo}</svg>
    <text x="${W/2 - 262}" y="104" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="56"
          letter-spacing="4" fill="url(#goldText)">$GAFFER</text>
    <text x="${W/2 + 62}" y="104" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="56"
          letter-spacing="4" fill="#FFFFFF">FLYWHEEL</text>
  </g>
  <text x="${W/2}" y="158" text-anchor="middle" font-family="DejaVu Sans Mono, monospace"
        font-size="18" letter-spacing="4" fill="#7FA0E0">A SELF-REINFORCING VALUE LOOP · REWARD &amp; IN-GAME TOKEN</text>

  <!-- dashed guide ring -->
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#2A3550" stroke-width="1.5" stroke-dasharray="2 9"/>

  <!-- arrows -->
  ${arrows}

  <!-- centre hub -->
  <circle cx="${CX}" cy="${CY}" r="${HUB_R}" fill="#0B1322" fill-opacity="0.9" stroke="#E7C75A" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="${CX}" cy="${CY}" r="${HUB_R}" fill="url(#glow)"/>
  <text x="${CX}" y="${CY - 8}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="42"
        letter-spacing="1" fill="url(#goldText)">$GAFFER</text>
  <text x="${CX}" y="${CY + 28}" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-weight="bold" font-size="16"
        letter-spacing="3" fill="#FFFFFF" fill-opacity="0.8">FLYWHEEL</text>

  <!-- nodes -->
  ${NODES.map(node).join("")}

  <!-- footer -->
  <text x="${W/2}" y="868" text-anchor="middle" filter="url(#soft)"
        font-family="DejaVu Sans Mono, monospace" font-weight="bold"
        font-size="24" letter-spacing="4" fill="#E7C75A">gaffer.games
    <tspan fill="#FFFFFF" fill-opacity="0.5">  ·  @gaffer_game</tspan></text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT}  ${meta.width}x${meta.height}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
