# Social copy — drafts

Pick one. They're ranked by my read of what actually lands.

---

## Twitter / X — submission post (lead)

```
Built Gaffer for the @base Base hackathon.

On-chain fantasy football. Draft 5 World Cup 2026 players as NFTs.
Stake ETH. Outscore your opponent on matchday. Cards forge from
bronze to icon, permanently, on-chain.

Live on Base testnet. 4 contracts deployed. Smoke-tested end-to-end.

[demo video link]
[repo link]
```

A bit blunt, fits the timeline. The OG image carries the visual weight — no need for emojis.

---

## Twitter / X — feature highlight thread (if you want to thread it)

**1/5**
```
Gaffer: on-chain fantasy football for the 2026 World Cup, built for
the @base hackathon.

5 NFTs. Real ETH stakes. Real player stats from the Oracle.
Winner takes 95%.

A thread on what's actually deployed ↓
```

**2/5 — The loop**
```
Draft 5 players (1 GK + 4 outfield) → mint as ERC-721 NFTs.
Create a war, pick a matchday, stake ETH.
Opponent accepts, both sides lock captain (2×) + bench (0×).
Oracle posts stats. Contract resolves. Winner gets the pot.

Group stage 1.0× → Final 3.0×.
```

**3/5 — On Base**
```
4 contracts live on Base testnet (chainId 84532):
· Oracle — posts matchday stats
· GafferNFT — mints squads
· SquadWars — handles the staking + payout
· PlayerMint — marketplace, 68 players catalogued

Total smoke-test gas for the full loop: ~2.14M.
Cost in ETH: 0.0006. Sub-cent.
```

**4/5 — Marketplace**
```
Every player is a buyable ERC-721 with a deterministic price.

Pelé sits at ~0.45 ETH. Maradona, Cruyff, Zidane, R9, Ronaldinho,
Beckenbauer, George Best — all in. Capped at 100 mints each.

Mid-tier current player: ~0.005 ETH.
```

**5/5 — What's next**
```
v2 is the Dughole spec: real-time pause-and-decide match engine,
17 attributes per player, skill cards (ERC-1155), training staking,
on-chain decision log, league promotion/relegation.

Demo: [video]
Code: [repo]
Play: [url]
```

---

## Short variants

**One-liner for replies / quote tweets:**
```
Built an on-chain fantasy football manager for Base. Draft 5
World Cup NFTs, stake ETH, beat the opposition. 4 contracts live.
[url]
```

**Even shorter:**
```
Gaffer. Five-card squads. ETH stakes. Real matchday outcomes.
On Base. [url]
```

---

## LinkedIn / longer-form

```
Shipped Gaffer this week for the Base Base hackathon — an
on-chain fantasy football manager for the 2026 World Cup.

The premise is simple: you draft 5 real World Cup players as ERC-721
NFTs, stake ETH against another manager, and the higher fantasy
score wins the pot. The Oracle posts real matchday stats, the
SquadWars contract resolves automatically, and 95% goes to the
winner. Captains earn 2×. Bench earns 0. Stage multipliers compound
from Group (1.0×) all the way to Final (3.0×).

Built four contracts in Solidity 0.8.24, frontend in Next.js 14 +
wagmi v2. Total gas for a full game loop (mint → war → accept →
Oracle post → resolve → payout): about 2.14M gas, which on Base
costs roughly 0.0006 ETH. Sub-cent.

Roster of 68 players including a marketplace of 8 World Cup legends
(Pelé, Maradona, Cruyff, Zidane, R9, Ronaldinho, Beckenbauer,
George Best) — AI-generated portraits, backgrounds stripped locally
with a U2Net ONNX model.

v2 is bigger: a real-time pause-and-decide match engine where every
key moment involving one of your players freezes the simulation and
you choose a tactical option in a 10-second window. Decisions
cascade — one reckless tackle in the box can concede a penalty and
crater your captain's composure for the next 30 minutes.

Demo + code in the comments.
```

---

## Submission line for the hackathon Google Form (one paragraph)

```
Gaffer is an on-chain fantasy football manager for the 2026 World Cup,
deployed on Base testnet. Managers draft five real players as
ERC-721 NFTs, stake ETH in 1v1 matchday wars, and the contract resolves
automatically using real Oracle-posted stats — winner takes 95% of the
pot. Four contracts are live (Oracle, GafferNFT, SquadWars, PlayerMint)
with 68 players seeded in the marketplace including 8 World Cup
legends. The full game loop (mint → war → accept → Oracle post →
resolve → payout) has been smoke-tested end-to-end on testnet for
~0.0006 ETH total gas. Frontend is Next.js 14 + wagmi v2; the marketplace,
profile, leaderboard, and wars pages all read live chain state via
multicall.
```

---

## Compose checklist before posting

- [ ] Replace `[demo video link]` with actual YouTube/Loom URL
- [ ] Replace `[repo link]` with the GitHub URL (public)
- [ ] Replace `[url]` with the deployed Vercel/equivalent URL
- [ ] First-time posters: attach the OG image manually (X sometimes scrapes slowly)
- [ ] Confirm @base handle is correct for the hackathon org
- [ ] Add `#XLayer #Base #Hackathon` tags if the format calls for them
