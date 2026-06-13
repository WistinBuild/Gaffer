# Gaffer — Solana programs (Anchor)

On-chain layer migrating from Base (EVM / Solidity) to **Solana devnet**. This
package holds the Anchor (Rust) ports of the original contracts in
`packages/contracts`.

## Migration status

| Solidity contract | Solana program | Status |
| ----------------- | -------------- | ------ |
| `Oracle.sol`      | `programs/oracle` | ✅ ported, **deployed + initialized on devnet** |
| `GafferNFT.sol`   | `programs/gaffer-nft` | ✅ ported, **deployed + initialized on devnet** |
| `PlayerMint.sol`  | `programs/player-mint` | ✅ ported, **deployed + initialized on devnet** |
| `SquadWars.sol`   | `programs/squad-wars` | ✅ ported, **deployed + initialized on devnet** |

The Oracle is the dependency root (SquadWars reads its scoring), so it is ported
first and serves as the pattern for the rest.

### Design notes for the port

- **NFTs are program-owned PDAs, not Metaplex tokens.** Squad cards
  (`["card", owner, slot]`) and minted players (`["token", token_id]`) are plain
  Anchor accounts. This faithfully ports the game state (soulbound squads, catalog
  scarcity) without pulling Metaplex into the build. Wrapping them as tradeable
  Metaplex NFTs is future work and orthogonal to the game logic.
- **USDC via `anchor-spl`.** `player-mint` and `squad-wars` take SPL-token USDC.
  Stakes/payments escrow into a program vault PDA (`["vault"]`) and pay out signed
  by that PDA.
- **SquadWars scoring trade-off.** Solidity's `resolveWar` recomputed scores
  on-chain from the Oracle + NFT. The port instead accepts scores from the
  authorized `resolver` (the same trusted oracle/bot authority) and keeps the
  money path — escrow, 5% fee, payout, draw refund — fully on-chain. Trustless
  on-chain scoring (reading oracle/nft PDAs per slot) is future work.

## Addresses

| Item | Value |
| ---- | ----- |
| Deployer / authority wallet | `D1EZqSobg2M1itFS24WLaJpWkWFDXQ17p9azLMdw44d6` |
| Oracle program ID | `3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb` |
| OracleState PDA (`["oracle"]`) | `3Uk8BCtKtk6TTkQKkJYG6531G7UhLXzLH3AjWXrvbTuZ` |
| GafferNFT program ID | `Fhk54QhcVjY7phpxzF7HCPa6STsYD1FN8Jfwk2irdkGf` |
| NftConfig PDA (`["config"]`) | `GuEy32ZotTzNLLhsHQCVLwry9HLwe7AnV65TyXtnxTrU` |
| PlayerMint program ID | `D9xiskVonYcZs3zMnjeKS9HY27s2fcBxTD3Jw5op2XoY` |
| PlayerMint MintConfig / vault | `3WzWugwfCQNPkmfzyc1jt2NEpVahoosY5EBqLQ1ckfL1` / `FC2ykxzW1JMs8mHSvvHuqej9scrcH3duDx1DrUAtPW3M` |
| SquadWars program ID | `25MeET8DMNgM8VCJTXxDQVPAaJsp5HezyhypofbYdaqh` |
| SquadWars WarsConfig / vault | `AhimqNPXD4fkUEW8r5CUDrt1dvhMu4DRjPvnirPWZj2b` / `JDNbRNEhfVmCAybS7hCAuyq35rmhssGkXdN9dtq5UGZx` |
| USDC mint (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (Circle) |
| Cluster | devnet |

All four programs deployed + initialized on devnet 2026-06-13. PlayerMint and
SquadWars escrow USDC into their vault PDAs; SquadWars' config points at the
Oracle + GafferNFT program IDs and uses the deployer as owner/resolver.

Deployed + initialized 2026-06-13:
- deploy tx `T2oefe5sv6mdC4EBf2CbBotsLtMmLk1CSnPRshwKQopS1aSoBD91Ccyx6iY6qh6k7wdoK4oGPFpNuVdpYF7eETp`
- initialize tx `5TvL7qb7cHmfd7ks3jKmYecBFNcMbufApJV3wTGfgaZRAn7acGnn1NMmU287odeGez71pyWjTsLEn25y1mBU5dG7`
- OracleState verified: owner = deployer, stage = Group(0), matchday = 1, multipliers = [100,120,150,200,300]
- Explorer: <https://explorer.solana.com/address/3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb?cluster=devnet>

The Oracle **program ID** is fixed by `oracle-program-keypair.json` (git-ignored;
keep it backed up — it is the upgrade authority). It is declared in `Anchor.toml`
and `declare_id!()` so the address is stable across rebuilds.

## Fund the wallet (required before deploy)

The deployer wallet must hold a few SOL to deploy. Devnet RPC airdrops are
heavily rate-limited, so fund manually:

- Faucet: <https://faucet.solana.com/> → paste the deployer address, pick **Devnet**
- Or CLI: `solana airdrop 2 D1EZqSobg2M1itFS24WLaJpWkWFDXQ17p9azLMdw44d6 --url devnet`

Check balance: `solana balance -k ../../.solana/devnet-keypair.json --url devnet`

## Build & deploy

```bash
# from packages/programs
cargo-build-sbf                 # builds target/deploy/oracle.so
bash scripts/deploy-devnet.sh   # checks balance, builds, deploys oracle
node scripts/init-oracle.mjs    # one-time: create + seed the OracleState PDA
```

`deploy-devnet.sh` aborts with the faucet link if the wallet is empty.
`init-oracle.mjs` is safe to re-run — it no-ops if OracleState already exists.

## Oracle program — instructions

- `initialize` — seed stage multipliers `[100,120,150,200,300]`, stage = Group,
  matchday = 1, record owner. (PDA `["oracle"]`)
- `post_player_result(matchday, player_id, …stats)` — owner-only; write one
  player's stats while the matchday is not finalized. PDAs `["matchday", md]`,
  `["stats", md, player_id]`.
- `finalize_matchday(matchday)` — owner-only; lock the matchday, snapshot the
  current stage for deterministic scoring, advance `current_matchday`.
- `advance_stage(new_stage)` — owner-only, forward-only.

Scoring (`calculate_points`) is a pure crate function so `squad-wars` can call it
directly instead of via CPI. It applies the multiplier **snapshotted at finalize**
(`matchday.stage`), matching the Solidity behaviour where a war resolved after a
stage advance is not re-scored at the higher multiplier.

## Toolchain

- Rust (rustup), `stable`
- Solana CLI (Agave) — provides `solana`, `cargo-build-sbf`
- `anchor-lang = 0.31.1` (the Anchor *CLI* is not required; we build with
  `cargo-build-sbf` and deploy with `solana program deploy`)
