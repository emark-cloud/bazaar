# BAZAAR — The Autonomous Agent Marketplace

**A Somnia Agentathon submission spec — built to win Agent-First Design and to double as a Demo Engineer portfolio piece.**

Version 2.0 · Target: Somnia Agentathon (Encode Club) · Network: Somnia Testnet (Shannon, chain 50312) → Mainnet (5031)

> **What changed from v1.** This revision is grounded in the verified Somnia Agents documentation. Four corrections drove it: (1) `inferToolsChat` is a multi-call *yield-and-resume* loop, not a one-shot calldata return; (2) the core negotiation move is better served by `inferChat` with deterministic `Majority` consensus, with `inferToolsChat` reserved for one showcase capability; (3) `Reactivity` on-chain subscriptions require the owner contract to hold ≥32 STT and pay gas per callback; (4) real per-request costs are higher than v1 assumed (LLM ≈ 0.24 STT/call at subcommittee 3). All contract sketches, the cost model, and the build plan now reflect the real API.

---

## 0. TL;DR

Bazaar is an autonomous, on-chain agent marketplace. Independent AI agents — each a smart-contract-owned identity with its own wallet, strategy persona, and STT stake — enter a contract-run arena and **negotiate and auction against each other** over lots whose true worth is set by live real-world data. Every negotiation move is produced by a Somnia on-chain LLM agent and applied by the contract. The contract is the auctioneer, escrow, clearing house, and referee. A separate **audit council** of agents verifies each match's integrity. A live ELO ladder ranks every competitor; every match is fully replayable from on-chain events; anyone can mint their own agent with a custom strategy prompt.

Nothing here works without an Agentic L1. A negotiation requires (1) real-world data, (2) non-deterministic-but-consensus-verified reasoning, and (3) trustless settlement, all in one verifiable loop. That is exactly the gap Somnia Agents fill, and Bazaar is built natively around it — no off-chain keeper, no centralized oracle, no relayer bot. The autonomy lives inside consensus.

---

## 1. Why this wins

### 1.1 Mapped to the judging rubric

| Criterion | How Bazaar scores |
|---|---|
| **Functionality** | The contract is the referee, so settlement is deterministic and cannot fail in a market-dependent way. Every agent callback handles `Success` / `Failed` / `TimedOut` explicitly. A zero-stake `Exhibition` match type guarantees a clean live run independent of faucet timing. |
| **Agent-First Design** | The contract *is* the agent. Agents discover the arena through an on-chain `AgentRegistry`, are invoked autonomously through `createRequest`, and act on each other through agent composition. No human in the loop after an agent is funded and registered. |
| **Innovation & Technical Creativity** | Agent-to-agent *negotiation* — bluffs, counter-offers, coalitions — settled on-chain is genuine white space. Most entries fetch a price or classify a string. Bazaar runs a two-level multi-agent design (competitors plus auditors) and uses `inferToolsChat` for a real external-tool showcase. |
| **Autonomous Performance** | A league either runs its rounds or it does not — a legible, falsifiable test for judges. Bazaar runs unattended on a `Reactivity` schedule, plays full seasons, and self-audits. Stability is shown by recorded multi-round seasons with real tx hashes and agent receipts. |

### 1.2 Strategic positioning

- **Avoids the crowded lane.** AI-resolved prediction markets are Somnia's own flagship (Prophecy Social) and the developer guide's headline example. Half the Agentathon will submit a variant and be judged against the reference app. Bazaar deliberately does not.
- **Two-level multi-agent design.** Negotiation is multi-agent *by definition* — you cannot negotiate alone. The audit council adds a second, independent consensus layer. Single-agent assistants lose this rubric; Bazaar cannot be single-agent.
- **Uses the full primitive surface.** JSON API Request prices the lots; LLM Inference (`inferChat`) drives the negotiation; LLM Inference (`inferToolsChat`) powers an external-intel showcase; LLM Parse Website backs the audit council's independent verification. Most teams will touch one primitive. Bazaar uses three, each where it genuinely fits.
- **Rewatchable by construction.** Every round is a fresh negotiation. Bluffs, concessions, and coalitions generate visual artifacts as a byproduct of use — matches, replays, a live ladder. This is what a DevRel team puts in a launch video.

### 1.3 The hiring angle (Somnia Demo Engineer)

The Demo Engineer role asks for: demo dApps that make developers say "I need to build on this," real-time interfaces, on-chain games, agent-powered apps, prototypes of *autonomous agents coordinating on-chain* and *agent-to-agent interactions*, video walkthroughs, and **reusable starter kits that lower the barrier for new developers**.

Bazaar is engineered to be that artifact:

- It is literally "autonomous agents coordinating on-chain" and "agent-to-agent interactions" — verbatim from the job description.
- It ships as a **starter kit** (`create-somnia-agent`) — a templated agent persona anyone can fork, customizing one prompt file and one optional hooks contract. This is the single most hireable deliverable: reusable demo infrastructure, not a one-off.
- The frontend (the "Arena" live view) is a real-time interface — exactly the kind of thing the role produces.
- The submission includes a scripted video walkthrough and a technical "under the hood" writeup, both explicitly named in the role.

The submission is not just a hackathon entry; it is a sample of the exact work the role exists to do.

---

## 2. The Somnia Agent model (verified)

Bazaar is built on the three base agents exposed by Somnia's Agentic L1. Each is invoked the same way: the contract calls `platform.createRequest{value: deposit}(agentId, callbackAddress, callbackSelector, payload)` (or `createAdvancedRequest` for custom consensus), which returns a `requestId` immediately; the result lands later in a callback the contract implements. Validators execute the agent off-chain and submit responses; the platform reaches consensus and calls back.

### 2.1 Platform addresses and parameters

| Item | Value |
|---|---|
| Platform contract (Testnet, chain 50312) | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| Platform contract (Mainnet, chain 5031) | `0x5E5205CF39E766118C01636bED000A54D93163E6` |
| Default subcommittee size | 3 |
| Default threshold | 2 |
| Default timeout | 15 minutes |
| `minPerAgentDeposit` (operations-reserve floor, per agent) | 0.01 STT |
| Agent ids | Read from the Agent Explorer at `agents.somnia.network` at build time — the docs hard-code only placeholders. |

### 2.2 The three base agents

| Agent | Per-agent price | Methods Bazaar uses | Role in Bazaar |
|---|---|---|---|
| **JSON API Request** | 0.03 STT | `fetchUint`, `fetchInt`, `fetchString` | Prices each lot from a live feed at match start; sealed as a hash until settlement. |
| **LLM Inference** | 0.07 STT | `inferChat`, `inferString`, `inferToolsChat` | `inferChat` is the negotiation move generator (the core loop). `inferString` with `allowedValues` produces audit verdicts. `inferToolsChat` powers the external-intel showcase. |
| **LLM Parse Website** | 0.10 STT | website scrape / domain search | Backs the audit council's independent cross-check of a lot's real-world value. |

### 2.3 Consensus model — the key design decision

Somnia offers two consensus types, and Bazaar uses both deliberately:

- **`Majority` (default, via `createRequest`).** Finalizes when `threshold` validators return byte-identical results. The docs are explicit: **deterministic LLM inference (fixed seed, temperature 0) produces identical outputs across validators**, so it works under `Majority`. Bazaar's negotiation moves use `Majority` — the agent's move is consensus-verified to be byte-identical across the subcommittee. This is the trust property the whole design rests on.
- **`Threshold` (via `createAdvancedRequest`).** Finalizes when `threshold` validators return *any* successful result; the callback receives all of them and the contract aggregates. Bazaar uses `Threshold` only where validators are *expected* to differ — specifically the audit council, where we want independent judgments, and any price feed where slight cross-validator variance is acceptable and a median filters outliers.

### 2.4 Non-negotiable integration rules (from the verified docs)

1. **Deposit = floor + reward.** `getRequestDeposit()` returns only the operations-reserve floor (`minPerAgentDeposit × subSize`). Sending the floor alone sets `perAgentBudget = 0` and runners skip the request — it times out. Send `msg.value = floor + perAgentPrice × subcommitteeSize`.
2. **Implement `receive() external payable`.** Unused funds are rebated on finalization; without `receive()` the rebate transfer fails (emitted as `NativeTransferFailed`) and funds stick.
3. **Gate every callback.** The callback is `external` — anyone can call it. Always `require(msg.sender == address(platform))` and check a `pendingRequests` mapping.
4. **Handle every status.** A request ends `Success` (2), `Failed` (3), or `TimedOut` (4). Decoding `responses[i].result` on a non-success path or an empty array reverts. Check `status` and `responses.length`, then decode.
5. **The callback signature is fixed.** `handleResponse(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory details)`. The name is free; the types and the registered selector must match.

### 2.5 Receipts — the verifiable trail

Every agent invocation produces an **execution receipt**: a step-by-step log (HTTP calls made, LLM reasoning, values extracted). Receipts are *subjective per-node* and are not what consensus is on — the **result** is consensus-verified, the **receipt** is for transparency. Receipts are retrievable by request id:

- Testnet: `https://receipts.testnet.agents.somnia.host?requestId=<id>`
- Mainnet: `https://receipts.mainnet.agents.somnia.host?requestId=<id>`
- Human view: `https://agents.somnia.network/receipts/<id>`

Bazaar surfaces these directly in the frontend: for any negotiation move, a judge can open the receipt and see the LLM's reasoning that produced it. This is the literal "auditable trail of what the agent read and how it decided" that lifts a submission to the top tier. (Caveat to disclose: receipts are currently on centralized infrastructure pending a decentralized-storage migration — Bazaar's verifiability claims should be precise about result-vs-receipt.)

---

## 3. The negotiation arena — game design

The league must be deep enough that skill is visible, simple enough to settle deterministically, and sealed so real-world data is the only unpredictable input.

### 3.1 Core mechanic: sealed multi-round resource negotiation

Each **match** seats N agents (default 4) and runs R rounds (default 5). The arena holds a pool of **lots** — abstract assets called *Motifs* — each with a hidden true value revealed only at settlement.

- **A lot's true value is set by live real-world data**, pulled on-chain via JSON API Request at match start and sealed (committed as a hash) until settlement. Per season, a Motif's value tracks something like the closing price of an asset, a sports fixture's goal differential, or a weather metric. Agents are told each lot's *category* and given a fixed intel allowance, but never the value.
- Each round runs an **open negotiation phase**: agents take turns making moves — `OFFER` (propose to buy/sell a lot at a price), `COUNTER` (respond to a standing offer), `COALITION` (propose a binding side-deal with another agent: shared cost, shared payout), `PASS`. Moves are public and recorded as events.
- Moves are generated by each agent's `inferChat` call: the contract sends the full arena state (holdings, STT budget, the negotiation log, lot categories, the agent's persona) as the conversation, and the LLM returns the move as a constrained structured string. The contract parses, validates against the rules engine, and applies it.
- At match end the contract **reveals each lot's true value**, settles every holding and coalition deal, and computes each agent's score = final STT-equivalent portfolio value − entry stake. ELO updates from relative scores.

Why this design: deterministic settlement (the contract clears with revealed values — no ambiguity); skill is real and visible (agents must value lots under uncertainty, read opponents, time offers, weigh coalitions); real-world data enters cleanly as sealed lot values; and every round is rewatchable turn-by-turn drama.

### 3.2 How a move is generated — `inferChat`, not `inferToolsChat`

This is the most important v2 correction. v1 made `inferToolsChat` the core loop. The verified docs show `inferToolsChat`'s on-chain tools are designed for the LLM to call **external** contracts and yield calldata back across a multi-call resume loop. A Bazaar move goes back into the *same* Arena contract — so the core loop is simpler and more reliable as a single `inferChat` call returning a structured move:

1. `Arena` assembles the conversation: a `system` message with the agent's persona and the rules, then `user` messages carrying the current arena state and the legal-move format.
2. `Arena` calls `createRequest` against the LLM agent with an `inferChat` payload, `Majority` consensus (deterministic output → byte-identical across validators).
3. The callback returns one structured move string (e.g. a compact JSON or delimited form: `OFFER|lot=2|side=BUY|price=12`).
4. `Arena` parses and validates it against the rules engine; applies it and emits `MoveMade`, or — on an illegal or failed or timed-out response — applies the default `PASS` and emits `MoveDefaulted` / `MoveRejected`.

`inferString` with `allowedValues` can additionally constrain a move *type* to the legal set when needed. This loop is one request → one callback → one state update per turn: easy to reason about, easy to make reliable, easy to demo.

### 3.3 Where `inferToolsChat` genuinely belongs — the intel showcase

`inferToolsChat` is reserved for one optional but high-impact capability: an agent may, before committing a move, spend part of its intel allowance to **call an external MCP server for live market intelligence**. MCP tools are executed automatically by the agent runtime (no resume loop needed for MCP-only tools); on-chain tools yield back via the `finishReason == "tool_calls"` resume loop. Bazaar uses the MCP path so an agent can, for example, consult a live data MCP server and fold the result into its reasoning. This is genuine agent-to-agent / agent-to-tool composition, it is novel, and it is contained to one feature — so the core loop never depends on the hardest primitive. The `inferToolsChat` return shape, for reference: `(string finishReason, string response, string[] updatedRoles, string[] updatedMessages, string[] pendingToolCallIds, bytes[] pendingToolCalls)`.

### 3.4 Agent personas

An agent is defined by a **strategy prompt** (its `system` message) and an optional **strategy hooks contract** (deterministic guardrails — e.g., "never bid above 80% of budget on one lot"). Default personas in the starter kit: *The Hawk* (aggressive accumulator), *The Diplomat* (coalition-seeker), *The Quant* (data-driven, intel-heavy), *The Contrarian* (fades the room). New agents are minted through the registry; anyone enters the ladder by forking the kit and editing one prompt file.

### 3.5 Seasons, stakes, and the money loop

- **Entry.** To enter a match an agent escrows a real STT **entry stake** into the `Treasury`. Default 25 STT per match (sized in §6 to cover agent-platform costs with margin).
- **Prize pool.** Entry stakes form the match pot. Settlement redistributes the pot by final rank (winner-weighted), minus a small **protocol rake** (default 5%) routed to the season fund.
- **Season fund.** Rake accumulates and pays a season-end bonus to the top of the ELO ladder — a real revenue surface, not a cost-saving framing.
- **Exhibition mode.** The contract supports a zero-stake `MatchKind.Exhibition` with identical mechanics and no Treasury interaction. This is the **demo safety valve**: a flawless live run that never depends on faucet timing or one high-variance settlement. Real-stakes league play is the default; the on-stage demo runs an exhibition match live, then shows a recorded real-stakes season for the economic story.

### 3.6 The audit council (second multi-agent layer)

After each match settles, an **audit council** of K agents (default 3, distinct from competitors) independently reviews the match:

- Each auditor receives the full match event log and the revealed lot values.
- Each runs `inferString` constrained to `["clean", "suspect"]` (`allowedValues`), checking for collusion patterns the contract cannot see structurally — e.g., an agent systematically throwing matches to a coalition partner across a season.
- Auditors may use **LLM Parse Website** to confirm a lot's real-world value against an independent source — verifying the JSON API feed was not stale or wrong.
- Because auditors are *expected* to reason independently, the council uses **`Threshold` consensus** (`createAdvancedRequest`): the callback collects all verdicts and the contract applies quorum (2 of 3). A `suspect` quorum freezes the payout pending a human appeal window; a `clean` quorum finalizes it.
- Every auditor verdict and the receipt id of its reasoning is an on-chain event — the auditable trail.

This makes the league trustless end to end: even the integrity check is an agent.

---

## 4. System architecture

### 4.1 Contract topology

Bazaar is a multi-contract system; each contract has one job.

```
                       ┌──────────────────────────┐
                       │  SomniaAgents Platform    │  (external — Somnia-provided)
                       │  createRequest /          │
                       │  createAdvancedRequest    │
                       └───────────▲──────────────┘
                                   │  request / handleResponse callbacks
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐      ┌──────────▼─────────┐      ┌─────────▼────────┐
│ AgentRegistry  │      │   Arena            │      │  AuditCouncil    │
│ - mint agent   │      │ - match lifecycle  │      │ - post-match     │
│   (ERC-721)    │◄─────│ - negotiation loop │─────►│   verdicts       │
│ - persona ref  │      │ - inferChat moves  │      │ - inferString    │
│ - ELO ledger   │      │ - JSON API pricing │      │   (Threshold)    │
│ - discovery    │      │ - rules engine     │      │ - Parse Website  │
└───────┬────────┘      └──────────┬─────────┘      │ - quorum freeze  │
        │                          │                └─────────┬────────┘
        │                 ┌────────▼─────────┐                │
        └────────────────►│   Treasury       │◄───────────────┘
                          │ - entry escrow   │
                          │ - pot + payout   │
                          │ - season fund    │
                          │ - rake + freeze  │
                          └──────────────────┘
                                   ▲
                          ┌────────┴─────────┐
                          │ LeagueScheduler  │
                          │ - Reactivity sub │
                          │ - opens matches  │
                          │   autonomously   │
                          └──────────────────┘
```

### 4.2 Contract responsibilities

**`AgentRegistry`** — Mints agent identities (ERC-721; the NFT *is* the agent). Stores the strategy-prompt pointer (content hash + URI) and optional `strategyHooks` address. Holds the ELO ledger and per-agent stats (matches, win rate, STT P&L). Exposes the **discovery surface**: `listJoinableAgents()` / `getAgent(id)` so any contract or agent can find and reason about competitors — the "agents can discover the system autonomously" rubric line, made literal.

**`Arena`** — Owns match lifecycle: `Open → Pricing → Negotiating → Settling → Audited → Finalized`. On open, requests live data per lot via JSON API Request and commits the sealed value hashes. Runs the negotiation loop: per turn, builds the `inferChat` payload and calls `createRequest`; on callback, validates and applies the move. On settlement, reveals lot values, clears holdings and coalition deals, computes scores, calls `AgentRegistry` to update ELO and `Treasury` to pay out. Emits a granular event per move — the replay data.

**`AuditCouncil`** — Triggered by `Arena` after settlement. Selects K auditors via VRF (Somnia's native VRF). Issues `inferString` requests under `Threshold` consensus; collects verdicts; applies quorum. On a `suspect` quorum, calls `Treasury.freezeMatch`.

**`Treasury`** — Holds entry escrow, computes the pot, routes rake to the season fund, executes rank-weighted payouts, runs the freeze/appeal window. Implements `receive() external payable` (required — rebates land here). `nonReentrant` on payout; checks-effects-interactions throughout.

**`LeagueScheduler`** — Subscribes to Somnia **Reactivity**. When a trigger fires (a match-finalized event, or a scheduled tick), it autonomously opens the next match, seating the highest-ranked joinable agents. This is what makes the league run itself — no cron, no keeper, no human. See §4.5 for the cost reality.

### 4.3 The negotiation move loop (verified flow)

Per agent turn:

1. `Arena` assembles the `inferChat` conversation: `roles = ["system","user"]`, `messages = [personaAndRules, arenaStateAndMoveFormat]`.
2. `Arena` ABI-encodes an `inferChat` call and computes the deposit: `getRequestDeposit() + 0.07 ether * 3` (LLM price × default subcommittee). It calls `createRequest{value: deposit}(LLM_AGENT_ID, address(this), this.handleMove.selector, payload)` and records `pendingRequests[requestId] = matchTurnContext`.
3. Validators run the deterministic LLM; `Majority` consensus yields a byte-identical move string.
4. `handleMove` callback: gate (`msg.sender == platform`, `pendingRequests` set); check `status == Success` and `responses.length > 0`; `abi.decode(responses[0].result, (string))`; parse the move; validate against the rules engine; apply and emit `MoveMade`, or default to `PASS` and emit `MoveDefaulted` / `MoveRejected`.
5. Advance the turn pointer; when the round completes, advance the round; when all rounds complete, transition to `Settling`.

Each turn is exactly one request and one callback. The match state machine advances only inside callbacks — there is no off-chain driver.

### 4.4 Off-chain components (deliberately thin)

Off-chain code does **not** run the league — it only observes and presents. **Indexer:** listens to all contract events, builds a queryable match/replay/ladder database; stateless — anyone can rebuild it from chain. Consider Somnia's documented subgraph support (Ormi or Protofire) instead of hand-rolling. **Arena frontend:** a real-time React/Vite app — live match view, ELO ladder, agent profiles, full match replay from events, audit panel, and an "under the hood" overlay linking each move to its agent receipt. **Agent authoring kit:** the `create-somnia-agent` template (§7). If the indexer and frontend are switched off, the league still plays — that is the proof of autonomy.

### 4.5 Reactivity — the cost reality

On-chain Reactivity subscriptions (via `@somnia-chain/reactivity-contracts`) have a real cost the team must plan for: the subscription **owner contract must hold at least 32 STT** when the subscription is created, and **pays gas for every handler callback**. On-chain wildcard subscriptions are disallowed — the filter must set at least one of `eventTopics` / `origin` / `emitter`. `LeagueScheduler` therefore needs a funded balance and a clear trigger design (react to `Arena`'s `MatchFinalized` event to open the next match). The alternative is an SDK-based cron subscription (cheaper, slightly less "pure on-chain"). **Decide in Phase 0**; for the autonomy story the on-chain path is stronger, so budget the locked 32 STT plus per-callback gas.

---

## 5. Reference contract — the first agent call

The canonical pattern every Bazaar agent call follows, included verbatim in the starter kit as the "hello world." This is a single `inferChat` move decision under `Majority` consensus.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum ConsensusType { Majority, Threshold }
enum ResponseStatus { None, Pending, Success, Failed, TimedOut }

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

/// The LLM agent's inferChat method — multi-turn inference, deterministic output.
interface ILlmAgent {
    function inferChat(
        string[] calldata roles,
        string[] calldata messages,
        bool chainOfThought
    ) external returns (string memory response);
}

/// @notice Minimal showcase: one agent decides one negotiation move.
contract MoveDecider {
    IAgentRequester public constant platform =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776); // Testnet

    uint256 public constant LLM_AGENT_ID = 0;            // set from agents.somnia.network
    uint256 public constant SUBCOMMITTEE_SIZE = 3;       // platform default
    uint256 public constant LLM_PRICE_PER_AGENT = 0.07 ether;

    string public lastMove;
    mapping(uint256 => bool) public pendingRequests;

    event MoveRequested(uint256 indexed requestId);
    event MoveReceived(uint256 indexed requestId, string move);
    event MoveFailed(uint256 indexed requestId, ResponseStatus status);

    /// Ask the on-chain LLM for this agent's next move.
    function requestMove(
        string calldata personaAndRules,
        string calldata arenaState
    ) external payable returns (uint256 requestId) {
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = personaAndRules;
        messages[1] = arenaState;

        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferChat.selector,
            roles,
            messages,
            false // chainOfThought
        );

        // Deposit = operations-reserve floor + per-agent reward × subcommittee.
        // Floor alone => perAgentBudget = 0 => runners skip => timeout.
        uint256 deposit = platform.getRequestDeposit()
                        + LLM_PRICE_PER_AGENT * SUBCOMMITTEE_SIZE;
        require(msg.value >= deposit, "Underfunded");

        requestId = platform.createRequest{value: deposit}(
            LLM_AGENT_ID,
            address(this),
            this.handleMove.selector,
            payload
        );
        pendingRequests[requestId] = true;
        emit MoveRequested(requestId);
    }

    /// Platform callback. Signature is fixed; the name is free.
    function handleMove(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(platform), "Only platform");
        require(pendingRequests[requestId], "Unknown request");
        delete pendingRequests[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            lastMove = abi.decode(responses[0].result, (string));
            emit MoveReceived(requestId, lastMove);
            // Full Arena: parse + validate against the rules engine,
            // then apply the move or default to PASS on invalid input.
        } else {
            emit MoveFailed(requestId, status);
            // Full Arena: apply default PASS, keep the match advancing.
        }
    }

    /// Required — agent-platform rebates are pushed here on finalization.
    receive() external payable {}
}
```

---

## 6. Cost model and economics

Real per-request `msg.value` at the default subcommittee size of 3 (`floor = minPerAgentDeposit × 3 = 0.03 STT`):

| Agent call | Per-agent price | Reward pot (×3) | Practical `msg.value` |
|---|---|---|---|
| JSON API Request | 0.03 STT | 0.09 STT | **0.12 STT** |
| LLM Inference (`inferChat` / `inferString`) | 0.07 STT | 0.21 STT | **0.24 STT** |
| LLM Parse Website | 0.10 STT | 0.30 STT | **0.33 STT** |

Unused funds are rebated, so these are ceilings, not sunk costs — but the contract must *hold* them at request time.

**Per-match cost estimate** (N=4 agents, R=5 rounds, default subcommittee 3):

| Item | Count | Unit | Subtotal |
|---|---|---|---|
| Lot pricing (JSON API) | ~4 lots | 0.12 STT | 0.48 STT |
| Negotiation moves (`inferChat`) | 4 × 5 = 20 turns | 0.24 STT | 4.80 STT |
| `inferToolsChat` intel calls (optional, capped) | ~6 | ~0.24 STT | ~1.44 STT |
| Audit council (`inferString`, Threshold, subcommittee 5) | 3 auditors | ~0.38 STT | ~1.14 STT |
| Audit Parse Website cross-check | ~2 | 0.33 STT | 0.66 STT |
| Reactivity callback gas + base tx gas | — | — | ~1 STT (buffer) |
| **Estimated total per match** | | | **≈ 9.5–11 STT** |

So a **25 STT entry stake per agent** (100 STT pot for a 4-agent match) comfortably covers agent-platform costs, leaves a real prize pool, and funds the 5% rake. Exhibition matches carry the same agent cost with no stake — the team funds those from a dedicated demo wallet. **Plan a testnet STT budget of 400–600 STT** for development, recorded runs, and live demo headroom, plus the 32 STT locked in `LeagueScheduler`. Source STT via the docs faucet and the Somnia Discord `#dev-chat` DevRel request (see §10).

---

## 7. Failure-mode handling (Autonomous Performance)

A league that stalls on one bad agent call is not autonomous. Every failure path has a defined, match-advancing default.

| Failure | Detection | Handling |
|---|---|---|
| Agent request `TimedOut` | callback `status == 4` | Apply default `PASS` for that turn; emit `MoveDefaulted`; continue. Three consecutive timeouts for one agent → that agent forfeits (score = −stake); the match continues. |
| Agent request `Failed` | callback `status == 3` | Same as timeout. The match never blocks on a single agent. |
| LLM returns **illegal move** (bad lot, over budget, wrong phase, unparseable) | rules-engine validation in callback | Reject, apply `PASS`, emit `MoveRejected` with the reason. No penalty beyond the lost turn — bad luck, not fraud. |
| Empty `responses` array on `Success` | `responses.length == 0` check | Treat as a failed turn; default `PASS`. |
| JSON API pricing feed stale / wrong | AuditCouncil cross-check via Parse Website | If the sealed value diverges from an independent source beyond tolerance, match is marked `Voided`; entry stakes refunded; no ELO change. |
| Underfunded deposit | `require` in the request wrapper | Reverts before any state change. The scheduler funds matches from a pre-checked budget; a match cannot open underfunded. |
| Callback griefing (direct call to `handleMove`) | `require(msg.sender == platform)` + `pendingRequests` gate | Reverts. |
| Rebate transfer fails | platform emits `NativeTransferFailed` | `receive()` is implemented on every requester contract; if a rebate still fails it is recoverable via operator coordination — does not block match logic. |
| Reentrancy on payout | checks-effects-interactions + `nonReentrant` on `Treasury` | Payouts computed and recorded before transfers. |
| Audit council inconclusive (no quorum) | quorum logic | Fail-open to `clean` after the appeal window for liveness; the full verdict log stays on-chain for human appeal. |
| `LeagueScheduler` underfunded (<32 STT or out of gas) | balance check before opening a match | Scheduler pauses and emits `SchedulerStalled`; matches already open finish normally; refilling the balance resumes scheduling. |

**Recorded-run discipline:** before submission, run and capture **three full real-stakes seasons** plus **one exhibition match**, archiving every tx hash, the indexer DB, agent receipt ids, and a stdout transcript — in `RECORDED_RUNS.md`.

---

## 8. The starter kit — `create-somnia-agent`

The deliverable that converts the submission into a hireable artifact: a one-command scaffold so any developer can put an agent on the Bazaar ladder.

```
npx create-somnia-agent my-agent
```

Scaffolds:

```
my-agent/
├── persona/
│   └── strategy.md          # the agent's system prompt — edit THIS to compete
├── contracts/
│   ├── StrategyHooks.sol     # optional deterministic guardrails (no-op default)
│   └── interfaces/           # IAgentRequester, ILlmAgent, structs — copied in
├── scripts/
│   ├── mint.ts               # mints the agent NFT in AgentRegistry
│   ├── fund.ts               # funds the agent wallet with STT
│   └── enter.ts              # escrows the stake + joins the next open match
├── test/
│   └── exhibition.test.ts    # runs a local zero-stake match vs default personas
├── .env.example              # RPC, platform address, agent ids
└── README.md                 # 5-minute quickstart
```

The promise: **edit one Markdown file (`strategy.md`), run three commands, and your agent is live on the ladder.** Advanced users add deterministic guardrails in `StrategyHooks.sol`. This is reusable demo infrastructure — what a DevRel team keeps using after the hackathon ends.

---

## 9. Frontend — the Arena

React/Vite, real-time, designed to be screenshot- and video-friendly.

- **Live Match view.** The negotiation log streams turn by turn — each move "spoken" as a line ("The Hawk offers 14 STT for Motif #2"), holdings and budgets updating live, coalition deals drawing a link between two agents. The rewatchable centerpiece.
- **The Ladder.** Live ELO ranking, win rates, season P&L, agent avatars.
- **Agent profiles.** Persona, strategy-prompt hash, full match history, head-to-head records.
- **Replay player.** Scrub any historical match reconstructed entirely from on-chain events — proof the match data is fully on-chain.
- **Audit panel.** Per match, the council's verdicts and the receipt id of each auditor's reasoning, plus the cross-checked real-world source.
- **"Under the hood" overlay.** For any move, show the `createRequest` → `inferChat` → callback flow with the live `requestId`, the tx hash, and a link to the **agent receipt** (`receipts.testnet.agents.somnia.host`). This directly serves the video walkthrough and the technical writeup.

Design language: dark, high-contrast, motion on state changes, built for capture.

---

## 10. Build plan

Phasing, not calendar — sequence each phase end to end before widening.

**Phase 0 — Spike (de-risk the unknowns first).** Deploy the §5 `MoveDecider` to Somnia Testnet. Confirm, with cheap one-call spikes: (a) `inferChat` returns a usable deterministic string under `Majority`; (b) JSON API `fetchUint` pricing works and deposit math is right; (c) `inferString` with `allowedValues` returns a constrained verdict under `Threshold`; (d) `inferToolsChat` with an MCP server URL completes; (e) a minimal Reactivity subscription fires a handler and the 32 STT / per-callback gas cost is confirmed. Pull real agent ids from `agents.somnia.network`. Nothing else proceeds until all five pass.

**Phase 1 — Arena core, single match, exhibition only.** `Arena` + `AgentRegistry` + the rules engine. Hard-coded 4 default personas, zero stakes, no Treasury, no audit. Goal: one full match runs autonomously start to finish on testnet, every move via `inferChat`, every failure path defaulting cleanly.

**Phase 2 — Economics.** `Treasury`: entry escrow, pot, rank-weighted payout, rake, season fund, freeze window. `nonReentrant`, `receive()`. Switch the default match type to real-stakes; keep `Exhibition` as a mode.

**Phase 3 — Audit council.** `AuditCouncil`: VRF auditor selection, `inferString` verdicts under `Threshold`, Parse Website cross-check, quorum freeze. Wire `Arena → AuditCouncil → Treasury`.

**Phase 4 — Autonomy.** `LeagueScheduler` on Reactivity, funded with the locked 32 STT. The league now opens and runs matches with zero human input. Run a multi-match season unattended.

**Phase 5 — Surfaces.** Indexer (evaluate Ormi / Protofire subgraphs), Arena frontend, replay player, the `inferToolsChat` intel showcase, and the `create-somnia-agent` starter kit.

**Phase 6 — Harden + record.** Capture three real-stakes seasons + one exhibition match (`RECORDED_RUNS.md`). Write the technical "under the hood" doc. Record the video walkthrough. Polish the frontend for capture.

**Parallelization:** contracts (Phases 1–4) on one track; indexer + frontend on a second, starting against Phase 1 events; starter kit and docs/video on a third from Phase 2 onward.

---

## 11. Resource map

**Somnia primitives (must-read, all verified):**
- `docs.somnia.network/agents/invoking-agents/from-solidity` — platform interface, structs, callback signature, canonical example.
- `docs.somnia.network/agents/base-agents/llm-inference` — `inferString` / `inferNumber` / `inferChat` / `inferToolsChat` signatures.
- `docs.somnia.network/agents/base-agents/json-api-request` — `fetchUint` / `fetchInt` / `fetchString` etc., dot-notation selectors, decimal scaling.
- `docs.somnia.network/agents/base-agents/llm-parse-website` — website scrape / domain search (pull before building the audit cross-check).
- `docs.somnia.network/agents/invoking-agents/gas-fees` — deposit math, two-pot model, rebate logic.
- `docs.somnia.network/agents/invoking-agents/custom-consensus` — `Majority` vs `Threshold`; confirms deterministic LLM works under `Majority`.
- `docs.somnia.network/agents/invoking-agents/receipts` — receipt format and the testnet/mainnet receipt service URLs.
- `agents.somnia.network` — the live Agent Explorer / code generator; source of the real agent ids and auto-generated Solidity.

**Scheduling and infra:**
- `docs.somnia.network/developer/reactivity/reactivity-onchain` + the Solidity reactivity tutorial + `cron-subscriptions-via-sdk` — for `LeagueScheduler`.
- npm `@somnia-chain/reactivity-contracts` — `SomniaEventHandler`, `SomniaExtensions`.
- `docs.somnia.network/developer/smart-contracts` — critical contract addresses.
- `docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf` — native VRF for audit-council selection.
- `docs.somnia.network/developer/building-dapps/data-indexing-and-querying` — Ormi / Protofire subgraph options for the indexer.

**Network and tooling:**
- Testnet: chain ID 50312, RPC `https://dream-rpc.somnia.network`, explorer `https://shannon-explorer.somnia.network`. Mainnet: chain ID 5031.
- STT: the docs faucet, **and** the Somnia Discord `#dev-chat` (tag DevRel, or email with a project description + GitHub). Requesting STT *and describing Bazaar* to DevRel is a feature given the hiring goal — it puts you on their radar pre-submission.
- Contracts: Foundry (docs default) or Hardhat; the reactivity package targets Solidity `0.8.30`.
- Frontend: React/Vite + viem + a documented wallet kit (RainbowKit / ConnectKit / Privy).

**Reference projects (the calibre bar):** the nine Agentathon-cited GitHub repos — study openDAIO for the multi-agent consensus pattern.

---

## 12. Submission package

1. **Live deployment** — all contracts on Somnia Testnet (and Mainnet if stable), addresses in the README.
2. **Hosted Arena frontend** — a public URL where judges watch a live or replayed match.
3. **`RECORDED_RUNS.md`** — three real-stakes seasons + one exhibition match; every tx hash, indexer snapshot, receipt id, transcript.
4. **`create-somnia-agent` starter kit** — published, with the 5-minute quickstart.
5. **Technical writeup** — "How Bazaar uses the Agentic L1": the `createRequest` / callback flows, the `Majority`-vs-`Threshold` choices, the failure-mode table, the autonomy argument.
6. **Video walkthrough** — scripted: the problem, a live exhibition match, the under-the-hood overlay with a receipt, the starter kit forking an agent onto the ladder in real time.
7. **One-paragraph pitch.**

**Pitch line:** *Bazaar is an autonomous marketplace where AI agents — not humans — own wallets, read the real world, bluff, form coalitions, and settle real STT against each other, entirely inside Somnia's consensus. No keeper, no oracle, no operator. The contract is the referee; the agents are the players; even the integrity check is an agent. It cannot exist on any chain that is not agentic.*

---

## 13. Open questions for Phase 0

Resolve each with a cheap one-call spike before Phase 1.

- **Agent ids.** Pull the live LLM, JSON API, and Parse Website agent ids from `agents.somnia.network` — the docs hard-code only placeholders.
- **`inferChat` determinism in practice.** Confirm that `inferChat` output is byte-identical across a `Majority` subcommittee for a realistic Bazaar prompt — and what prompt size / structure keeps it so. This is the assumption the whole move loop rests on; if it does not hold, fall back to `Threshold` consensus with the contract picking a canonical move (e.g. plurality, or lowest-hash among ties).
- **`inferChat` payload limits.** Find the practical maximum for the `messages` array — the arena state plus negotiation log grows each round and must fit.
- **`inferToolsChat` MCP path.** Confirm an MCP-server tool call completes within one `inferToolsChat` invocation (MCP tools execute automatically; only on-chain tools need the resume loop), and measure latency.
- **Reactivity economics.** Confirm the 32 STT owner-balance requirement and measure per-callback gas for `LeagueScheduler`; decide on-chain subscription vs SDK cron.
- **Audit `Threshold` sizing.** Confirm subcommittee 5 / threshold 3 for the audit council and price the deposit (`getAdvancedRequestDeposit(5) + 0.07 × 5`).
