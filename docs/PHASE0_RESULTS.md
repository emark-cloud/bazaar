# Phase 0 — verification results

Captured 2026-05-25 during Phase 0 setup. Updated as each spike completes.

## 0.1 — Endpoints ✓

Both candidate RPCs and both Explorer URLs resolve. `chainId = 0xc488 (50312)` confirmed on both RPCs.

| Item | URL | Status |
|---|---|---|
| Testnet RPC (primary) | `https://api.infra.testnet.somnia.network` | ✓ HTTP 200, chainId 50312 |
| Testnet RPC (alt)     | `https://dream-rpc.somnia.network` | ✓ HTTP 200, chainId 50312 |
| Agent Explorer (testnet) | `https://agents.testnet.somnia.network` | ✓ HTTP 200 |
| Agent Explorer (mainnet) | `https://agents.somnia.network` | ✓ HTTP 200 |
| Receipts (testnet) | `https://receipts.testnet.agents.somnia.host/?requestId=1` | 404 (expected — no request 1) |

Lock-in: `TESTNET_RPC=https://api.infra.testnet.somnia.network`. Alt kept in `.env.example` as fallback.

## 0.2 — Agent IDs ✓

Pulled from the Agent Explorer web app (user-verified 2026-05-25). Mirrored in `contracts/src/lib/AgentIds.sol`.

| Agent | ID (testnet) | Per-agent price |
|---|---|---|
| LLM Inference | `12847293847561029384` | 0.07 STT |
| JSON API Request | `13174292974160097713` | 0.03 STT |
| LLM Parse Website | `12875401142070969085` | 0.10 STT |

The Parse Website ID also matches the verified docs constant; the other two come from the Explorer only.

## Platform sanity check ✓

Read live from `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` via `cast call`:

| Parameter | Value | Matches spec? |
|---|---|---|
| `minPerAgentDeposit()` | 0.01 STT (1e16 wei) | ✓ |
| `getRequestDeposit()` | 0.03 STT (3e16 wei) | ✓ (subcommittee 3 × 0.01) |
| `getAdvancedRequestDeposit(5)` | 0.05 STT (5e16 wei) | ✓ (subcommittee 5 × 0.01) |

## 0.3 — STT funding ⏳

- Deployer wallet generated: `0xEc8B1FA455fED5dEf70c0eDe85cfbFfF752F39cF`
- Current balance: 0 STT
- Discord pitch drafted: `docs/PHASE0_DISCORD_PITCH.md`
- Action: user posts in Somnia Discord `#dev-chat` and/or Developer Telegram

## 0.4–0.8 — Spike contracts ✓ (written, awaiting STT to deploy)

All five spike contracts compile (`forge build` clean, only style lints).

| Spike | Contract | Purpose |
|---|---|---|
| 0.4 Determinism | `src/spikes/MoveDecider.sol` | `inferChat` byte-identical across subcommittee under Majority |
| 0.5 JSON API | `src/spikes/JsonApiSpike.sol` | `fetchUint` returns scaled price |
| 0.6 inferString | `src/spikes/InferStringSpike.sol` | `allowedValues=["clean","suspect"]` under Threshold (5/3) |
| 0.7 inferToolsChat | `src/spikes/InferToolsChatSpike.sol` | MCP server URL completes in one call |
| (bonus) Parse Website | `src/spikes/ParseWebsiteSpike.sol` | `ExtractANumber` for audit cross-check |

Deploy script: `script/phase0/DeploySpikes.s.sol` — deploys all five in one broadcast.

## 0.8 — Reactivity 32 STT lock spike ⏳

To do once STT lands: deploy the tutorial `SomniaEventHandler` per `docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial` and confirm the 32 STT owner-balance requirement empirically.

## 0.9 — VRF spike ⏳

To do once STT lands: deploy `RandomNumberConsumer` against testnet wrapper `0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2`; record `getRequestPrice()` and complete one `fulfillRandomWords` cycle.

## Determinism fallback decision (placeholder until 0.4 runs)

If `inferChat` is **not** byte-identical across the subcommittee:
- Fall back to `Threshold` consensus.
- In `handleMove`, canonical-move selector = the response whose `keccak256(bytes(result))` is numerically smallest. Deterministic, no extra LLM call, no off-chain driver.
- Record the decision and rationale here (and in `docs/TECHNICAL.md`) once measured.
