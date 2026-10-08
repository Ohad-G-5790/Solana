# Greenroom setup for Windows (PowerShell). Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# It checks the toolchain, installs JS dependencies, builds the program and
# creates a dev wallet if none exists. Nothing here touches mainnet.

$ErrorActionPreference = "Stop"

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "missing: $cmd  ->  $hint" -ForegroundColor Red; exit 1 }
}

Write-Host "== toolchain ==" -ForegroundColor Green
Need node   "install Node 20.18+ from https://nodejs.org"
Need rustc  "install Rust via https://rustup.rs (1.89+)"
Need solana "install Solana CLI 4.x: see README (agave-install)"
Need anchor "install Anchor CLI 1.2.1: cargo install --git https://github.com/otter-sec/anchor --tag v1.2.1 anchor-cli --locked"
node --version; rustc --version; solana --version; anchor --version

Write-Host "== wallet ==" -ForegroundColor Green
$wallet = Join-Path $env:USERPROFILE ".config\solana\id.json"
if (-not (Test-Path $wallet)) {
  solana-keygen new --no-bip39-passphrase -s -o $wallet
  Write-Host "created dev wallet $wallet"
}
solana config set --url https://api.devnet.solana.com | Out-Null
Write-Host "address: $(solana address)"

Write-Host "== dependencies ==" -ForegroundColor Green
npm install --no-audit --no-fund

Write-Host "== program ==" -ForegroundColor Green
npm run build:program

Write-Host "== dashboard env ==" -ForegroundColor Green
if (-not (Test-Path "packages\web\.env.local")) {
  Copy-Item "packages\web\.env.local.example" "packages\web\.env.local"
  Write-Host "wrote packages/web/.env.local (dashboard -> local validator; delete it to use devnet)"
}

Write-Host "== local validator ==" -ForegroundColor Green
$releases = Join-Path $env:USERPROFILE ".local\share\solana\install\releases"
$legacy = Get-ChildItem $releases -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "1.18*" }
if (-not $legacy) {
  Write-Host "No Solana 1.18 release found. On Windows the Agave 4.x test validator cannot unpack its genesis archive," -ForegroundColor Yellow
  Write-Host "so local tests and the local demo use the 1.18.x validator. Install it once with:" -ForegroundColor Yellow
  Write-Host "  agave-install init 1.18.18   (then switch back with: agave-install init 4.1.2)" -ForegroundColor Yellow
} else {
  Write-Host "found legacy validator release: $($legacy[0].Name)"
}

Write-Host ""
Write-Host "Ready. Next:" -ForegroundColor Green
Write-Host "  npm run test:program     # program tests on a local validator"
Write-Host "  npm run demo:fast        # agents book a tour end to end, locally"
Write-Host "  npm run dev -w @greenroom/web   # dashboard"
