/**
 * Match engine — probabilities, outcomes, cascading state.
 * Correct option = much higher success chance + clean fail = lose possession.
 * Wrong options = lower success + dramatic failConsequence (penalty, concede, etc.)
 */

import type {
  DecisionOption,
  DecisionTemplate,
  DecisionResult,
  DugholePlayer,
  FailConsequence,
  MatchState,
  PlayerMatchState,
  SuccessOutcome,
  Synergy,
} from "@/types/dughole";

export interface DecisionOutcome {
  success: boolean;
  pts: number;
  successType?: SuccessOutcome; // if success
  failType?: FailConsequence; // if fail
  oppPts: number; // points awarded to opponent as a result
  banner: { title: string; subtitle: string; tone: "good" | "neutral" | "bad" };
}

// ─── Probability ─────────────────────────────────────────────────────────────
export function successProbability(
  option: DecisionOption,
  player: PlayerMatchState,
  momentum: number,
  activeSynergyBuff: number,
): number {
  const baseAttr = player.player.attrs[option.primary_attr];
  const attrPct = 20 + ((baseAttr + activeSynergyBuff) / 20) * 65;
  const riskMod = { low: 1.05, medium: 1.0, high: 0.85 }[option.risk];
  const compMod = 0.9 + (player.composure / 20) * 0.2;
  const stamMod = 0.92 + (player.stamina / 100) * 0.16;
  const momMod = 1 + momentum / 100;
  // Correct option gets a meaningful boost — picking right should reward
  const correctBoost = option.correct ? 1.15 : 0.85;

  const raw = attrPct * riskMod * compMod * stamMod * momMod * correctBoost;
  return Math.max(8, Math.min(95, Math.round(raw)));
}

// ─── Resolve outcome ─────────────────────────────────────────────────────────
export function resolveDecision(
  option: DecisionOption,
  probability: number,
  isCaptain: boolean,
): DecisionOutcome {
  const roll = Math.random() * 100;
  const success = roll < probability;
  const captainMult = isCaptain ? 2 : 1;

  if (success) {
    const pts = option.reward_pts * captainMult;
    return {
      success: true,
      pts,
      successType: option.successOutcome,
      oppPts: 0,
      banner: successBanner(option, captainMult),
    };
  }

  // Failure — apply failConsequence
  const consequence = applyConsequence(option.failConsequence);
  return {
    success: false,
    pts: option.fail_pts * captainMult,
    failType: option.failConsequence,
    oppPts: consequence.oppPts,
    banner: consequence.banner,
  };
}

function successBanner(o: DecisionOption, mult: number): DecisionOutcome["banner"] {
  switch (o.successOutcome) {
    case "goal":      return { title: "GOAL!",          subtitle: `${o.label} → in the net`, tone: "good" };
    case "key_pass":  return { title: "KEY PASS",       subtitle: `${o.label} → chance created`, tone: "good" };
    case "tackle_won":return { title: "BALL WON",       subtitle: o.label, tone: "good" };
    case "save":      return { title: "SAVED",          subtitle: o.label, tone: "good" };
    case "build_up":  return { title: "POSSESSION",     subtitle: o.label, tone: "neutral" };
  }
}

function applyConsequence(c: FailConsequence): { oppPts: number; banner: DecisionOutcome["banner"] } {
  switch (c) {
    case "concede_goal":
      return {
        oppPts: 12,
        banner: { title: "GOAL CONCEDED", subtitle: "Defensive lapse punished",     tone: "bad" },
      };
    case "concede_penalty":
      return {
        oppPts: 15,
        banner: { title: "PENALTY!",      subtitle: "Mistimed challenge in the box. They convert.", tone: "bad" },
      };
    case "yellow_card":
      return {
        oppPts: 2,
        banner: { title: "BOOKED",        subtitle: "Player picks up a yellow",     tone: "bad" },
      };
    case "free_kick_opp":
      return {
        oppPts: 4,
        banner: { title: "FREE KICK AGAINST", subtitle: "Foul gives them a dangerous set piece", tone: "bad" },
      };
    case "injury":
      return {
        oppPts: 0,
        banner: { title: "INJURY",        subtitle: "Player goes down — composure hit", tone: "bad" },
      };
    case "lose_possession":
    default:
      return {
        oppPts: 1,
        banner: { title: "TURNED OVER",   subtitle: "Possession lost — they advance", tone: "neutral" },
      };
  }
}

// ─── Apply outcome to state ─────────────────────────────────────────────────
export function applyOutcomeToState(
  state: MatchState,
  template: DecisionTemplate,
  option: DecisionOption,
  player: PlayerMatchState,
  outcome: DecisionOutcome,
): MatchState {
  // Update player state — stamina drain, composure swing
  const composureDelta = outcome.success ? 1 : outcome.failType === "concede_penalty" ? -4 : -2;
  const staminaDrain = option.risk === "high" ? 8 : option.risk === "medium" ? 5 : 3;
  const newDeck = state.deck.map((p) => {
    if (p.player.id !== player.player.id) return p;
    return {
      ...p,
      composure: clamp(p.composure + composureDelta, 1, 20),
      stamina: clamp(p.stamina - staminaDrain, 0, 100),
    };
  });

  // Momentum: big swings on goals + penalties
  let momentumDelta = 0;
  if (outcome.successType === "goal") momentumDelta = 4;
  else if (outcome.successType === "key_pass" || outcome.successType === "tackle_won" || outcome.successType === "save") momentumDelta = 2;
  else if (outcome.failType === "concede_goal") momentumDelta = -4;
  else if (outcome.failType === "concede_penalty") momentumDelta = -5;
  else if (outcome.failType === "free_kick_opp") momentumDelta = -2;
  else if (outcome.failType === "lose_possession") momentumDelta = -1;

  // Score
  const yourScore = state.yourScore + Math.max(0, outcome.pts);
  const oppScore = state.oppScore + outcome.oppPts;

  const log: DecisionResult = {
    decisionId: template.id,
    optionId: option.id,
    player: player.player.id,
    success: outcome.success,
    pointsScored: outcome.pts,
    minute: state.minute,
    momentumDelta,
    composureDelta,
  };

  return {
    ...state,
    yourScore,
    oppScore,
    momentum: clamp(state.momentum + momentumDelta, -10, 10),
    deck: newDeck,
    decisionsTaken: [...state.decisionsTaken, log],
  };
}

// ─── Synergy buff lookup ────────────────────────────────────────────────────
export function synergyBuffFor(
  attr: keyof DugholePlayer["attrs"],
  synergies: Synergy[],
): number {
  return synergies.reduce((sum, s) => sum + (s.buff[attr] ?? 0), 0);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function initPlayerState(p: DugholePlayer): PlayerMatchState {
  return { player: p, composure: p.attrs.composure, stamina: 100, morale: 0 };
}
