#!/usr/bin/env bash
# Greenroom setup for macOS / Linux. Run from the repository root: bash scripts/setup.sh
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 -> $2" >&2; exit 1; }; }

echo "== toolchain =="
need node   "install Node 20.18+ (https://nodejs.org)"
need rustc  "install Rust via https://rustup.rs (1.89+)"
need solana "install Solana CLI 4.x: sh -c \"\$(curl -sSfL https://release.anza.xyz/v4.1.2/install)\""
need anchor "install Anchor CLI 1.2.1: cargo install --git https://github.com/otter-sec/anchor --tag v1.2.1 anchor-cli --locked"
node --version; rustc --version; solana --version; anchor --version

echo "== wallet =="
WALLET="$HOME/.config/solana/id.json"
if [ ! -f "$WALLET" ]; then
  solana-keygen new --no-bip39-passphrase -s -o "$WALLET"
  echo "created dev wallet $WALLET"
fi
solana config set --url https://api.devnet.solana.com >/dev/null
echo "address: $(solana address)"

echo "== dependencies =="
npm install --no-audit --no-fund

echo "== program =="
npm run build:program

echo "== dashboard =="
echo "The dashboard reads devnet by default. To point it at a local validator: cp packages/web/.env.local.example packages/web/.env.local"

echo
echo "Ready. Next:"
echo "  npm run test:program     # program tests on a local validator"
echo "  npm run demo:fast        # agents book a tour end to end, locally"
echo "  npm run dev -w @greenroom/web   # dashboard"
