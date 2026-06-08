/**
 * Helpers for the user's owned roster — the union of:
 *   • Starter-pack players (free, presentational, stored in localStorage)
 *   • On-chain PlayerMint NFTs (read via wagmi)
 *
 * Plus the local "manager points" wallet and per-player upgrade overrides
 * users buy with those points.
 */
import { Player } from "@/types";

const STARTER_KEY    = "gaffer_starter_";    // + addressLower → JSON {ids:string[]}
const POINTS_KEY     = "gaffer_points_";     // + addressLower → "<number>"
const POINTS_BASE_KEY = "gaffer_points_base_"; // + addressLower → base wins/losses snapshot
const UPGRADES_KEY   = "gaffer_upgrades_";   // + addressLower → JSON {[playerId]: levels}

export type Rarity = "BRONZE" | "SILVER" | "GOLD" | "ICON";

// ─── Starter pack ─────────────────────────────────────────────────────────────

export function getStarterIds(addressLower: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STARTER_KEY + addressLower);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.ids) ? parsed.ids : [];
  } catch {
    return [];
  }
}

export function setStarterIds(addressLower: string, ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STARTER_KEY + addressLower, JSON.stringify({ ids, at: Date.now() }));
}

/**
 * Pick 5 low-tier players (rating ≤ 79) at full random — no positional priority,
 * just a shuffled slice. We still enforce a valid formation (1 GK, 4 outfield)
 * because the on-chain mint validates it.
 */
export function pickRandomStarterFive(pool: Player[]): { player: Player; rarity: Rarity }[] {
  const lowTier = pool.filter((p) => p.rating >= 65 && p.rating <= 79);
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  const gk = shuffle(lowTier.filter((p) => p.position === "GK"))[0];
  const outfield = shuffle(lowTier.filter((p) => p.position !== "GK")).slice(0, 4);
  const picked = gk ? [gk, ...outfield] : shuffle(lowTier).slice(0, 5);

  return picked.map((p) => ({
    player: p,
    rarity: p.rating >= 75 ? "SILVER" : "BRONZE",
  }));
}

// ─── Manager points wallet ────────────────────────────────────────────────────

const POINTS_PER_WIN  = 50;
const POINTS_PER_DRAW = 15;
const POINTS_PER_LOSS = 5;
const SEED_POINTS     = 25; // small grant on connect so upgrades aren't gated to first-win

export function readPoints(addressLower: string): number {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(POINTS_KEY + addressLower) ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function writePoints(addressLower: string, n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POINTS_KEY + addressLower, String(Math.max(0, Math.round(n))));
}

/**
 * Sync points balance from on-chain wins/losses. Only awards points for matches
 * the user hasn't been credited for yet (using a local snapshot).
 */
export function syncPointsFromRecord(
  addressLower: string,
  wins: number,
  losses: number,
) {
  if (typeof window === "undefined") return readPoints(addressLower);
  const baseRaw = localStorage.getItem(POINTS_BASE_KEY + addressLower);
  const base = baseRaw ? JSON.parse(baseRaw) : { wins: 0, losses: 0, seeded: false };
  const newWins   = Math.max(0, wins   - base.wins);
  const newLosses = Math.max(0, losses - base.losses);
  let pts = readPoints(addressLower);
  if (!base.seeded) {
    pts += SEED_POINTS;
  }
  pts += newWins * POINTS_PER_WIN + newLosses * POINTS_PER_LOSS;
  writePoints(addressLower, pts);
  localStorage.setItem(POINTS_BASE_KEY + addressLower, JSON.stringify({ wins, losses, seeded: true }));
  return pts;
}

// ─── Per-player upgrades ──────────────────────────────────────────────────────
// Each upgrade level costs UPGRADE_COST points and adds +1 to the effective rating.
// We store the level count per playerId.
export const UPGRADE_COST  = 25;
export const MAX_UPGRADES  = 10;
export const RATING_PER_LV = 1;

export function readUpgrades(addressLower: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(UPGRADES_KEY + addressLower) ?? "{}");
  } catch {
    return {};
  }
}

export function writeUpgrades(addressLower: string, u: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(UPGRADES_KEY + addressLower, JSON.stringify(u));
}

export function upgradePlayer(
  addressLower: string,
  playerId: string,
): { ok: boolean; reason?: string; points?: number; level?: number } {
  const upgrades = readUpgrades(addressLower);
  const cur = upgrades[playerId] ?? 0;
  if (cur >= MAX_UPGRADES) return { ok: false, reason: "Max level" };
  const pts = readPoints(addressLower);
  if (pts < UPGRADE_COST) return { ok: false, reason: "Not enough points" };
  upgrades[playerId] = cur + 1;
  writeUpgrades(addressLower, upgrades);
  writePoints(addressLower, pts - UPGRADE_COST);
  return { ok: true, points: pts - UPGRADE_COST, level: cur + 1 };
}

/**
 * Compute the effective rating for a player given local upgrades.
 */
export function effectiveRating(player: Player, upgrades: Record<string, number>): number {
  const lv = upgrades[player.id] ?? 0;
  return Math.min(99, player.rating + lv * RATING_PER_LV);
}
