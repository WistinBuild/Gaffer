/**
 * Market pricing + rarity for players.
 * Deterministic — same player always yields same price.
 *
 * Formula:
 *   base       = 0.002 USDC (everyone)
 *   rating-prem = ((rating - 70) / 30) ^ 2.4 * 0.18  // exponential curve for top tier
 *   legend×    = 2.6
 *   variance   = ±18% per-id (hash-stable)
 */

import type { Player } from "@/types";

export type Rarity = "BRONZE" | "SILVER" | "GOLD" | "ICON";

export function rarityFor(p: Player): Rarity {
  if (p.legend) return "ICON";
  if (p.rating >= 95) return "ICON";
  if (p.rating >= 88) return "GOLD";
  if (p.rating >= 82) return "SILVER";
  return "BRONZE";
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function priceUSDC(p: Player): number {
  const norm = Math.max(0, Math.min(1, (p.rating - 70) / 30));
  const ratingPremium = Math.pow(norm, 2.4) * 0.18;
  let price = 0.002 + ratingPremium;
  if (p.legend) price *= 2.6;

  // ±18% deterministic variance based on id hash
  const seed = hashSeed(p.id);
  const variance = (((seed * 7) % 37) - 18) / 100;
  price *= 1 + variance;

  return Math.round(price * 1000) / 1000; // 3 decimal precision
}

export function priceLabel(p: Player): string {
  const v = priceUSDC(p);
  if (v >= 0.1) return v.toFixed(2);
  return v.toFixed(3);
}

// Mint-count cap per player. Mirrors the on-chain catalog supplyCap seeded by
// scripts/deploy-playermint.ts — used only as a fallback denominator while the
// real on-chain `catalogOf().maxSupply` is still loading.
export function maxSupply(p: Player): number {
  if (p.legend) return 100;          // legends ultra-scarce
  if (p.rating >= 92) return 500;
  if (p.rating >= 88) return 2000;
  if (p.rating >= 84) return 5000;
  return 10000;
}
