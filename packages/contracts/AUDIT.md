# Gaffer Contracts — Internal Audit

Scope: `Oracle.sol`, `GafferNFT.sol`, `SquadWars.sol`, `PlayerMint.sol` (OpenZeppelin v4.9.6, Solidity 0.8.24).
Method: manual review + an independent reviewer pass, plus an exhaustive test suite (`test/Gaffer.test.ts`, `test/Audit.test.ts` — 44 cases) and a load test (`scripts/stress-test.ts`, 273 txs).

## Fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| F1 | High | **Draw fees stranded.** On a draw, `resolveWar` refunded both sides but left the 5% fee in the contract, which had no withdraw function → permanently locked. | Draw branch now sweeps `totalPot − 2·refund` (fee + dust) to `owner()`. Conservation: the whole pot always leaves the contract. |
| F2 | Critical | **Active wars could lock forever.** An accepted (`Active`) war can only exit via `resolveWar`, which needs the matchday finalized. If the Oracle never finalizes it (bad/typo matchday, lost key), both stakes are stuck — `cancelWar` only handles `Open`. | Added `adminCancelWar(warId)` (owner-only, `nonReentrant`) that refunds both sides (challenger only if still `Open`) and marks the war `Cancelled`. |
| F3 | High | **Squad NFTs transferable, `squad[]` not synced.** A manager could sell squad cards mid-war while they still scored for the seller; ownership and the `squad` mapping diverged. | `GafferNFT` cards are now **soulbound** (`_beforeTokenTransfer` blocks all non-mint transfers). |
| F4 | Medium | **Forge feature was dead.** `GafferNFT.updateStats` (accrues tournament points, upgrades rarity) was `onlySquadWars` but never called — cards never forged. | `resolveWar` now calls `_creditSquad` for both managers, pushing each playing card's matchday stats + points into the NFT, **deduped per (token, matchday)** so multiple wars on one matchday don't double-credit. |
| F5 | Medium | **Oracle validated only one array length.** Mismatched stat arrays could revert mid-loop or silently truncate, then irreversibly finalize a corrupt matchday. | `postMatchdayResults` now requires all six stat arrays equal `playerIds.length`. |
| F6 | Medium | **`getLeaderboard` was O(n²)** over all managers regardless of `limit` → unbounded gas. | Replaced with partial selection — only `limit` passes (O(total·limit)). |

All fixes are covered by tests in `test/Audit.test.ts`.

## Known / accepted (design decisions — not changed)

These are documented tradeoffs; changing them alters game design or needs product input.

- **A1 — Permissionless `resolveWar` + optional `lockDecision` (Medium).** Anyone can resolve once finalized; a manager who never locks resolves with default captain=slot0/bench=slot4. Consider requiring both sides to lock, or a grace period.
- **A2 — Accept-time fairness (Medium).** `acceptWar` only checks the matchday isn't *finalized*, not that it hasn't *kicked off*; a late accepter could exploit partial info. Needs per-matchday kickoff timestamps in the Oracle.
- **A3 — Retroactive stage multiplier (Medium).** `calculatePoints` uses the Oracle's *current* stage, so a matchday's points shift if `advanceStage` runs before resolution. Both sides scale together (winner usually unchanged) but stored `tournamentPts` can inflate. Fix: snapshot the multiplier per matchday at post time.
- **A4 — `_allManagers` / `activeWars` grow unbounded (Low).** No pruning; combined with a very low `MIN_STAKE` this enables state-growth spam. Consider a higher floor and/or pruning.
- **A5 — Catalog mutable after mint (Low/Info).** `PlayerMint` owner can change price/supply/rating after tokens exist, desyncing minted `TokenInfo`. Trusted-owner risk; consider freezing entries after first mint.

## Not issues (verified)

- `Ownable()` no-arg constructors and `security/ReentrancyGuard` import paths are correct for OZ v4.9.6.
- Winner payout math is exact (`fee = pot/20`, `winnerPot = pot − fee`); no dust stranded.
- All state-changing fund flows use `nonReentrant` + SafeERC20.
