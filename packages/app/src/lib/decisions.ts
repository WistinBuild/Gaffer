/**
 * Decision moment library — the heart of the match engine.
 * Each decision has ONE correct option (the optimal call).
 * Wrong options have explicit, dramatic consequences when they fail.
 */

import type { DecisionTemplate } from "@/types/dughole";

export const DECISION_LIBRARY: DecisionTemplate[] = [
  // ─── ATTACKING ──────────────────────────────────────────────────────────
  {
    id: "through_ball",
    category: "attacking",
    minute_range: [10, 80],
    position_filter: ["MID", "FWD"],
    situation: (p) =>
      `${p.shortName} picks up the ball in the half-space. The striker has peeled off the last defender — a through ball is on.`,
    options: [
      // CORRECT — vision + timing
      { id: "tb_yes",   label: "Slide the through ball",  primary_attr: "vision",     risk: "medium", correct: true,  successOutcome: "key_pass",     failConsequence: "lose_possession", reward_pts: 14, fail_pts: -1 },
      // SAFE BUT WASTED — passes up a real chance
      { id: "tb_safe",  label: "Recycle to the back",     primary_attr: "passing",    risk: "low",    correct: false, successOutcome: "build_up",     failConsequence: "lose_possession", reward_pts: 4,  fail_pts: 0  },
      // RECKLESS — caught in possession, opp counter
      { id: "tb_carry", label: "Carry into the channel",  primary_attr: "dribbling",  risk: "high",   correct: false, successOutcome: "key_pass",     failConsequence: "concede_goal",    reward_pts: 10, fail_pts: -5 },
    ],
  },
  {
    id: "shot_selection",
    category: "attacking",
    minute_range: [15, 89],
    position_filter: ["FWD", "MID"],
    situation: (p) =>
      `${p.shortName} cuts in from the right with the keeper off his line. Half-second window before the centre back closes.`,
    options: [
      // CORRECT — composed finish
      { id: "ss_low",   label: "Low across the keeper",        primary_attr: "composure",  risk: "medium", correct: true,  successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 15, fail_pts: -1 },
      // GREEDY — pretty but unlikely
      { id: "ss_curl",  label: "Curl into the top corner",     primary_attr: "finishing",  risk: "high",   correct: false, successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 18, fail_pts: -2 },
      // CHICKENED OUT — wasted moment
      { id: "ss_sq",    label: "Square it to the back post",   primary_attr: "vision",     risk: "low",    correct: false, successOutcome: "key_pass",  failConsequence: "lose_possession", reward_pts: 6,  fail_pts: 0  },
      // SHOWBOAT — easily blocked
      { id: "ss_dink",  label: "Dink it over the keeper",      primary_attr: "first_touch",risk: "high",   correct: false, successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 16, fail_pts: -2 },
    ],
  },
  {
    id: "dribble_choice",
    category: "attacking",
    minute_range: [20, 75],
    position_filter: ["MID", "FWD", "DEF"],
    situation: (p) =>
      `${p.shortName} is 1v1 with the full-back. Touch line behind him, support arriving.`,
    options: [
      // CORRECT — let the support arrive
      { id: "dr_hold",  label: "Hold and wait for overlap",  primary_attr: "decisions",  risk: "low",    correct: true,  successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 7,  fail_pts: 0  },
      // VIABLE — but no clear runner yet
      { id: "dr_cross", label: "Whip an early cross",         primary_attr: "crossing",   risk: "medium", correct: false, successOutcome: "key_pass",  failConsequence: "lose_possession", reward_pts: 10, fail_pts: -1 },
      // FORCED — gets stuck, opp counters
      { id: "dr_skill", label: "Roulette and drive at him",   primary_attr: "dribbling",  risk: "high",   correct: false, successOutcome: "goal",      failConsequence: "concede_goal",    reward_pts: 14, fail_pts: -5 },
    ],
  },
  {
    id: "header_chance",
    category: "attacking",
    minute_range: [25, 85],
    situation: (p) =>
      `Corner swings in. ${p.shortName} times his run, but the centre back is climbing with him.`,
    options: [
      // CORRECT — power header
      { id: "hd_power",  label: "Power header at goal",       primary_attr: "jumping",    risk: "medium", correct: true,  successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 15, fail_pts: -1 },
      // SUBTLE — needs anticipation
      { id: "hd_glance", label: "Glance to the back post",    primary_attr: "anticipation",risk: "high",  correct: false, successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 12, fail_pts: -1 },
      // SAFE BUT POINTLESS
      { id: "hd_layoff", label: "Lay off to a runner",        primary_attr: "first_touch",risk: "low",    correct: false, successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 6,  fail_pts: 0  },
    ],
  },

  // ─── DEFENSIVE ──────────────────────────────────────────────────────────
  {
    id: "defensive_engage",
    category: "defensive",
    minute_range: [5, 89],
    position_filter: ["DEF", "MID"],
    situation: (p) =>
      `Their winger runs at ${p.shortName} on the edge of the box. Cover is 15 yards behind.`,
    options: [
      // CORRECT — don't dive in
      { id: "de_jockey",   label: "Jockey and delay",         primary_attr: "anticipation",risk: "low",    correct: true,  successOutcome: "tackle_won", failConsequence: "lose_possession", reward_pts: 9,  fail_pts: -1 },
      // VIABLE — body him out
      { id: "de_shoulder", label: "Shoulder him into touch",  primary_attr: "strength",   risk: "medium", correct: false, successOutcome: "tackle_won", failConsequence: "free_kick_opp",   reward_pts: 8,  fail_pts: -3 },
      // RECKLESS — mistimed in the box = PENALTY
      { id: "de_tackle",   label: "Step in for the tackle",   primary_attr: "tackling",   risk: "high",   correct: false, successOutcome: "tackle_won", failConsequence: "concede_penalty", reward_pts: 10, fail_pts: -10 },
    ],
  },
  {
    id: "press_trigger",
    category: "defensive",
    minute_range: [15, 70],
    position_filter: ["MID", "FWD"],
    situation: (p) =>
      `Their centre back receives with a heavy first touch. ${p.shortName} is 8 yards away.`,
    options: [
      // CORRECT — trigger the press
      { id: "pt_press",  label: "Trigger the team press",  primary_attr: "aggression", risk: "medium", correct: true,  successOutcome: "tackle_won", failConsequence: "concede_goal",    reward_pts: 13, fail_pts: -4 },
      // SAFE — no damage either way
      { id: "pt_screen", label: "Screen the passing lane", primary_attr: "decisions",  risk: "low",    correct: false, successOutcome: "build_up",   failConsequence: "lose_possession", reward_pts: 5,  fail_pts: 0  },
      // PASSIVE — they reset, gain field position
      { id: "pt_drop",   label: "Drop and stay compact",   primary_attr: "anticipation",risk: "low",    correct: false, successOutcome: "build_up",   failConsequence: "lose_possession", reward_pts: 3,  fail_pts: 0  },
    ],
  },
  {
    id: "goalkeeper_decision",
    category: "defensive",
    minute_range: [10, 89],
    position_filter: ["GK"],
    situation: (p) =>
      `Long ball is whipped in. ${p.shortName} can come or stay. Striker has a yard on the centre back.`,
    options: [
      // CORRECT — punch it clear, kills the danger
      { id: "gk_punch", label: "Punch it clear",        primary_attr: "decisions",  risk: "medium", correct: true,  successOutcome: "save",      failConsequence: "concede_goal",    reward_pts: 9,  fail_pts: -6 },
      // RECKLESS — caught in no man's land
      { id: "gk_claim", label: "Come and claim it",     primary_attr: "jumping",    risk: "high",   correct: false, successOutcome: "save",      failConsequence: "concede_goal",    reward_pts: 12, fail_pts: -8 },
      // PASSIVE — striker has free header
      { id: "gk_stay",  label: "Stay on the line",      primary_attr: "anticipation",risk: "low",    correct: false, successOutcome: "save",      failConsequence: "concede_goal",    reward_pts: 4,  fail_pts: -6 },
    ],
  },

  // ─── TACTICAL ───────────────────────────────────────────────────────────
  {
    id: "tempo_shift",
    category: "tactical",
    minute_range: [30, 80],
    position_filter: ["MID"],
    situation: (p) =>
      `Game is open. ${p.shortName} has the ball in midfield. Both sides leaving spaces.`,
    options: [
      // CORRECT — switch play to exploit
      { id: "ts_quick", label: "Quick switch to the far side",  primary_attr: "vision",     risk: "medium", correct: true,  successOutcome: "key_pass",  failConsequence: "lose_possession", reward_pts: 11, fail_pts: -1 },
      // SAFE — keep possession
      { id: "ts_slow",  label: "Slow it down, keep the ball",   primary_attr: "composure",  risk: "low",    correct: false, successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 6,  fail_pts: 0  },
      // RUSHED — runs into trouble
      { id: "ts_drive", label: "Drive forward, force the issue",primary_attr: "stamina",    risk: "high",   correct: false, successOutcome: "key_pass",  failConsequence: "concede_goal",    reward_pts: 11, fail_pts: -5 },
    ],
  },
  {
    id: "set_piece_delivery",
    category: "set_piece",
    minute_range: [10, 89],
    situation: (p) =>
      `Free kick on the edge of the D. ${p.shortName} stands over it.`,
    options: [
      // CORRECT — direct effort from this distance
      { id: "sp_shoot", label: "Curl it at goal",               primary_attr: "finishing",  risk: "high",   correct: true,  successOutcome: "goal",      failConsequence: "lose_possession", reward_pts: 16, fail_pts: -1 },
      // VIABLE — wider option
      { id: "sp_far",   label: "Whip to the back post",         primary_attr: "crossing",   risk: "medium", correct: false, successOutcome: "key_pass",  failConsequence: "lose_possession", reward_pts: 11, fail_pts: -1 },
      // WASTED MOMENT
      { id: "sp_short", label: "Play it short, work an angle",  primary_attr: "passing",    risk: "low",    correct: false, successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 5,  fail_pts: 0  },
    ],
  },

  // ─── LATE-GAME / SQUAD MGMT ─────────────────────────────────────────────
  {
    id: "closing_out",
    category: "tactical",
    minute_range: [80, 89],
    situation: (p) =>
      `93rd minute. Lead is one. ${p.shortName} wins a throw deep in their half.`,
    options: [
      // CORRECT — bury it in the corner
      { id: "co_corner", label: "Take it to the corner",         primary_attr: "composure",  risk: "low",    correct: true,  successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 10, fail_pts: 0  },
      // VIABLE — physical play
      { id: "co_throw",  label: "Throw it long into the channel",primary_attr: "strength",   risk: "medium", correct: false, successOutcome: "build_up",  failConsequence: "lose_possession", reward_pts: 7,  fail_pts: -1 },
      // CARELESS — they pick up + counter
      { id: "co_quick",  label: "Quick throw, catch them out",   primary_attr: "decisions",  risk: "high",   correct: false, successOutcome: "key_pass",  failConsequence: "concede_goal",    reward_pts: 11, fail_pts: -8 },
    ],
  },
];

// Filter the library to decisions valid for the current state
export function pickDecision(
  taken: Set<string>,
  minute: number,
  deckPositions: string[],
): DecisionTemplate | null {
  const eligible = DECISION_LIBRARY.filter((d) => {
    if (taken.has(d.id)) return false;
    if (minute < d.minute_range[0] || minute > d.minute_range[1]) return false;
    if (
      d.position_filter &&
      !d.position_filter.some((pos) => deckPositions.includes(pos))
    ) {
      return false;
    }
    return true;
  });
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}
