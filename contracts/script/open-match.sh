#!/usr/bin/env bash
#
# open-match.sh — resilient match opener for the Bazaar Arena on Somnia Shannon.
#
# Why this exists: `forge script --broadcast` does a pre-flight forking simulation
# that reads contract storage over RPC. When the Somnia testnet RPC is degraded
# (frequent), that fork read times out and the tx is never sent. This script skips
# simulation entirely: it sends with an explicit --gas-limit (no eth_estimateGas),
# rotates between the primary and alt RPCs, retries transient failures, and verifies
# the receipt status. It also runs a FUNDING PREFLIGHT so a match never starts that
# the Arena can't afford to finish (the on-chain Arena has no such guard yet).
#
# Usage:
#   ./script/open-match.sh                 # exhibition, 2 rounds, 2 default lots
#   MODE=realstakes ./script/open-match.sh # real-stakes (forwards a pot)
#   ROUNDS=3 ./script/open-match.sh
#   AUTO_TOPUP=1 ./script/open-match.sh    # top Arena up from deployer if underfunded
#
# Env (sourced from repo-root .env): PRIVATE_KEY, ARENA, HAWK_ID, DIPLOMAT_ID,
# QUANT_ID, CONTRARIAN_ID, TESTNET_RPC, TESTNET_RPC_ALT, AGENT_REGISTRY.
set -euo pipefail

# ---- config -----------------------------------------------------------------
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"          # contracts/
ENV_FILE="${ENV_FILE:-$HERE/../.env}"
[ -f "$ENV_FILE" ] || { echo "FATAL: no .env at $ENV_FILE"; exit 1; }
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

MODE="${MODE:-exhibition}"                # exhibition | realstakes
ROUNDS="${ROUNDS:-2}"
STARTING_BUDGET="${STARTING_BUDGET:-25000000000000000000}"   # 25 STT (exhibition)
ENTRY_STAKE="${ENTRY_STAKE:-1000000000000000000}"            # 1 STT/agent (realstakes); override via env
GAS_LIMIT="${GAS_LIMIT:-30000000}"
OP_HEADROOM_NUM="${OP_HEADROOM_NUM:-3}"   # require balance >= worstCase * 3/2
OP_HEADROOM_DEN="${OP_HEADROOM_DEN:-2}"
RETRIES="${RETRIES:-4}"

RPCS=("${TESTNET_RPC:?}" "${TESTNET_RPC_ALT:-$TESTNET_RPC}")
ARENA="${ARENA:?}"; REG="${AGENT_REGISTRY:?}"
AGENTS=("${HAWK_ID:?}" "${DIPLOMAT_ID:?}" "${QUANT_ID:?}" "${CONTRARIAN_ID:?}")
DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"

# default lots (must match what the Arena prices). Two Coinbase spot feeds.
NUM_LOTS=2
LOTS='[("ETH-USD","https://api.coinbase.com/v2/prices/ETH-USD/spot","data.amount",0,1,"typically 1500-4000"),("SOL-USD","https://api.coinbase.com/v2/prices/SOL-USD/spot","data.amount",0,1,"typically 50-200")]'

# platform per-agent prices (AgentIds.sol) + subcommittee
PRICE_LLM=70000000000000000      # 0.07
PRICE_JSON=30000000000000000     # 0.03
SUBC=3

# ---- helpers ----------------------------------------------------------------
# Run a read (cast call/balance) against the first responsive RPC.
read_rpc() { # $@ = cast args (without --rpc-url)
  local rpc out
  for rpc in "${RPCS[@]}"; do
    if out="$("$@" --rpc-url "$rpc" 2>/dev/null)"; then printf '%s' "$out"; return 0; fi
  done
  return 1
}
wei() { python3 -c "import sys;print(int(sys.argv[1]))" "$1"; }
stt() { python3 -c "import sys;print(f'{int(sys.argv[1])/1e18:.4f}')" "$1"; }

echo "== open-match preflight =="
echo "mode=$MODE rounds=$ROUNDS lots=$NUM_LOTS agents=${AGENTS[*]}"
echo "arena=$ARENA deployer=$DEPLOYER"

# ---- 1. agents joinable -----------------------------------------------------
GET_AGENT='getAgent(uint256)((bytes32,string,string,uint16,uint32,uint32,bool))'
for id in "${AGENTS[@]}"; do
  row="$(read_rpc cast call "$REG" "$GET_AGENT" "$id")" || { echo "FATAL: registry read failed (RPC down)"; exit 1; }
  case "$row" in
    *", true)"|*"true)") : ;;
    *) echo "FATAL: agent $id is not joinable — a prior match may be stalled. Aborting."; exit 1 ;;
  esac
done
echo "ok: all ${#AGENTS[@]} agents joinable"

# ---- 2. worst-case operating cost & affordability ---------------------------
PLATFORM="${PLATFORM_TESTNET:-0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776}"
FLOOR="$(read_rpc cast call "$PLATFORM" "getRequestDeposit()(uint256)")" \
  || { echo "FATAL: cannot read platform floor"; exit 1; }
FLOOR="${FLOOR%% *}"
MOVES=$(( ${#AGENTS[@]} * ROUNDS ))
WORST="$(python3 - "$FLOOR" "$PRICE_LLM" "$PRICE_JSON" "$SUBC" "$MOVES" "$NUM_LOTS" <<'PY'
import sys
floor,plm,pj,subc,moves,lots=map(int,sys.argv[1:7])
dep_move = floor + plm*subc
dep_price= floor + pj*subc
print(moves*dep_move + lots*dep_price)
PY
)"
REQUIRED="$(python3 -c "print($WORST*$OP_HEADROOM_NUM//$OP_HEADROOM_DEN)")"
ARENA_BAL="$(read_rpc cast balance "$ARENA")"; ARENA_BAL="${ARENA_BAL%% *}"
echo "worst-case platform cost (no rebates): $(stt "$WORST") STT  |  required w/ headroom: $(stt "$REQUIRED") STT"
echo "arena operating balance: $(stt "$ARENA_BAL") STT"

if python3 -c "import sys;sys.exit(0 if int('$ARENA_BAL')>=int('$REQUIRED') else 1)"; then
  echo "ok: arena is funded to finish this match"
else
  NEED="$(python3 -c "print(int('$REQUIRED')-int('$ARENA_BAL'))")"
  if [ "${AUTO_TOPUP:-0}" = "1" ]; then
    echo "topping up arena by $(stt "$NEED") STT from deployer..."
    cast send "$ARENA" --value "$NEED" --private-key "$PRIVATE_KEY" --rpc-url "${RPCS[0]}" --gas-limit 100000 >/dev/null
    echo "ok: topped up"
  else
    echo "FATAL: arena underfunded by $(stt "$NEED") STT — re-run with AUTO_TOPUP=1 or fund $ARENA. Aborting."
    exit 1
  fi
fi

# ---- 3. deployer can pay gas (+ pot for realstakes) -------------------------
DEP_BAL="$(read_rpc cast balance "$DEPLOYER")"; DEP_BAL="${DEP_BAL%% *}"
POT=0
if [ "$MODE" = "realstakes" ]; then POT="$(python3 -c "print($ENTRY_STAKE*${#AGENTS[@]})")"; fi
MIN_DEP="$(python3 -c "print($POT + 2000000000000000000)")"   # pot + 2 STT gas buffer
echo "deployer balance: $(stt "$DEP_BAL") STT  (need ~$(stt "$MIN_DEP") STT)"
python3 -c "import sys;sys.exit(0 if int('$DEP_BAL')>=int('$MIN_DEP') else 1)" \
  || { echo "FATAL: deployer underfunded for $MODE open. Aborting."; exit 1; }

# ---- 4. build calldata ------------------------------------------------------
ID_ARR="[$(IFS=,; echo "${AGENTS[*]}")]"
if [ "$MODE" = "realstakes" ]; then
  SIG='openRealStakes(uint256[],uint256,uint8,(string,string,string,uint8,uint256,string)[])'
  ARGS=("$ID_ARR" "$ENTRY_STAKE" "$ROUNDS" "$LOTS"); VALUE="$POT"
else
  SIG='openExhibition(uint256[],uint256,uint8,(string,string,string,uint8,uint256,string)[])'
  ARGS=("$ID_ARR" "$STARTING_BUDGET" "$ROUNDS" "$LOTS"); VALUE="5000000000000000000"  # 5 STT headroom
fi

# ---- 5. send with rpc rotation + retry, skip simulation ---------------------
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN: preflight passed; would send $SIG value=$(stt "$VALUE") STT gas-limit=$GAS_LIMIT"
  echo "calldata: $(cast calldata "$SIG" "${ARGS[@]}" | cut -c1-50)…"
  exit 0
fi
echo "== broadcasting $MODE open (gas-limit=$GAS_LIMIT, value=$(stt "$VALUE") STT) =="
attempt=0
while :; do
  attempt=$((attempt+1))
  rpc="${RPCS[$(( (attempt-1) % ${#RPCS[@]} ))]}"
  echo "[try $attempt/$RETRIES] rpc=$rpc"
  if out="$(cast send "$ARENA" "$SIG" "${ARGS[@]}" \
              --value "$VALUE" --gas-limit "$GAS_LIMIT" \
              --private-key "$PRIVATE_KEY" --rpc-url "$rpc" --json 2>&1)"; then
    status="$(printf '%s' "$out" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo '')"
    txh="$(printf '%s' "$out" | python3 -c "import sys,json;print(json.load(sys.stdin).get('transactionHash',''))" 2>/dev/null || echo '')"
    if [ "$status" = "0x1" ]; then
      echo "SUCCESS: match opened — tx $txh"
      if MID="$(read_rpc cast call "$ARENA" "nextMatchId()(uint256)")"; then
        MID="${MID%% *}"; echo "next match id is now $MID (this match = $((MID-1)))"
      fi
      exit 0
    fi
    echo "tx reverted on-chain (status=$status, tx=$txh) — likely a transient platform error; retrying"
  else
    echo "send failed (RPC/transport): $(printf '%s' "$out" | tail -1)"
  fi
  [ "$attempt" -ge "$RETRIES" ] && { echo "FATAL: exhausted $RETRIES attempts"; exit 1; }
  sleep $(( attempt * 5 ))
done
