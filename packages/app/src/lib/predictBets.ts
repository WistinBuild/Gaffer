/**
 * Demo prediction-market bets — fully client-side, localStorage-backed.
 * Real settlement opens at WC kick-off (June 11 2026) once the on-chain
 * PredictMarket contract ships. Until then this is the playground that
 * lets users feel the loop without spending real ETH.
 */

const BANKROLL_KEY = "gaffer_demo_bankroll_"; // + addressLower
const BETS_KEY     = "gaffer_demo_bets_";     // + addressLower

export const STARTING_BANKROLL = 100; // demo ETH

export interface DemoBet {
  id:          string;
  marketId:    string;
  marketName:  string;
  optionLabel: string;
  stake:       number;   // demo ETH
  oddsPct:     number;   // implied probability the option resolves true
  placedAt:    number;
}

function key(prefix: string, addressLower: string) {
  return prefix + (addressLower || "_guest");
}

// ─── Bankroll ────────────────────────────────────────────────────────────────

export function readBankroll(addressLower: string): number {
  if (typeof window === "undefined") return STARTING_BANKROLL;
  const raw = localStorage.getItem(key(BANKROLL_KEY, addressLower));
  if (raw === null) {
    localStorage.setItem(key(BANKROLL_KEY, addressLower), String(STARTING_BANKROLL));
    return STARTING_BANKROLL;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : STARTING_BANKROLL;
}

export function writeBankroll(addressLower: string, n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(BANKROLL_KEY, addressLower), String(Math.max(0, n)));
}

// ─── Bets ────────────────────────────────────────────────────────────────────

export function readBets(addressLower: string): DemoBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(BETS_KEY, addressLower));
    return raw ? (JSON.parse(raw) as DemoBet[]) : [];
  } catch {
    return [];
  }
}

export function writeBets(addressLower: string, bets: DemoBet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(BETS_KEY, addressLower), JSON.stringify(bets));
}

export interface PlaceBetInput {
  marketId:    string;
  marketName:  string;
  optionLabel: string;
  stake:       number;
  oddsPct:     number;
}

export interface PlaceBetResult {
  ok:        boolean;
  reason?:   string;
  bankroll?: number;
  bet?:      DemoBet;
}

export function placeBet(addressLower: string, input: PlaceBetInput): PlaceBetResult {
  if (input.stake <= 0) return { ok: false, reason: "Stake must be > 0" };
  if (input.oddsPct <= 0 || input.oddsPct >= 100) {
    return { ok: false, reason: "Invalid odds" };
  }
  const bankroll = readBankroll(addressLower);
  if (input.stake > bankroll) {
    return { ok: false, reason: "Not enough demo ETH" };
  }
  const bet: DemoBet = {
    id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    marketId:    input.marketId,
    marketName:  input.marketName,
    optionLabel: input.optionLabel,
    stake:       input.stake,
    oddsPct:     input.oddsPct,
    placedAt:    Date.now(),
  };
  const bets = readBets(addressLower);
  bets.unshift(bet);
  writeBets(addressLower, bets);
  const newBankroll = bankroll - input.stake;
  writeBankroll(addressLower, newBankroll);
  return { ok: true, bankroll: newBankroll, bet };
}

export function payoutFor(stake: number, oddsPct: number): number {
  // Fair payout if the option resolves true: stake × (100 / impliedPct)
  return stake * (100 / oddsPct);
}

export function resetBankroll(addressLower: string) {
  if (typeof window === "undefined") return;
  writeBankroll(addressLower, STARTING_BANKROLL);
  writeBets(addressLower, []);
}
