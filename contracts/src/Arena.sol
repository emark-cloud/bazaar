// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "./lib/AgentPlatformBase.sol";
import {AgentIds} from "./lib/AgentIds.sol";
import {ILlmAgent} from "./interfaces/ILlmAgent.sol";
import {IJsonApiAgent} from "./interfaces/IJsonApiAgent.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "./interfaces/IAgentPlatform.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {RulesEngine} from "./lib/RulesEngine.sol";
import {PromptLib} from "./lib/PromptLib.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAuditCouncil {
    function beginAudit(
        uint256 matchId,
        uint256[] calldata competitorIds,
        uint256[] calldata rankedAgentIds,
        string[]  calldata lotCategories,
        string[]  calldata lotUrls,
        uint8[]   calldata lotNumPages,
        uint256[] calldata lotFeedValues
    ) external;
}

/// @title Arena — the autonomous negotiation auctioneer
/// @notice One contract owns the full match lifecycle: pricing → negotiating → settling.
/// Every state transition is consensus-driven (lot values from JSON API, moves from inferChat).
/// No off-chain driver; the state machine advances inside the platform's callbacks.
contract Arena is AgentPlatformBase, Ownable {
    AgentRegistry public immutable registry;

    enum MatchKind { Exhibition, RealStakes }
    enum MatchPhase { None, Pricing, Negotiating, Settling, Finalized, Voided }
    /// Why a match ended — emitted in MatchEnded for the indexer/UI.
    /// NoTrade is a draw (nothing sold → voided, refunded, no ELO change).
    enum EndReason { Cap, Stalled, AllForfeited, Reaped, NoTrade }

    /// Input shape for opening a match (caller provides feed config only).
    /// `valueDivisor` maps raw JSON-API value to "lot worth in STT-int" so profit math
    /// is dimensionally consistent with `paidPrice`. `valueHint` is a short string
    /// included in the prompt so agents can bid sensibly (e.g. "typically 70-120").
    struct LotTemplate {
        string  category;          // short label e.g. "ETH-USD" — used in prompts
        string  feedUrl;           // JSON API URL
        string  feedSelector;      // JSON dot-path selector
        uint8   feedDecimals;      // decimals scaling for fetchUint
        uint256 valueDivisor;      // raw value / divisor = effective STT-int worth. Must be ≥ 1.
        string  valueHint;         // prompt-only hint string, e.g. "typically 70-120 STT"
    }

    /// Full on-chain lot state.
    struct Lot {
        string  category;
        string  feedUrl;
        string  feedSelector;
        uint8   feedDecimals;
        uint256 valueDivisor;
        string  valueHint;
        bytes32 valueCommitment;   // keccak256(value, salt) — sealed until settlement
        uint256 revealedValue;     // 0 until reveal — raw value from JSON API
        bool    revealed;
        // Holdings
        uint256 ownerAgentId;      // 0 = unowned, otherwise winning agent
        uint256 paidPrice;         // STT-int price the lot sold at
        uint256 coalitionPartner;  // 0 = solo, else partner agentId
        uint256 standingOfferPrice; // 0 = no standing offer
        uint256 standingOfferBy;   // agent that posted the offer
        bool    standingOfferIsBuy;
    }

    struct Match {
        MatchKind kind;
        MatchPhase phase;
        uint256[] agentIds;        // 4 by default
        uint256[] budget;          // STT-int per agent; parallel to agentIds
        uint8     rounds;          // total
        uint8     currentRound;    // 1..rounds
        uint8     currentTurnIdx;  // index into agentIds
        uint8     numLots;
        uint8     lotsPriced;      // count of lots that returned their JSON API value
        uint8[8]  consecutiveDefaults; // per-agent default streak (max 8 agents)
        bool[8]   forfeited;       // per-agent forfeit flag
        uint256[] pricingRequestIds; // outstanding JSON API requests during Pricing phase
        uint256   openedAt;
        uint256   finalizedAt;
        uint256   lastRequestAt;   // block.timestamp of the most recent platform request fired;
                                   // a match with no callback past lastRequestAt+turnTimeout is reapable
        bool      progressThisRound; // any successful OFFER/COUNTER/COALITION in the current round?
                                     // a full round with none = market stalled → terminate (draw rules apply)
    }

    /// Hard cap on rounds. Matches normally end earlier on a no-progress round; this is the
    /// safety ceiling that bounds duration + worst-case operating cost. Not opener-configurable.
    uint8 public constant MAX_ROUNDS = 20;

    /// In-game bidding budget for real-stakes matches — play money on the lot-value scale, NOT the
    /// wei entry stake (which is the escrow pot, forwarded to Treasury). Agents bid in value-scale
    /// units (the hint range, ~1500-4000), so the budget must share that scale: it keeps score =
    /// worth − paidPrice dimensionally consistent and caps pathological overbids. Mirrors the
    /// exhibition default in frontend chain/writes.ts. Bump if a lot's hint can exceed it.
    uint256 public constant REAL_STAKES_BUDGET = 5000;

    uint256 public nextMatchId = 1;
    mapping(uint256 => Match) internal _matches;
    mapping(uint256 => mapping(uint8 => Lot)) internal _lots; // matchId => lotIndex(0-based) => lot
    /// Compact negotiation log: each entry is one move's prompt-friendly summary. Used to give the
    /// LLM the prior move context so agents can react to each other. Capped per match.
    /// Negotiation log as a fixed-size RING BUFFER per match: holds at most LOG_WINDOW entries,
    /// overwriting the oldest once full, so an agent always sees the most-recent moves (never a
    /// stale frozen window) for matches of any length. `_logCount` tracks total entries ever
    /// pushed, used to find the oldest slot when wrapped.
    mapping(uint256 => string[]) internal _log;
    mapping(uint256 => uint256) internal _logCount;
    /// Ring-buffer capacity = how many recent moves are rendered into a move prompt.
    uint256 internal constant LOG_WINDOW = 24;

    /// pendingRequest context byte layout (we store keccak in pendingRequests, decoded via reqMeta):
    mapping(uint256 => bytes32) internal _reqMatchKey; // requestId => keccak(matchId, kind)

    // Decoded context for in-flight requests
    enum ReqKind { Pricing, Move }
    struct ReqContext {
        ReqKind kind;
        uint256 matchId;
        uint8   lotIndex;          // for Pricing
        uint8   turnIdx;           // for Move
        uint8   roundNumber;       // for Move
    }
    mapping(uint256 => ReqContext) internal _reqContext;

    // --- Events ---------------------------------------------------------------------------

    event MatchOpened(uint256 indexed matchId, MatchKind kind, uint256[] agentIds, uint8 rounds, uint8 numLots);
    event LotPricingRequested(uint256 indexed matchId, uint8 lotIndex, uint256 requestId);
    event LotPriced(uint256 indexed matchId, uint8 lotIndex, bytes32 valueCommitment);
    event NegotiationStarted(uint256 indexed matchId);
    event MoveRequested(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 requestId, uint256 agentId);
    event MoveMade(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string move);
    event MoveDefaulted(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string reason);
    event MoveRejected(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string raw, string reason);
    event CoalitionFormed(uint256 indexed matchId, uint8 lotIndex, uint256 agentA, uint256 agentB, uint256 price);
    event LotSold(uint256 indexed matchId, uint8 lotIndex, uint256 buyerAgentId, uint256 price);
    event AgentForfeited(uint256 indexed matchId, uint256 agentId);
    event LotRevealed(uint256 indexed matchId, uint8 lotIndex, uint256 trueValue);
    event MatchSettled(uint256 indexed matchId, uint256[] agentIds, int256[] scores, uint256 winnerAgentId);
    event WinnerDeclared(uint256 indexed matchId, uint256 indexed winnerAgentId, int256 winnerScore);
    event MatchVoided(uint256 indexed matchId, string reason);
    event MatchReaped(uint256 indexed matchId, MatchPhase phaseAtReap);
    /// Emitted the moment a match terminates, before settlement/void — carries how many rounds
    /// actually played and why it ended (see EndReason). Lets the UI show "ended: market stalled".
    event MatchEnded(uint256 indexed matchId, uint8 roundsPlayed, uint8 reason);

    error InvalidMatch(uint256 matchId);
    error WrongPhase(uint256 matchId, MatchPhase expected, MatchPhase actual);
    error TooFewAgents(uint256 provided);
    error NotJoinable(uint256 agentId);
    error NotStalled(uint256 matchId, uint256 reapableAt);
    error UnaffordableMatch(uint256 operatingBalance, uint256 required);
    // Compact validation errors (4-byte selectors keep Arena under the 24576-byte limit).
    error BadLotCount();
    error NoTreasury();
    error UnderfundedStake();
    error BadDivisor();
    error TimeoutTooLow();
    error CounterNotAhead();

    ITreasury public treasury;
    IAuditCouncil public auditCouncil;
    /// @notice Cap on the forfeit penalty so a forfeited agent's negative score doesn't blow out
    /// the ranking math when budgets are denominated in wei (Phase 2 finding).
    uint256 public forfeitPenalty = 100;

    /// @notice Grace period after a platform request is fired before the match is considered
    /// stalled and may be reaped by anyone. A real consensus round resolves in seconds-to-minutes;
    /// this is the "the callback is never coming" threshold. Owner-tunable.
    uint256 public turnTimeout = 15 minutes;

    event AuditCouncilSet(address council);
    event ForfeitPenaltySet(uint256 penalty);
    event TurnTimeoutSet(uint256 turnTimeout);

    constructor(address platform_, address registry_, address treasury_, address initialOwner)
        AgentPlatformBase(platform_)
        Ownable(initialOwner)
    {
        registry = AgentRegistry(registry_);
        treasury = ITreasury(treasury_);
    }

    function setAuditCouncil(address council) external onlyOwner {
        auditCouncil = IAuditCouncil(council);
        emit AuditCouncilSet(council);
    }

    function setForfeitPenalty(uint256 p) external onlyOwner {
        forfeitPenalty = p;
        emit ForfeitPenaltySet(p);
    }

    /// @notice Tune the stall grace period. Must be long enough that a healthy consensus round
    /// never trips it (≥ a few minutes), short enough that a dead match recovers promptly.
    function setTurnTimeout(uint256 t) external onlyOwner {
        if (t < 1 minutes) revert TimeoutTooLow();
        turnTimeout = t;
        emit TurnTimeoutSet(t);
    }

    /// @notice One-shot match-id bump for when this Arena shares a Treasury with a prior deployment
    /// (matchIds are keys in Treasury._escrows; collisions revert escrowMatch).
    function bumpMatchCounter(uint256 to) external onlyOwner {
        if (to <= nextMatchId) revert CounterNotAhead();
        nextMatchId = to;
    }

    // --- Match lifecycle ------------------------------------------------------------------

    /// @notice Open an exhibition match. Seats the given agents (must be ≥ 2, ≤ 8), seeds budgets,
    /// fires the JSON API pricing for each lot, transitions to Pricing phase.
    function openExhibition(
        uint256[] calldata agentIds,
        uint256 startingBudget,
        LotTemplate[] calldata lotTemplates
    ) external payable returns (uint256 matchId) {
        if (agentIds.length < 2 || agentIds.length > 8) revert TooFewAgents(agentIds.length);
        if (lotTemplates.length < 1 || lotTemplates.length > 8) revert BadLotCount();

        // Affordability precheck: refuse a match the Arena can't pay every platform call for.
        // For exhibition the whole balance (incl. this msg.value) is operating funds.
        uint256 need = _worstCaseOpCost(agentIds.length, MAX_ROUNDS, uint8(lotTemplates.length));
        if (address(this).balance < need) revert UnaffordableMatch(address(this).balance, need);

        matchId = nextMatchId++;
        Match storage m = _matches[matchId];
        m.kind = MatchKind.Exhibition;
        m.phase = MatchPhase.Pricing;
        m.rounds = MAX_ROUNDS;
        m.currentRound = 1;
        m.currentTurnIdx = 0;
        m.numLots = uint8(lotTemplates.length);
        m.openedAt = block.timestamp;
        m.agentIds = agentIds;
        for (uint256 i = 0; i < agentIds.length; i++) {
            AgentRegistry.Agent memory a = registry.getAgent(agentIds[i]);
            if (!a.joinable) revert NotJoinable(agentIds[i]);
            registry.setJoinable(agentIds[i], false);
            m.budget.push(startingBudget);
        }

        _seedLots(matchId, lotTemplates);
        emit MatchOpened(matchId, MatchKind.Exhibition, agentIds, MAX_ROUNDS, m.numLots);
        for (uint8 i = 0; i < m.numLots; i++) {
            _firePricingRequest(matchId, i);
        }
    }

    /// @notice Open a real-stakes match. Caller sends `entryStake × agentIds.length` in msg.value;
    /// the pot is forwarded to Treasury at open. Contract operating funds for agent platform calls
    /// must already be in `address(this).balance` (refill via a plain transfer).
    function openRealStakes(
        uint256[] calldata agentIds,
        uint256 entryStake,
        LotTemplate[] calldata lotTemplates
    ) external payable returns (uint256 matchId) {
        if (agentIds.length < 2 || agentIds.length > 8) revert TooFewAgents(agentIds.length);
        if (lotTemplates.length < 1 || lotTemplates.length > 8) revert BadLotCount();
        if (address(treasury) == address(0)) revert NoTreasury();
        uint256 expected = entryStake * agentIds.length;
        if (msg.value < expected) revert UnderfundedStake();

        // Affordability precheck: the pot (`expected`) is forwarded to Treasury, so only the
        // residual balance is available for platform calls. Refuse if it can't cover the match.
        uint256 need = _worstCaseOpCost(agentIds.length, MAX_ROUNDS, uint8(lotTemplates.length));
        if (address(this).balance - expected < need) revert UnaffordableMatch(address(this).balance - expected, need);

        matchId = nextMatchId++;
        Match storage m = _matches[matchId];
        m.kind = MatchKind.RealStakes;
        m.phase = MatchPhase.Pricing;
        m.rounds = MAX_ROUNDS;
        m.currentRound = 1;
        m.numLots = uint8(lotTemplates.length);
        m.openedAt = block.timestamp;
        m.agentIds = agentIds;

        address[] memory owners = new address[](agentIds.length);
        for (uint256 i = 0; i < agentIds.length; i++) {
            AgentRegistry.Agent memory a = registry.getAgent(agentIds[i]);
            if (!a.joinable) revert NotJoinable(agentIds[i]);
            owners[i] = registry.ownerOf(agentIds[i]);
            registry.setJoinable(agentIds[i], false);
            // Bidding budget is play money on the lot-value scale — decoupled from the wei stake
            // (`entryStake` above funds the escrow pot, not the negotiation). See REAL_STAKES_BUDGET.
            m.budget.push(REAL_STAKES_BUDGET);
        }
        treasury.escrowMatch{value: expected}(matchId, agentIds, owners, entryStake);

        _seedLots(matchId, lotTemplates);
        emit MatchOpened(matchId, MatchKind.RealStakes, agentIds, MAX_ROUNDS, m.numLots);
        for (uint8 i = 0; i < m.numLots; i++) {
            _firePricingRequest(matchId, i);
        }
    }

    function _seedLots(uint256 matchId, LotTemplate[] calldata lotTemplates) internal {
        for (uint8 i = 0; i < lotTemplates.length; i++) {
            if (lotTemplates[i].valueDivisor == 0) revert BadDivisor();
            Lot storage L = _lots[matchId][i];
            L.category = lotTemplates[i].category;
            L.feedUrl = lotTemplates[i].feedUrl;
            L.feedSelector = lotTemplates[i].feedSelector;
            L.feedDecimals = lotTemplates[i].feedDecimals;
            L.valueDivisor = lotTemplates[i].valueDivisor;
            L.valueHint = lotTemplates[i].valueHint;
        }
    }

    function _firePricingRequest(uint256 matchId, uint8 lotIndex) internal {
        Lot storage L = _lots[matchId][lotIndex];
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector, L.feedUrl, L.feedSelector, L.feedDecimals
        );
        uint256 requestId = _send(
            AgentIds.JSON_API_REQUEST,
            this.handlePricing.selector,
            payload,
            AgentIds.PRICE_JSON_API,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            keccak256(abi.encode(matchId, "pricing", lotIndex))
        );
        _reqContext[requestId] = ReqContext({
            kind: ReqKind.Pricing,
            matchId: matchId,
            lotIndex: lotIndex,
            turnIdx: 0,
            roundNumber: 0
        });
        _matches[matchId].pricingRequestIds.push(requestId);
        _matches[matchId].lastRequestAt = block.timestamp;
        emit LotPricingRequested(matchId, lotIndex, requestId);
    }

    /// @notice Callback for JSON API lot pricing. Commits the value (sealed via salt = match+lot).
    function handlePricing(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        ReqContext memory ctx = _reqContext[requestId];
        delete _reqContext[requestId];
        Match storage m = _matches[ctx.matchId];
        // A reap (or void) may have already moved the match out of Pricing — ignore stale callbacks.
        if (m.phase != MatchPhase.Pricing) return;

        uint256 trueValue;
        if (_isSuccess(status, responses)) {
            trueValue = abi.decode(responses[0].result, (uint256));
        } else {
            // void the match on bad feed — keep settlement deterministic
            _void(ctx.matchId, "pricing failed");
            return;
        }

        Lot storage L = _lots[ctx.matchId][ctx.lotIndex];
        bytes32 salt = keccak256(abi.encode(ctx.matchId, ctx.lotIndex, block.chainid));
        L.valueCommitment = keccak256(abi.encode(trueValue, salt));
        // store revealed value too (this is exhibition — we trust commitment to be the same value at settlement)
        L.revealedValue = trueValue;
        emit LotPriced(ctx.matchId, ctx.lotIndex, L.valueCommitment);

        m.lotsPriced += 1;
        if (m.lotsPriced == m.numLots) {
            m.phase = MatchPhase.Negotiating;
            emit NegotiationStarted(ctx.matchId);
            _fireMoveRequest(ctx.matchId);
        }
    }

    // --- Negotiation turn loop ------------------------------------------------------------

    function _fireMoveRequest(uint256 matchId) internal {
        Match storage m = _matches[matchId];
        // skip forfeited agents
        uint8 skipGuard = 0;
        while (m.forfeited[m.currentTurnIdx]) {
            m.currentTurnIdx = (m.currentTurnIdx + 1) % uint8(m.agentIds.length);
            skipGuard++;
            if (skipGuard > 8) { _toSettling(matchId, EndReason.AllForfeited); return; }
        }
        uint256 agentId = m.agentIds[m.currentTurnIdx];

        (string[] memory roles, string[] memory messages) = _buildMovePrompt(matchId, agentId, m);
        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferChat.selector, roles, messages, false
        );

        uint256 requestId = _send(
            AgentIds.LLM_INFERENCE,
            this.handleMove.selector,
            payload,
            AgentIds.PRICE_LLM,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            keccak256(abi.encode(matchId, "move", m.currentRound, m.currentTurnIdx))
        );
        _reqContext[requestId] = ReqContext({
            kind: ReqKind.Move,
            matchId: matchId,
            lotIndex: 0,
            turnIdx: m.currentTurnIdx,
            roundNumber: m.currentRound
        });
        m.lastRequestAt = block.timestamp;
        emit MoveRequested(matchId, m.currentRound, m.currentTurnIdx, requestId, agentId);
    }

    /// Marshal the storage state a move prompt needs into memory and hand off to
    /// PromptLib (external lib — keeps the heavy string-building out of Arena's
    /// bytecode). The log window is the last LOG_WINDOW entries, oldest→newest.
    function _buildMovePrompt(uint256 matchId, uint256 agentId, Match storage m)
        internal view returns (string[] memory roles, string[] memory messages)
    {
        AgentRegistry.Agent memory a = registry.getAgent(agentId);

        PromptLib.Lot[] memory lots = new PromptLib.Lot[](m.numLots);
        for (uint8 i = 0; i < m.numLots; i++) {
            Lot storage L = _lots[matchId][i];
            lots[i] = PromptLib.Lot(
                L.category, L.valueDivisor, L.valueHint,
                L.ownerAgentId, L.paidPrice, L.standingOfferPrice, L.standingOfferBy
            );
        }

        // Read the ring buffer oldest→newest. Before wrapping (count <= window) it's just
        // log[0..count); after wrapping, the oldest entry is at (count % window).
        string[] storage log = _log[matchId];
        uint256 c = _logCount[matchId];
        uint256 len = log.length; // == min(c, LOG_WINDOW)
        uint256 startPos = c <= LOG_WINDOW ? 0 : c % LOG_WINDOW;
        string[] memory window = new string[](len);
        for (uint256 i = 0; i < len; i++) {
            window[i] = log[(startPos + i) % LOG_WINDOW];
        }

        return PromptLib.build(
            a.name, a.promptURI, matchId, m.currentRound, m.rounds, agentId,
            m.agentIds, m.budget, lots, window
        );
    }

    /// Append a move to the per-match ring buffer: grow until LOG_WINDOW, then overwrite the
    /// oldest slot. So the buffer always holds the most-recent LOG_WINDOW moves — never a stale
    /// frozen window — for matches of any length.
    function _logEntry(uint256 matchId, uint256 agentId, string memory action) internal {
        Match storage m = _matches[matchId];
        string memory entry = string.concat("R", _u(m.currentRound), ".T", _u(m.currentTurnIdx), " a", _u(agentId), " ", action);
        string[] storage log = _log[matchId];
        uint256 c = _logCount[matchId]++;
        if (log.length < LOG_WINDOW) {
            log.push(entry);
        } else {
            log[c % LOG_WINDOW] = entry; // overwrite the oldest
        }
    }

    /// @notice Callback for inferChat move generation.
    function handleMove(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        ReqContext memory ctx = _reqContext[requestId];
        delete _reqContext[requestId];
        Match storage m = _matches[ctx.matchId];
        if (m.phase != MatchPhase.Negotiating) return;

        uint256 agentId = m.agentIds[ctx.turnIdx];

        if (!_isSuccess(status, responses)) {
            _applyDefault(ctx.matchId, ctx.turnIdx, agentId, "request failed");
            _advanceTurn(ctx.matchId);
            return;
        }

        string memory raw = abi.decode(responses[0].result, (string));
        (bool ok, string memory reason) = _applyMove(ctx.matchId, agentId, ctx.turnIdx, raw);
        if (ok) {
            emit MoveMade(ctx.matchId, ctx.roundNumber, ctx.turnIdx, agentId, raw);
            _logEntry(ctx.matchId, agentId, raw);
            m.consecutiveDefaults[ctx.turnIdx] = 0;
        } else {
            emit MoveRejected(ctx.matchId, ctx.roundNumber, ctx.turnIdx, agentId, raw, reason);
            _logEntry(ctx.matchId, agentId, string.concat("REJECTED(", reason, ")"));
            _incrementDefault(ctx.matchId, ctx.turnIdx, agentId);
        }
        _advanceTurn(ctx.matchId);
    }

    function _applyDefault(uint256 matchId, uint8 turnIdx, uint256 agentId, string memory reason) internal {
        emit MoveDefaulted(matchId, _matches[matchId].currentRound, turnIdx, agentId, reason);
        _incrementDefault(matchId, turnIdx, agentId);
    }

    function _incrementDefault(uint256 matchId, uint8 turnIdx, uint256 agentId) internal {
        Match storage m = _matches[matchId];
        unchecked { m.consecutiveDefaults[turnIdx] += 1; }
        if (m.consecutiveDefaults[turnIdx] >= 3 && !m.forfeited[turnIdx]) {
            m.forfeited[turnIdx] = true;
            emit AgentForfeited(matchId, agentId);
        }
    }

    function _advanceTurn(uint256 matchId) internal {
        Match storage m = _matches[matchId];
        m.currentTurnIdx = (m.currentTurnIdx + 1) % uint8(m.agentIds.length);
        if (m.currentTurnIdx == 0) {
            // A full round just completed. Termination is emergent: if no agent made a real
            // bid all round, the market has stalled → end now (matches rarely reach the cap).
            if (!m.progressThisRound) {
                _toSettling(matchId, EndReason.Stalled);
                return;
            }
            m.progressThisRound = false; // reset for the next round
            // Safety cap so an endless tiny-increment bidding war can't run forever.
            if (m.currentRound == m.rounds) {
                _toSettling(matchId, EndReason.Cap);
                return;
            }
            unchecked { m.currentRound += 1; }
        }
        // check if all forfeited
        bool anyActive = false;
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (!m.forfeited[i]) { anyActive = true; break; }
        }
        if (!anyActive) { _toSettling(matchId, EndReason.AllForfeited); return; }
        _fireMoveRequest(matchId);
    }

    function _applyMove(uint256 matchId, uint256 agentId, uint8 turnIdx, string memory raw)
        internal returns (bool ok, string memory reason)
    {
        RulesEngine.Move memory mv;
        (mv, ok, reason) = RulesEngine.parse(raw);
        if (!ok) return (false, reason);

        Match storage m = _matches[matchId];

        if (mv.kind == RulesEngine.MoveKind.PASS) {
            return (true, "");
        }

        // All buying/selling/countering refers to a lot
        if (mv.kind == RulesEngine.MoveKind.OFFER || mv.kind == RulesEngine.MoveKind.COUNTER) {
            if (mv.lot == 0 || mv.lot > m.numLots) return (false, "bad lot");
            uint8 lotIdx = uint8(mv.lot - 1);
            Lot storage L = _lots[matchId][lotIdx];

            // BUY path
            if (mv.kind == RulesEngine.MoveKind.OFFER && mv.side == RulesEngine.Side.BUY) {
                if (L.ownerAgentId != 0) return (false, "lot already owned");
                if (mv.price > m.budget[turnIdx]) return (false, "over budget");
                // First bid: take it. Subsequent bids must strictly beat the standing offer
                // (Phase 2 tied-bid quirk: silent no-op replaced with explicit reject).
                if (L.standingOfferPrice == 0) {
                    L.standingOfferPrice = mv.price;
                    L.standingOfferBy = agentId;
                    L.standingOfferIsBuy = true;
                    m.progressThisRound = true; // taking an open lot is real progress
                    return (true, "");
                }
                if (mv.price <= L.standingOfferPrice) return (false, "offer must beat standing");
                L.standingOfferPrice = mv.price;
                L.standingOfferBy = agentId;
                L.standingOfferIsBuy = true;
                m.progressThisRound = true; // a real bid landed → the round made progress
                return (true, "");
            }
            // SELL not applicable in Phase 1 (no inventory transfer); reject
            if (mv.kind == RulesEngine.MoveKind.OFFER && mv.side == RulesEngine.Side.SELL) {
                return (false, "SELL not supported in exhibition");
            }
            // COUNTER: must improve standing offer
            if (mv.kind == RulesEngine.MoveKind.COUNTER) {
                if (L.standingOfferPrice == 0) return (false, "no standing offer to counter");
                if (mv.price <= L.standingOfferPrice) return (false, "counter must improve price");
                if (mv.price > m.budget[turnIdx]) return (false, "over budget");
                L.standingOfferPrice = mv.price;
                L.standingOfferBy = agentId;
                L.standingOfferIsBuy = true;
                m.progressThisRound = true; // a real bid landed → the round made progress
                return (true, "");
            }
        }

        // COALITION: bind to standing offer's lot (simplified Phase 1)
        if (mv.kind == RulesEngine.MoveKind.COALITION) {
            // partner must be one of the seated agents
            bool partnerSeated = false;
            uint8 partnerTurnIdx = 0;
            for (uint256 i = 0; i < m.agentIds.length; i++) {
                if (m.agentIds[i] == mv.partner) { partnerSeated = true; partnerTurnIdx = uint8(i); break; }
            }
            if (!partnerSeated) return (false, "partner not in match");
            if (mv.partner == agentId) return (false, "self-coalition");
            // For Phase 1: coalition just records intent on the lot with the active standing offer from partner
            // Find the partner's standing offer lot (latest)
            uint8 lotIdx = 255;
            for (uint8 i = 0; i < m.numLots; i++) {
                Lot storage Ll = _lots[matchId][i];
                if (Ll.standingOfferBy == mv.partner && Ll.ownerAgentId == 0) { lotIdx = i; break; }
            }
            if (lotIdx == 255) return (false, "partner has no open standing offer");
            Lot storage L = _lots[matchId][lotIdx];
            uint256 share = mv.share == 0 ? 50 : mv.share;
            if (share > 99) return (false, "bad share");
            // commit coalition; final settlement at lot sale time
            L.coalitionPartner = agentId;
            m.progressThisRound = true; // forming a coalition is a state change → progress
            // Track shares via packed uint? Keep simple: 50/50 implied. Future Phase 2 can extend.
            emit CoalitionFormed(matchId, lotIdx, mv.partner, agentId, L.standingOfferPrice);
            return (true, "");
        }

        return (false, "unhandled");
    }

    // --- Settlement -----------------------------------------------------------------------

    function _toSettling(uint256 matchId, EndReason reason) internal {
        Match storage m = _matches[matchId];
        m.phase = MatchPhase.Settling;

        // Resolve any standing offers (last-bidder-wins) since exhibition has no SELL counter
        uint8 sold = 0;
        for (uint8 i = 0; i < m.numLots; i++) {
            Lot storage L = _lots[matchId][i];
            if (L.standingOfferPrice > 0 && L.ownerAgentId == 0) {
                L.ownerAgentId = L.standingOfferBy;
                L.paidPrice = L.standingOfferPrice;
                emit LotSold(matchId, i, L.ownerAgentId, L.paidPrice);
            }
            if (L.ownerAgentId != 0) sold++;
        }

        // Draw-on-no-trade: nothing ever changed hands → no contest. Void it (refund the pot,
        // release the agents, no winner, no ELO churn) rather than crowning a 0-profit seat.
        if (sold == 0) {
            emit MatchEnded(matchId, m.currentRound, uint8(EndReason.NoTrade));
            _void(matchId, "no trades");
            return;
        }

        emit MatchEnded(matchId, m.currentRound, uint8(reason));
        this.settleSelf(matchId);
    }

    /// External self-call trampoline. `_settle` is large; without this the via_ir optimizer inlines
    /// the whole settlement chain at every termination site, blowing Arena past EIP-170. Routing
    /// through an external `this.` call forces `_settle` to be compiled exactly once. Self-only.
    function settleSelf(uint256 matchId) external {
        if (msg.sender != address(this)) revert InvalidMatch(matchId);
        _settle(matchId);
    }

    /// Terminate a match with no settlement: mark Voided, release agents, refund any real-stakes
    /// pot. Shared by the no-trade draw and the pricing-failure/reap paths.
    function _void(uint256 matchId, string memory reason) internal {
        Match storage m = _matches[matchId];
        m.phase = MatchPhase.Voided;
        m.finalizedAt = block.timestamp;
        emit MatchVoided(matchId, reason);
        _releaseAgents(matchId);
        if (m.kind == MatchKind.RealStakes && address(treasury) != address(0)) {
            treasury.refundMatch(matchId);
        }
    }

    function _settle(uint256 matchId) internal {
        Match storage m = _matches[matchId];

        // Reveal all lot values (Phase 1: trust commitment; in Phase 2+ verify against salt)
        int256[] memory scores = new int256[](m.agentIds.length);
        for (uint8 i = 0; i < m.numLots; i++) {
            Lot storage L = _lots[matchId][i];
            if (!L.revealed) {
                L.revealed = true;
                emit LotRevealed(matchId, i, L.revealedValue);
            }
            if (L.ownerAgentId == 0) continue;
            // Profit = effectiveValue - paidPrice  (both in STT-int via valueDivisor normalization)
            uint256 effective = L.valueDivisor == 0 ? L.revealedValue : (L.revealedValue / L.valueDivisor);
            int256 profit = int256(effective) - int256(L.paidPrice);
            if (L.coalitionPartner == 0) {
                _addScore(m.agentIds, scores, L.ownerAgentId, profit);
            } else {
                int256 half = profit / 2;
                _addScore(m.agentIds, scores, L.ownerAgentId, profit - half);
                _addScore(m.agentIds, scores, L.coalitionPartner, half);
            }
        }

        // Apply forfeit penalties — capped (Phase 2 finding: -budget in wei dwarfs realistic profit).
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (m.forfeited[i]) scores[i] -= int256(forfeitPenalty);
        }

        // Pick winner (highest score; tie-break by first index)
        uint256 winnerIdx = 0;
        int256 best = type(int256).min;
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (scores[i] > best) { best = scores[i]; winnerIdx = i; }
        }

        // ELO update + release agents
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            bool win = (i == winnerIdx) && !m.forfeited[i];
            AgentRegistry.Agent memory a = registry.getAgent(m.agentIds[i]);
            uint16 newElo = _elo(a.elo, win);
            registry.recordResult(m.agentIds[i], newElo, win);
            registry.setJoinable(m.agentIds[i], true);
        }
        m.phase = MatchPhase.Finalized;
        m.finalizedAt = block.timestamp;
        emit MatchSettled(matchId, m.agentIds, scores, m.agentIds[winnerIdx]);
        emit WinnerDeclared(matchId, m.agentIds[winnerIdx], scores[winnerIdx]);

        // RealStakes: either route through AuditCouncil (which will gate Treasury.settleMatch),
        // or settle Treasury directly when no AuditCouncil is wired.
        if (m.kind == MatchKind.RealStakes && address(treasury) != address(0)) {
            uint256[] memory ranked = _rankByScore(m.agentIds, scores, m.forfeited);
            if (address(auditCouncil) != address(0)) {
                _beginAudit(matchId, ranked);
            } else {
                treasury.settleMatch(matchId, ranked);
            }
        }
    }

    /// @dev Pack lot metadata for the audit council and trigger `beginAudit`.
    /// Keeps the audit invocation inside the Arena (autonomy), and lets a single Arena upgrade
    /// later swap audit councils without redeploying.
    function _beginAudit(uint256 matchId, uint256[] memory ranked) internal {
        Match storage m = _matches[matchId];
        uint8 n = m.numLots;
        string[]  memory cats     = new string[](n);
        string[]  memory urls     = new string[](n);
        uint8[]   memory pages    = new uint8[](n);
        uint256[] memory feedVals = new uint256[](n);
        for (uint8 i = 0; i < n; i++) {
            Lot storage L = _lots[matchId][i];
            cats[i]     = L.category;
            urls[i]     = L.feedUrl;
            pages[i]    = 1;
            feedVals[i] = L.revealedValue;
        }
        auditCouncil.beginAudit(matchId, m.agentIds, ranked, cats, urls, pages, feedVals);
    }

    /// @dev Sort agentIds by score descending; forfeited agents pushed to the end.
    function _rankByScore(uint256[] storage agentIds, int256[] memory scores, bool[8] storage forfeited)
        internal view returns (uint256[] memory ranked)
    {
        uint256 n = agentIds.length;
        ranked = new uint256[](n);
        int256[] memory sc = new int256[](n);
        bool[] memory ff = new bool[](n);
        for (uint256 i = 0; i < n; i++) {
            ranked[i] = agentIds[i];
            sc[i] = scores[i];
            ff[i] = forfeited[i];
        }
        // simple selection sort (n ≤ 8 — overkill is fine)
        for (uint256 i = 0; i < n; i++) {
            uint256 bestK = i;
            for (uint256 j = i + 1; j < n; j++) {
                // forfeited always ranks below non-forfeited
                if (ff[bestK] && !ff[j]) bestK = j;
                else if (ff[bestK] == ff[j] && sc[j] > sc[bestK]) bestK = j;
            }
            if (bestK != i) {
                (ranked[i], ranked[bestK]) = (ranked[bestK], ranked[i]);
                (sc[i], sc[bestK]) = (sc[bestK], sc[i]);
                (ff[i], ff[bestK]) = (ff[bestK], ff[i]);
            }
        }
    }

    function _addScore(uint256[] storage agentIds, int256[] memory scores, uint256 agentId, int256 delta) internal view {
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (agentIds[i] == agentId) { scores[i] += delta; return; }
        }
    }

    function _elo(uint16 cur, bool win) internal pure returns (uint16) {
        // Simple +24/-12 step for Phase 1; spec'd math is fine for demo.
        if (win) {
            uint256 nx = uint256(cur) + 24;
            return nx > type(uint16).max ? type(uint16).max : uint16(nx);
        } else {
            return cur < 12 ? 0 : cur - 12;
        }
    }

    function _releaseAgents(uint256 matchId) internal {
        Match storage m = _matches[matchId];
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            registry.setJoinable(m.agentIds[i], true);
        }
    }

    // --- Liveness / stall recovery --------------------------------------------------------

    /// @notice Upper bound on operating funds one match can consume: every move and every lot
    /// pricing pays a full deposit (floor + perAgentPrice × subcommittee). Deposits are largely
    /// rebated on callback, so this is conservative — but it guarantees the match can finish.
    function _worstCaseOpCost(uint256 numAgents, uint8 rounds, uint8 numLots)
        internal view returns (uint256)
    {
        uint256 floor = platform.getRequestDeposit();
        uint256 depMove  = floor + AgentIds.PRICE_LLM      * AgentIds.DEFAULT_SUBCOMMITTEE;
        uint256 depPrice = floor + AgentIds.PRICE_JSON_API * AgentIds.DEFAULT_SUBCOMMITTEE;
        return (numAgents * rounds) * depMove + uint256(numLots) * depPrice;
    }

    /// @notice Timestamp after which `reapStalled` may be called for a match (0 = not reapable).
    function reapableAt(uint256 matchId) public view returns (uint256) {
        Match storage m = _matches[matchId];
        if (m.phase != MatchPhase.Pricing && m.phase != MatchPhase.Negotiating) return 0;
        return m.lastRequestAt + turnTimeout;
    }

    /// @notice Permissionless recovery for a match whose platform callback never arrived.
    /// After `turnTimeout` of silence, anyone can force the match to terminate — crucially
    /// WITHOUT firing another platform request, so this works even if the platform is fully down:
    ///   - Pricing  → void the match, refund (real-stakes) and release the agents. No lot ever
    ///     got a value, so there is nothing to settle.
    ///   - Negotiating → settle on the holdings acquired so far (`_toSettling` resolves standing
    ///     offers, reveals, scores, releases agents, and pays out / audits as usual).
    /// Either way the four agents are freed (no permanent brick) and any escrowed pot is resolved.
    function reapStalled(uint256 matchId) external {
        Match storage m = _matches[matchId];
        uint256 deadline = reapableAt(matchId);
        if (deadline == 0 || block.timestamp < deadline) revert NotStalled(matchId, deadline);

        emit MatchReaped(matchId, m.phase);
        if (m.phase == MatchPhase.Pricing) {
            _void(matchId, "pricing failed"); // no lot ever got a value — nothing to settle
        } else {
            // Negotiating: terminate on current holdings. _toSettling resolves standing offers,
            // reveals, scores, releases agents, and pays out / audits without touching the platform.
            _toSettling(matchId, EndReason.Reaped);
        }
    }

    // --- Views ----------------------------------------------------------------------------

    function getMatch(uint256 matchId) external view returns (
        MatchKind kind, MatchPhase phase, uint256[] memory agentIds, uint256[] memory budgets,
        uint8 rounds, uint8 currentRound, uint8 currentTurnIdx, uint8 numLots
    ) {
        Match storage m = _matches[matchId];
        return (m.kind, m.phase, m.agentIds, m.budget, m.rounds, m.currentRound, m.currentTurnIdx, m.numLots);
    }

    function getLot(uint256 matchId, uint8 lotIndex) external view returns (Lot memory) {
        return _lots[matchId][lotIndex];
    }

    // --- Small util -----------------------------------------------------------------------

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bs = new bytes(len);
        while (v != 0) { len--; bs[len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(bs);
    }
}
