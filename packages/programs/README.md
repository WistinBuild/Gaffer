# Gaffer — Solana programs (Anchor)

On-chain layer migrating from Base (EVM / Solidity) to **Solana devnet**. This
package holds the Anchor (Rust) ports of the original contracts in
`packages/contracts`.

## Migration status

| Solidity contract | Solana program | Status |
| ----------------- | -------------- | ------ |
| `Oracle.sol`      | `programs/oracle` | ✅ ported, **deployed + initialized on devnet** |
| `GafferNFT.sol`   | `programs/gaffer-nft` | ⏳ next (Metaplex Core squad NFTs) |
| `PlayerMint.sol`  | `programs/player-mint` | ⏳ next (SPL/USDC payment + Metaplex) |
| `SquadWars.sol`   | `programs/squad-wars` | ⏳ next (USDC escrow PDA + oracle scoring) |

The Oracle is the dependency root (SquadWars reads its scoring), so it is ported
first and serves as the pattern for the rest.

## Addresses

| Item | Value |
| ---- | ----- |
| Deployer / authority wallet | `D1EZqSobg2M1itFS24WLaJpWkWFDXQ17p9azLMdw44d6` |
| Oracle program ID | `3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb` |
| OracleState PDA (`["oracle"]`) | `3Uk8BCtKtk6TTkQKkJYG6531G7UhLXzLH3AjWXrvbTuZ` |
| Cluster | devnet |

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
