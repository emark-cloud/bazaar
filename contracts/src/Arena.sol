// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "./lib/AgentPlatformBase.sol";
import {AgentIds} from "./lib/AgentIds.sol";
import {ILlmAgent} from "./interfaces/ILlmAgent.sol";
import {IJsonApiAgent} from "./interfaces/IJsonApiAgent.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "./interfaces/IAgentPlatform.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {RulesEngine} from "./lib/RulesEngine.sol";

/// @title Arena — the autonomous negotiation auctioneer
/// @notice One contract owns the full match lifecycle: pricing → negotiating → settling.
/// Every state transition is consensus-driven (lot values from JSON API, moves from inferChat).
/// No off-chain driver; the state machine advances inside the platform's callbacks.
contract Arena is AgentPlatformBase {
    AgentRegistry public immutable registry;

    enum MatchKind { Exhibition, RealStakes }
    enum MatchPhase { None, Pricing, Negotiating, Settling, Finalized, Voided }

    /// Input shape for opening a match (caller provides feed config only).
    struct LotTemplate {
        string  category;          // short label e.g. "ETH-USD x100" — used in prompts
        string  feedUrl;           // JSON API URL
        string  feedSelector;      // JSON dot-path selector
        uint8   feedDecimals;      // decimals scaling for fetchUint
    }

    /// Full on-chain lot state.
    struct Lot {
        string  category;
        string  feedUrl;
        string  feedSelector;
        uint8   feedDecimals;
        bytes32 valueCommitment;   // keccak256(value, salt) — sealed until settlement
        uint256 revealedValue;     // 0 until reveal
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
    }

    uint256 public nextMatchId = 1;
    mapping(uint256 => Match) internal _matches;
    mapping(uint256 => mapping(uint8 => Lot)) internal _lots; // matchId => lotIndex(0-based) => lot

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
    event MatchVoided(uint256 indexed matchId, string reason);

    error InvalidMatch(uint256 matchId);
    error WrongPhase(uint256 matchId, MatchPhase expected, MatchPhase actual);
    error TooFewAgents(uint256 provided);
    error NotJoinable(uint256 agentId);

    constructor(address platform_, address registry_) AgentPlatformBase(platform_) {
        registry = AgentRegistry(registry_);
    }

    // --- Match lifecycle ------------------------------------------------------------------

    /// @notice Open an exhibition match. Seats the given agents (must be ≥ 2, ≤ 8), seeds budgets,
    /// fires the JSON API pricing for each lot, transitions to Pricing phase.
    function openExhibition(
        uint256[] calldata agentIds,
        uint256 startingBudget,
        uint8 rounds,
        LotTemplate[] calldata lotTemplates
    ) external payable returns (uint256 matchId) {
        if (agentIds.length < 2 || agentIds.length > 8) revert TooFewAgents(agentIds.length);
        require(lotTemplates.length >= 1 && lotTemplates.length <= 8, "1..8 lots");
        require(rounds >= 1 && rounds <= 16, "1..16 rounds");

        matchId = nextMatchId++;
        Match storage m = _matches[matchId];
        m.kind = MatchKind.Exhibition;
        m.phase = MatchPhase.Pricing;
        m.rounds = rounds;
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

        // Seed lots (templates carry feed config; valueCommitment filled in by callbacks)
        for (uint8 i = 0; i < lotTemplates.length; i++) {
            Lot storage L = _lots[matchId][i];
            L.category = lotTemplates[i].category;
            L.feedUrl = lotTemplates[i].feedUrl;
            L.feedSelector = lotTemplates[i].feedSelector;
            L.feedDecimals = lotTemplates[i].feedDecimals;
        }

        emit MatchOpened(matchId, MatchKind.Exhibition, agentIds, rounds, m.numLots);

        // Fire JSON API pricing requests
        for (uint8 i = 0; i < m.numLots; i++) {
            _firePricingRequest(matchId, i);
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

        uint256 trueValue;
        if (_isSuccess(status, responses)) {
            trueValue = abi.decode(responses[0].result, (uint256));
        } else {
            // void the match on bad feed — keep settlement deterministic
            m.phase = MatchPhase.Voided;
            emit MatchVoided(ctx.matchId, "pricing failed");
            _releaseAgents(ctx.matchId);
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
            if (skipGuard > 8) { _toSettling(matchId); return; }
        }
        uint256 agentId = m.agentIds[m.currentTurnIdx];

        (string[] memory roles, string[] memory messages) = _buildPrompt(matchId, agentId);
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
        emit MoveRequested(matchId, m.currentRound, m.currentTurnIdx, requestId, agentId);
    }

    function _buildPrompt(uint256 matchId, uint256 agentId)
        internal view returns (string[] memory roles, string[] memory messages)
    {
        AgentRegistry.Agent memory a = registry.getAgent(agentId);
        roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";
        messages = new string[](2);
        messages[0] = string.concat(
            "You are agent \"", a.name, "\" in Bazaar.\n",
            "Strategy ref: ", a.promptURI, "\n",
            "Output EXACTLY one move, no prose:\n",
            "  OFFER|lot=<N>|side=BUY|price=<int_STT>\n",
            "  OFFER|lot=<N>|side=SELL|price=<int_STT>\n",
            "  COUNTER|lot=<N>|price=<int_STT>\n",
            "  COALITION|partner=<agentId>|share=<int_pct>\n",
            "  PASS\n",
            "Lot indices are 1-based. Bid only within your budget."
        );
        // Phase-1 simplified state: budget + round + lot list (no full negotiation log yet for size sanity).
        // TODO Phase 1: extend with negotiation log once we've validated determinism at scale.
        messages[1] = _renderState(matchId, agentId);
    }

    function _renderState(uint256 matchId, uint256 agentId) internal view returns (string memory) {
        Match storage m = _matches[matchId];
        // Find this agent's budget
        uint256 budget;
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (m.agentIds[i] == agentId) { budget = m.budget[i]; break; }
        }
        bytes memory buf = abi.encodePacked(
            "Round ", _u(m.currentRound), " of ", _u(m.rounds),
            ". Budget=", _u(budget), " STT.\nLots:\n"
        );
        for (uint8 i = 0; i < m.numLots; i++) {
            Lot storage L = _lots[matchId][i];
            string memory status = L.ownerAgentId == 0 ? " status=unowned" : " status=sold";
            buf = abi.encodePacked(buf, "  ", _u(uint256(i)+1), " category=", L.category, status, "\n");
        }
        buf = abi.encodePacked(buf, "Your turn. Choose a move.");
        return string(buf);
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
            m.consecutiveDefaults[ctx.turnIdx] = 0;
        } else {
            emit MoveRejected(ctx.matchId, ctx.roundNumber, ctx.turnIdx, agentId, raw, reason);
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
            // round complete
            if (m.currentRound == m.rounds) {
                _toSettling(matchId);
                return;
            }
            unchecked { m.currentRound += 1; }
        }
        // check if all forfeited
        bool anyActive = false;
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (!m.forfeited[i]) { anyActive = true; break; }
        }
        if (!anyActive) { _toSettling(matchId); return; }
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
                // settle immediately if no standing offer or this beats it
                if (L.standingOfferPrice == 0 || mv.price > L.standingOfferPrice) {
                    L.standingOfferPrice = mv.price;
                    L.standingOfferBy = agentId;
                    L.standingOfferIsBuy = true;
                }
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
            // Track shares via packed uint? Keep simple: 50/50 implied. Future Phase 2 can extend.
            emit CoalitionFormed(matchId, lotIdx, mv.partner, agentId, L.standingOfferPrice);
            return (true, "");
        }

        return (false, "unhandled");
    }

    // --- Settlement -----------------------------------------------------------------------

    function _toSettling(uint256 matchId) internal {
        Match storage m = _matches[matchId];
        m.phase = MatchPhase.Settling;

        // Resolve any standing offers (last-bidder-wins) since exhibition has no SELL counter
        for (uint8 i = 0; i < m.numLots; i++) {
            Lot storage L = _lots[matchId][i];
            if (L.standingOfferPrice > 0 && L.ownerAgentId == 0) {
                L.ownerAgentId = L.standingOfferBy;
                L.paidPrice = L.standingOfferPrice;
                emit LotSold(matchId, i, L.ownerAgentId, L.paidPrice);
            }
        }

        _settle(matchId);
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
            // Profit = revealedValue - paidPrice
            int256 profit = int256(L.revealedValue) - int256(L.paidPrice);
            if (L.coalitionPartner == 0) {
                _addScore(m.agentIds, scores, L.ownerAgentId, profit);
            } else {
                int256 half = profit / 2;
                _addScore(m.agentIds, scores, L.ownerAgentId, profit - half);
                _addScore(m.agentIds, scores, L.coalitionPartner, half);
            }
        }

        // Apply forfeit penalties (Phase 1: -entry-stake-equivalent; we use starting budget as proxy)
        for (uint256 i = 0; i < m.agentIds.length; i++) {
            if (m.forfeited[i]) scores[i] -= int256(m.budget[i]);
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
