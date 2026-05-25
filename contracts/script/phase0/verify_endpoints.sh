#!/usr/bin/env bash
# Phase 0.1 — verify Somnia testnet endpoints resolve and return the expected chain ID.
# Both candidate RPCs and both Agent Explorer URLs are probed.
set -euo pipefail

probe_rpc() {
  local url="$1"
  local code chain
  code=$(curl -s -o /tmp/_rpc_body -w "%{http_code}" -m 8 -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" || echo "0")
  chain=$(grep -oE '"result":"0x[0-9a-fA-F]+"' /tmp/_rpc_body 2>/dev/null | head -1 || echo "")
  printf "  %-50s HTTP %s  chainId %s\n" "$url" "$code" "$chain"
}

probe_http() {
  local url="$1" code
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$url" || echo "0")
  printf "  %-50s HTTP %s\n" "$url" "$code"
}

echo "=== Testnet RPC candidates (expect chainId 0xc488 = 50312) ==="
probe_rpc "https://api.infra.testnet.somnia.network"
probe_rpc "https://dream-rpc.somnia.network"

echo
echo "=== Agent Explorer candidates ==="
probe_http "https://agents.testnet.somnia.network/"
probe_http "https://agents.somnia.network/"

echo
echo "=== Receipt services ==="
probe_http "https://receipts.testnet.agents.somnia.host/?requestId=1"

echo
echo "Lock the working URLs into .env.example after a clean run."
