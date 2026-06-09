# Gaffer — Deployment Guide

Gaffer is a single **Next.js 14** fullstack app (`packages/app`) that serves the
frontend, the on-chain NFT metadata API, and the treasury "bot" automation — plus
a Hardhat package (`packages/contracts`) for the Solidity contracts. There is **no
separate backend service and no database**; the API routes are serverless handlers.

## Architecture

```
packages/app (Next.js)
├─ /                         Frontend (wallet connect, squads, wars, marketplace)
├─ /metadata/[id]            ERC-721 metadata for GafferNFT squad cards  (dynamic, on-chain)
├─ /players/[id]             ERC-721 metadata for PlayerMint cards        (dynamic, on-chain)
├─ /api/card-image/squad/*   SVG card art (squad)
├─ /api/card-image/player/*  SVG card art (marketplace)
└─ /api/bot/{challenge,finalize}   Treasury bot: auto-opponent + oracle  (secret-gated)

packages/contracts (Hardhat)  Oracle · GafferNFT · SquadWars · PlayerMint  (Base Sepolia)
```

The contracts' `tokenURI` is `baseURI + tokenId`. The metadata routes live at
`/metadata/<id>` and `/players/<id>` precisely so `baseURI` can point at
`https://<your-domain>/metadata/` and `/players/`.

## 1. Buy a domain

One domain is enough — `gaffer.games`. Everything — site, metadata, bot — is
served from it. You do **not** need the dead `api.gaffer.gg` subdomain the
contracts were originally deployed with; step 4 repoints them to gaffer.games.

## 2. Deploy to Vercel

1. Import the repo. Set **Root Directory = `packages/app`** (monorepo).
2. Framework preset: **Next.js** (auto-detected).
3. Add the environment variables below (Project → Settings → Environment Variables).
4. Deploy, then attach your domain in Project → Domains.

Alternatives: Netlify (same model), or Railway/Render/Fly if you'd rather run a
long-lived Node process. Vercel is the lowest-friction fit for this stack.

### Environment variables

| Var | Scope | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_CHAIN_ID` | public | `84532` Base Sepolia / `8453` Base mainnet |
| `NEXT_PUBLIC_RPC_URL` | public | **Use Alchemy/QuickNode** — the public RPC is flaky |
| `NEXT_PUBLIC_ORACLE_ADDRESS` | public | from deploy output |
| `NEXT_PUBLIC_NFT_ADDRESS` | public | |
| `NEXT_PUBLIC_SQUAD_WARS_ADDRESS` | public | |
| `NEXT_PUBLIC_PLAYER_MINT_ADDRESS` | public | |
| `NEXT_PUBLIC_USDC_ADDRESS` | public | USDC token |
| `NEXT_PUBLIC_SITE_URL` | public | `https://gaffer.games` — must match the baseURI domain |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | public | walletconnect.com cloud project |
| `TREASURY_PRIVATE_KEY` | **secret** | dedicated low-balance hot wallet — NOT the owner key |
| `BOT_TRIGGER_SECRET` | **secret** | `openssl rand -hex 32`; gates `/api/bot/*` |

## 3. Production RPC

Set `NEXT_PUBLIC_RPC_URL` to an Alchemy/QuickNode Base endpoint. The default
public `sepolia.base.org` rate-limits and returns "could not coalesce" errors
under load — fine for local dev, not for production read traffic.

## 4. Repoint the NFT metadata base

After the domain resolves to the deployed app:

```bash
cd packages/contracts
SITE_URL=https://gaffer.games node scripts/set-base-uri.mjs
```

This calls `setBaseURI` (owner-only) on both NFT contracts so:
- `GafferNFT.tokenURI(id)`  → `https://gaffer.games/metadata/<id>`
- `PlayerMint.tokenURI(id)` → `https://gaffer.games/players/<id>`

Verify: open `https://gaffer.games/metadata/1` (JSON) and the `image` URL it returns.

## 5. Bot automation (treasury)

`/api/bot/challenge` makes the treasury wallet accept a user's war; `/api/bot/finalize`
posts the matchday result and resolves it. Both require:

```
Authorization: Bearer <BOT_TRIGGER_SECRET>
```

Requests without the secret get 401; if the secret env is unset the routes are
disabled (503) — they can never be left open by misconfiguration.

- Fund the treasury wallet with ETH (gas) + USDC (to match stakes).
- The treasury wallet must be the **Oracle owner** to post results (or transfer
  Oracle ownership to it).
- To run on a schedule, add a Vercel Cron Job hitting these endpoints with the
  bearer header, or trigger them from the frontend after a matchday.

## 6. Going to mainnet (not done yet)

This deployment is **Base Sepolia + test USDC**. Before real money:

- [ ] Redeploy contracts to Base mainnet (`8453`) with real USDC; re-verify.
- [ ] **External security audit** — current `AUDIT.md` is internal only.
- [ ] Move contract ownership + the Oracle to a **multisig** (e.g. Safe).
- [ ] Resolve accepted design risks A1–A3 in `AUDIT.md` (esp. **A2** accept-time
      info advantage) before staking real funds.
- [ ] Replace the engineered "user always wins" bot logic with real fixture data.
- [ ] Monitoring/alerting on the treasury wallet balance + bot failures.
