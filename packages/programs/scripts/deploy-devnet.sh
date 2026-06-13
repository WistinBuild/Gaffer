#!/usr/bin/env bash
# Build + deploy the Gaffer Anchor programs to Solana devnet.
#
# Prereqs (installed once):
#   rustup, Solana CLI (Agave), cargo-build-sbf
#   PATH must include ~/.local/share/solana/install/active_release/bin and ~/.cargo/bin
#
# The deployer wallet (.solana/devnet-keypair.json) must hold a few SOL.
# Fund it at https://faucet.solana.com/ (Devnet) if `solana balance` is 0.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRAMS_DIR="$(dirname "$HERE")"
REPO_ROOT="$(cd "$PROGRAMS_DIR/../.." && pwd)"
WALLET="$REPO_ROOT/.solana/devnet-keypair.json"
RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

echo "▶ Deployer:  $(solana address -k "$WALLET")"
echo "▶ Cluster:   $RPC"
BAL=$(solana balance -k "$WALLET" --url "$RPC" | awk '{print $1}')
echo "▶ Balance:   $BAL SOL"
if [ "$(echo "$BAL <= 0" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  echo "✗ Wallet has 0 SOL. Fund it at https://faucet.solana.com/ (Devnet), then re-run." >&2
  exit 1
fi

cd "$PROGRAMS_DIR"
echo "▶ Building (cargo-build-sbf)…"
cargo-build-sbf

# Deploy each program in dependency order. Oracle first (SquadWars reads it).
for PROG in oracle; do
  SO="target/deploy/${PROG}.so"
  KP="${PROG}-program-keypair.json"
  echo "▶ Deploying $PROG ($SO)…"
  solana program deploy "$SO" \
    --program-id "$KP" \
    --keypair "$WALLET" \
    --url "$RPC"
  echo "✓ $PROG → $(solana address -k "$KP")"
done

echo "✓ Done. Update packages/app/.env.local with the program IDs above."
