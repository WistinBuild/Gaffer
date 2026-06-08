/**
 * Player face images — served locally from /public/players/{id}.png
 *
 * Originally sourced from SoFIFA's FIFA UT card CDN, downloaded once via
 * `scripts/download-player-images.sh`. No network dependency at runtime.
 * If a card refers to an id without an image, PlayerCard falls back to a
 * rarity-tinted silhouette.
 */

// Hard-listed so we know at build time exactly which faces ship.
const AVAILABLE_FACES = new Set<string>([
  // Forwards
  "mbappe",
  "vinicius",
  "haaland",
  "salah",
  "son",
  "kane",
  "lautaro",
  "rodrygo",
  "griezmann",
  "nkunku",
  "alvarez",
  "osimhen",
  // Midfielders
  "bellingham",
  "rodri",
  "modric",
  "casemiro",
  "de_bruyne",
  "foden",
  "saka",
  "declan_rice",
  "bruno_guimaraes",
  "musiala",
  "pedri",
  "gavi",
  "valverde",
  "vitinha",
  "tchouameni",
  "paqueta",
  "bruno_fernandes",
  // Defenders
  "van_dijk",
  "marquinhos",
  "militao",
  "ruben_dias",
  "rudiger",
  "kounde",
  "hakimi",
  "walker",
  "reece_james",
  "theo_hernandez",
  "cancelo",
  "carvajal",
  "balde",
  "lisandro",
  "mazraoui",
  // Goalkeepers
  "alisson",
  "ederson",
  "maignan",
  "courtois",
  "neuer",
  "pickford",
  "unai_simon",
  "diogo_costa",
  // ─── World Cup legends (Wikipedia photos, JPEG→PNG converted) ────────────
  "pele",
  "maradona",
  "cruyff",
  "zidane",
  "r9",
  "ronaldinho",
  "beckenbauer",
  "george_best",
  // ─── Extra modern players added later (have /players/ files) ──────────────
  "kovacic",
  "camavinga",
  "frenkie",
  "xavi_simons",
  "enzo",
  "mac_allister",
  "wirtz",
  "raphinha",
  "gakpo",
  "dembele",
  "thuram",
  "leao",
  "joao_felix",
  "ronaldo",
  "yamal",
  "ferran_torres",
  "julian_alvarez",
  "sane",
]);

export function getPlayerImage(id: string): string | undefined {
  return AVAILABLE_FACES.has(id) ? `/players/${id}.png` : undefined;
}

// Back-compat export — same data as a record for any consumer that wants it
export const PLAYER_IMAGES: Record<string, string> = Object.fromEntries(
  Array.from(AVAILABLE_FACES).map((id) => [id, `/players/${id}.png`])
);
