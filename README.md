# Gaffer

> On-chain fantasy football manager for the 2026 World Cup, built on Base.

Gaffer turns the World Cup into a fully on-chain fantasy competition. Managers draft five real players as NFTs, stake USDC, and compete in head-to-head matchday wars. An on-chain Oracle posts official match results, the protocol settles each war automatically, and the winner takes 95% of the pot. Player cards permanently forge from Bronze to Icon as they accumulate tournament points.

## Table of contents

- [Overview](#overview)
- [How it works](#how-it-works)
- [The two NFT systems](#the-two-nft-systems)
- [Smart contracts](#smart-contracts)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

- **Draft once, compete all tournament.** Each address mints a bound five-player squad as ERC-721 tokens.
- **Stake-backed 1v1 wars.** Managers stake USDC on a chosen matchday and settle against real results.
- **Trustless settlement.** Scores are computed on-chain from Oracle-posted statistics using per-position scoring and World Cup stage multipliers.
- **Persistent progression.** Tournament points accrue to each card and permanently upgrade its rarity tier.
- **Open marketplace.** A separate ERC-721 contract sells individual player cards at deterministic, scarcity-aware prices.

## How it works

| Stage | Route | Description |
|---|---|---|
| **Draft** | `/squad` | Pick five players from the current roster (exactly one goalkeeper required). Minting is free aside from gas, and the squad is permanently bound to your address. |
| **Battle** | `/wars` | Create a war by selecting a matchday and stake. Any manager with a squad can accept. Both sides then lock a captain (2× points) and a benched player (0 points); the remaining three score at 1×. |
| **Resolve** | on-chain | Once the Oracle posts results, anyone can call `resolveWar`. The contract aggregates each squad's score with per-position scoring (e.g. goalkeeper clean sheet = 12 pts, forward goal = 10 pts), applies the stage multiplier (Group 1.0× through Final 3.0×), and pays 95% of the pot to the winner. |
| **Forge** | `/profile` | Tournament points accumulate on each card. At 30 / 80 / 150 points, cards automatically upgrade to Silver / Gold / Icon — permanently and on-chain. |
| **Trade** | `/marketplace` | Mint individual player NFTs at deterministic prices. Legends are capped at 100 mints each. |

## The two NFT systems

Gaffer uses **two distinct ERC-721 contracts** for two different purposes:

- **`GafferNFT` — your tournament squad.** A single `mintSquad()` call per address mints five bound cards that participate in Squad Wars. Their stats update on-chain after each matchday and are surfaced on `/profile`.
- **`PlayerMint` — the open marketplace.** Buy individual player cards (including the eight legends) at deterministic prices. These belong to your collection but are **not** automatically part of your tournament squad.

This separation is intentional: a player minted from the marketplace lives in your wallet as a collectible, independent of your active tournament squad.

## Smart contracts

Target network: **Base Sepolia** (chain ID `84532`).

| Contract | Responsibility |
|---|---|
| **Oracle** | Posts official matchday statistics and computes fantasy points per position. |
| **GafferNFT** | Mints a five-player squad as five ERC-721 tokens; updates card stats on-chain each matchday. |
| **SquadWars** | Manages war lifecycle — `createWar` / `acceptWar` / `lockDecision` / `resolveWar` — with real USDC stakes and a 95/5 winner/protocol split. |
| **PlayerMint** | Marketplace ERC-721 with an on-chain catalog of prices and supply caps (68 players: 60 current stars and 8 legends). |

The full lifecycle — mint → create war → accept → Oracle post → resolve → payout → reputation update — is covered by an end-to-end integration script and the contract test suite.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js)                     │
│  /             portal landing                                │
│  /play         manager hub                                   │
│  /squad        mint a five-card squad                        │
│  /wars         create, browse, and accept wars               │
│  /war/[id]     individual war breakdown (live scores)        │
│  /squad-setup  captain + bench selection                     │
│  /match/[id]   interactive match preview                     │
│  /marketplace  mint any player at its on-chain price         │
│  /profile      your squad, stats, and history                │
│  /leaderboard  top managers from getLeaderboard()            │
│  /predict      prediction markets (opens at kickoff)         │
│  /feed         live event timeline                           │
│  /rules        scoring, stages, and FAQ                      │
└─────────────────────────────────────────────────────────────┘
                              │
                wagmi + viem  │  multicall via useReadContracts
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Base Sepolia (chain ID 84532)              │
│                                                              │
│   Oracle  ──posts──▶  matchday results                       │
│      │                                                       │
│      ▼                                                       │
│   GafferNFT ◀──reads── SquadWars ──pays──▶ winner            │
│      │                     │                                 │
│      │ mints               │ stakes USDC                     │
│      ▼                     ▼                                 │
│   ERC-721 player cards     USDC pot (95% winner, 5% protocol)│
│                                                              │
│   PlayerMint (independent marketplace ERC-721)               │
└─────────────────────────────────────────────────────────────┘
```

## Tech stack

- **Contracts:** Solidity 0.8.24, OpenZeppelin v4.9.6, Hardhat, deployed to Base (OP Stack L2).
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
- **Web3:** wagmi v2, viem v2, and TanStack Query, with batched reads via `useReadContracts`.
- **Design:** Bebas Neue (display), Plus Jakarta Sans (body), and JetBrains Mono (numerics).
- **Audio:** sound effects synthesized at runtime with the Web Audio API — no audio assets required.
- **Assets:** legend portraits are AI-generated and post-processed locally; ambient music can be overridden by adding MP3s to `packages/app/public/music/`.

## Getting started

### Prerequisites

- Node.js 18+ and npm
- A wallet with Base Sepolia ETH for gas ([faucet](https://www.alchemy.com/faucets/base-sepolia))
- Test USDC on Base Sepolia for stakes and mints ([Circle faucet](https://faucet.circle.com))

### Install and run

```bash
git clone <this-repo>
cd gaffer
npm install

cp packages/app/.env.local.example packages/app/.env.local
cd packages/app
npm run dev
```

The app runs at http://localhost:3000.

### Network configuration

To interact with the contracts, add **Base Sepolia** to your wallet:

| Setting | Value |
|---|---|
| RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Currency symbol | `ETH` |
| Block explorer | `https://sepolia.basescan.org` |

### Environment variables

Set the deployed contract addresses in `packages/app/.env.local`:

```
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_ORACLE_ADDRESS=
NEXT_PUBLIC_NFT_ADDRESS=
NEXT_PUBLIC_SQUAD_WARS_ADDRESS=
NEXT_PUBLIC_PLAYER_MINT_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

All stakes and marketplace mints are paid in **USDC** (6 decimals). Because USDC is an ERC-20, each payment is a two-step flow — the app sends an `approve` transaction first, then the stake/mint — and gas is still paid in ETH.

## Deployment

Deploy the contracts to Base Sepolia and copy the printed addresses into `packages/app/.env.local`:

```bash
cd packages/contracts
cp .env.example .env        # set your deployer PRIVATE_KEY (and BASESCAN_API_KEY to verify)

npm run deploy:testnet      # deploys Oracle, GafferNFT, and SquadWars
npx hardhat run scripts/deploy-playermint.ts --network baseSepolia   # deploys PlayerMint and seeds the catalog
```

## Testing

Run the contract test suite:

```bash
cd packages/contracts
npm test
```

Run the full end-to-end integration flow against deployed contracts (set the deployed addresses as environment variables first):

```bash
npx hardhat run scripts/smoke-test.ts --network baseSepolia
```

The integration script provisions a second wallet, funds it from the deployer, and exercises the complete loop: both wallets mint squads, one creates a war, the other accepts, the Oracle posts results, the war resolves, reputation updates, and the payout settles on-chain.

## Project structure

```
gaffer/
├── packages/
│   ├── contracts/        # Solidity contracts, Hardhat config, tests, deploy scripts
│   └── app/              # Next.js frontend (App Router)
├── docs/                 # Supporting documentation
└── README.md
```

## Roadmap

Planned work for future seasons:

- **Interactive match engine.** A real-time, pause-and-decide simulation in which key moments involving your players pause play and present timed tactical choices, with cascading consequences.
- **Expanded player model.** Seventeen technical, mental, and physical attributes per player, stored on-chain.
- **Skill cards.** Equippable ERC-1155 modifiers that change available match decisions.
- **Synergies.** Player combinations that unlock hidden squad bonuses.
- **Training.** Stake tokens between matches to accelerate attribute growth.
- **Player lifecycle.** Aging, retirement, and conversion of veteran cards into Legacy Cards.
- **Competitive leagues.** Promotion and relegation across staked tiers.
- **On-chain decision log.** A verifiable record of every match decision, forming a manager's reputation profile.

## License

Released under the [MIT License](LICENSE).
