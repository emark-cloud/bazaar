// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentPlatformBase} from "./lib/AgentPlatformBase.sol";
import {VRFConsumerBase} from "./lib/VRFConsumerBase.sol";
import {AgentIds} from "./lib/AgentIds.sol";
import {ILlmAgent} from "./interfaces/ILlmAgent.sol";
import {IParseWebsiteAgent} from "./interfaces/IParseWebsiteAgent.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "./interfaces/IAgentPlatform.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title AuditCouncil — autonomous verification of settled matches
/// @notice Three-async-hop audit pipeline:
///   1. Arena calls `beginAudit`; Treasury freezes; VRF request fires.
///   2. `_fulfillRandomWords` picks K auditor agents (excluding competitors) and fans out:
///      - One `inferString` per auditor — `allowedValues=["clean","suspect"]`, Threshold 5/3.
///      - One `ExtractANumber` per lot URL — Threshold 5/3 with on-chain median.
///   3. When all verdicts + parse checks land (or appeal window expires), `_finalize`:
///        suspect quorum  → Treasury.refundMatch
///        clean           → Treasury.unfreezeMatch + Treasury.settleMatch (ranked)
///
/// Parse-Website is non-deterministic (Phase 0.10 finding). The audit aggregates raw responses
/// on-chain: median for numbers, plurality for strings. Per-lot suspect-check trips if
/// `|parseValue - feedValue| / feedValue > 10%`.
contract AuditCouncil is AgentPlatformBase, VRFConsumerBase, Ownable {
    AgentRegistry public immutable registry;
    ITreasury     public immutable treasury;
    address       public arena;

    // --- Tunables (sensible defaults; Owner-settable) ---
    uint8   public auditorsK            = 3;
    uint32  public vrfCallbackGas       = 400_000;
    uint16  public vrfConfirmations     = 3;
    uint256 public verdictSubcommittee  = 5;
    uint256 public verdictThreshold     = 3;
    uint256 public parseSubcommittee    = 5;
    uint256 public parseThreshold       = 3;
    uint256 public appealWindowSeconds  = 5 minutes;
    uint8   public parseConfidenceMin   = 30;     // Parse Website returns confidence_score 0-100
    uint256 public parseToleranceBps    = 1000;   // 10% drift allowed before suspect

    // --- Per-match audit state ---
    enum AuditStatus { None, AwaitingVRF, AwaitingResults, Finalized }

    struct LotCheck {
        string  category;
        string  url;
        uint8   numPages;
        uint256 feedValue;      // raw value Arena recorded for this lot
        uint256 parseValue;     // 0 until aggregated
        bool    complete;
        bool    suspect;        // true if drift > tolerance or unanswerable
    }

    struct Audit {
        AuditStatus status;
        uint256 matchId;
        uint256 vrfRequestId;
        uint256[] competitorIds;
        uint256[] rankedAgentIds;
        uint256[] auditorIds;
        uint8 numAuditors;
        uint8 verdictsDone;
        uint8 verdictsSuspect;
        uint8 verdictsClean;
        uint8 parseChecksDone;
        uint8 parseChecksTotal;
        uint8 parseChecksSuspect;
        uint256 appealUntil;
        // lots stored separately to keep struct in storage slots
    }

    mapping(uint256 => Audit) internal _audits;            // matchId → Audit
    mapping(uint256 => LotCheck[]) internal _lots;         // matchId → checks
    mapping(uint256 => uint256) internal _vrfToMatch;      // vrfReqId → matchId

    enum AuditReqKind { Verdict, ParseCheck }
    struct AuditReqContext {
        AuditReqKind kind;
        uint256 matchId;
        uint8 idx;   // verdict: auditor index in audit.auditorIds; parse: lot index
    }
    mapping(uint256 => AuditReqContext) internal _auditReqCtx;

    // --- Events ---
    event AuditStarted(uint256 indexed matchId, uint256 vrfRequestId, uint256[] competitorIds);
    event AuditorsSelected(uint256 indexed matchId, uint256[] auditorIds);
    event VerdictRequested(uint256 indexed matchId, uint256 indexed auditorId, uint256 requestId);
    event VerdictReceived(uint256 indexed matchId, uint256 indexed auditorId, string verdict);
    event ParseCheckRequested(uint256 indexed matchId, uint8 lotIndex, uint256 requestId);
    event ParseCheckReceived(uint256 indexed matchId, uint8 lotIndex, uint256 parsedValue, bool suspect);
    event AuditFinalized(uint256 indexed matchId, bool suspect, uint8 verdictsSuspect, uint8 verdictsClean, uint8 parseChecksSuspect);
    event AuditTimedOut(uint256 indexed matchId, string action);
    event ArenaSet(address arena);

    error NotArena(address sender);
    error UnknownMatch(uint256 matchId);
    error AlreadyFinalized(uint256 matchId);
    error NoEligibleAuditors();
    error AppealNotReady(uint256 appealUntil);

    constructor(
        address platform_,
        address vrfWrapper_,
        address registry_,
        address treasury_,
        address initialOwner
    )
        AgentPlatformBase(platform_)
        VRFConsumerBase(vrfWrapper_)
        Ownable(initialOwner)
    {
        registry = AgentRegistry(registry_);
        treasury = ITreasury(treasury_);
    }

    // --- Admin -----------------------------------------------------------------------------

    function setArena(address arena_) external onlyOwner { arena = arena_; emit ArenaSet(arena_); }
    function setAuditorsK(uint8 k) external onlyOwner { auditorsK = k; }
    function setVrfParams(uint32 gas, uint16 confs) external onlyOwner {
        vrfCallbackGas = gas; vrfConfirmations = confs;
    }
    function setVerdictParams(uint256 sub, uint256 th) external onlyOwner {
        verdictSubcommittee = sub; verdictThreshold = th;
    }
    function setParseParams(uint256 sub, uint256 th, uint8 conf, uint256 toleranceBps) external onlyOwner {
        parseSubcommittee = sub; parseThreshold = th; parseConfidenceMin = conf; parseToleranceBps = toleranceBps;
    }
    function setAppealWindow(uint256 s) external onlyOwner { appealWindowSeconds = s; }

    /// @notice Top up the contract with STT for VRF + agent platform fees.
    function fund() external payable {}

    /// @notice Withdraw operating funds (owner only). Use sparingly.
    function withdraw(address to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // --- Arena hook ------------------------------------------------------------------------

    /// @notice Arena calls this immediately after `_settle` for RealStakes matches.
    /// Freezes Treasury, fires VRF for K auditors, parks audit state.
    /// `lots[i].feedValue` is the raw JSON-API value Arena recorded — what the audit cross-checks.
    function beginAudit(
        uint256 matchId,
        uint256[] calldata competitorIds,
        uint256[] calldata rankedAgentIds,
        string[]  calldata lotCategories,
        string[]  calldata lotUrls,
        uint8[]   calldata lotNumPages,
        uint256[] calldata lotFeedValues
    ) external {
        if (msg.sender != arena) revert NotArena(msg.sender);
        Audit storage a = _audits[matchId];
        require(a.status == AuditStatus.None, "already audited");
        require(lotUrls.length == lotFeedValues.length && lotUrls.length == lotCategories.length
                && lotUrls.length == lotNumPages.length, "bad lots");

        // Freeze treasury for the appeal window (settlement gated until clean verdict).
        treasury.freezeMatch(matchId, block.timestamp + appealWindowSeconds * 4);

        (uint256 vrfId, ) = _requestRandomnessNative(vrfCallbackGas, vrfConfirmations, auditorsK);

        a.status = AuditStatus.AwaitingVRF;
        a.matchId = matchId;
        a.vrfRequestId = vrfId;
        a.competitorIds = competitorIds;
        a.rankedAgentIds = rankedAgentIds;
        a.numAuditors = auditorsK;
        a.parseChecksTotal = uint8(lotUrls.length);
        a.appealUntil = block.timestamp + appealWindowSeconds;

        for (uint256 i = 0; i < lotUrls.length; i++) {
            _lots[matchId].push(LotCheck({
                category: lotCategories[i],
                url:      lotUrls[i],
                numPages: lotNumPages[i],
                feedValue: lotFeedValues[i],
                parseValue: 0,
                complete: false,
                suspect: false
            }));
        }

        _vrfToMatch[vrfId] = matchId;
        emit AuditStarted(matchId, vrfId, competitorIds);
    }

    // --- VRF callback ----------------------------------------------------------------------

    function _fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 matchId = _vrfToMatch[requestId];
        delete _vrfToMatch[requestId];
        Audit storage a = _audits[matchId];
        if (a.status != AuditStatus.AwaitingVRF) return;

        uint256[] memory auditors = _pickAuditors(a.competitorIds, randomWords);
        if (auditors.length == 0) {
            // No eligible auditors — fail-open clean (very small registries).
            _finalize(matchId, false, "no auditors");
            return;
        }
        a.auditorIds = auditors;
        a.status = AuditStatus.AwaitingResults;
        a.numAuditors = uint8(auditors.length);

        emit AuditorsSelected(matchId, auditors);

        // Fire one verdict request per auditor.
        for (uint256 i = 0; i < auditors.length; i++) {
            _fireVerdict(matchId, uint8(i), auditors[i]);
        }
        // Fire one parse-website cross-check per lot.
        for (uint8 j = 0; j < a.parseChecksTotal; j++) {
            _fireParseCheck(matchId, j);
        }
    }

    // --- Eligible auditor selection -------------------------------------------------------

    /// @dev Pick K auditor agentIds from the registry, excluding competitors. Random words seed
    /// the selection; if pool < K we shrink K. Caps inspection at first 64 minted IDs to keep gas bounded.
    function _pickAuditors(uint256[] storage competitors, uint256[] memory randomWords)
        internal view returns (uint256[] memory picks)
    {
        uint256 total = registry.totalAgents();
        uint256 cap = total > 64 ? 64 : total;

        // Build eligible[] = ids not in competitors and currently owned.
        uint256[] memory eligible = new uint256[](cap);
        uint256 n;
        for (uint256 id = 1; id <= cap; id++) {
            bool isCompetitor = false;
            for (uint256 c = 0; c < competitors.length; c++) {
                if (competitors[c] == id) { isCompetitor = true; break; }
            }
            if (isCompetitor) continue;
            // try/catch on getAgent to skip un-minted IDs
            try registry.getAgent(id) returns (AgentRegistry.Agent memory) {
                eligible[n++] = id;
            } catch { /* skip */ }
        }
        if (n == 0) return new uint256[](0);

        uint256 k = randomWords.length;
        if (k > n) k = n;

        // Shuffle-pick via mod selection without replacement.
        picks = new uint256[](k);
        bool[] memory taken = new bool[](n);
        for (uint256 i = 0; i < k; i++) {
            uint256 r = randomWords[i] % n;
            // linear probe to next free slot
            for (uint256 step = 0; step < n; step++) {
                uint256 slot = (r + step) % n;
                if (!taken[slot]) { taken[slot] = true; picks[i] = eligible[slot]; break; }
            }
        }
    }

    // --- Verdict (inferString) ------------------------------------------------------------

    function _fireVerdict(uint256 matchId, uint8 idx, uint256 auditorId) internal {
        AgentRegistry.Agent memory ag = registry.getAgent(auditorId);

        string memory systemPrompt = string.concat(
            "You are auditor agent \"", ag.name, "\" reviewing a finalized Bazaar match for fraud or manipulation. ",
            "Answer with EXACTLY one word: clean or suspect. ",
            "Output `suspect` only if you would refuse to settle this match given the evidence."
        );
        string memory prompt = _buildAuditPrompt(matchId);

        string[] memory allowed = new string[](2);
        allowed[0] = "clean";
        allowed[1] = "suspect";

        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferString.selector, prompt, systemPrompt, false, allowed
        );

        uint256 requestId = _sendAdvanced(
            AgentIds.LLM_INFERENCE,
            this.handleVerdict.selector,
            payload,
            AgentIds.PRICE_LLM,
            verdictSubcommittee,
            verdictThreshold,
            ConsensusType.Threshold,
            900,
            keccak256(abi.encode(matchId, "verdict", idx))
        );
        _auditReqCtx[requestId] = AuditReqContext({kind: AuditReqKind.Verdict, matchId: matchId, idx: idx});
        emit VerdictRequested(matchId, auditorId, requestId);
    }

    function _buildAuditPrompt(uint256 matchId) internal view returns (string memory) {
        Audit storage a = _audits[matchId];
        LotCheck[] storage L = _lots[matchId];
        bytes memory buf = abi.encodePacked(
            "Match #", _u(matchId), " has been settled. Ranked winners (best first): ["
        );
        for (uint256 i = 0; i < a.rankedAgentIds.length; i++) {
            if (i > 0) buf = abi.encodePacked(buf, ",");
            buf = abi.encodePacked(buf, _u(a.rankedAgentIds[i]));
        }
        buf = abi.encodePacked(buf, "]. Lots and recorded values: ");
        for (uint256 i = 0; i < L.length; i++) {
            if (i > 0) buf = abi.encodePacked(buf, "; ");
            buf = abi.encodePacked(buf, L[i].category, "=", _u(L[i].feedValue));
        }
        buf = abi.encodePacked(buf, ". Did this match settle on reasonable real-world data?");
        return string(buf);
    }

    function handleVerdict(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        AuditReqContext memory ctx = _auditReqCtx[requestId];
        delete _auditReqCtx[requestId];
        Audit storage a = _audits[ctx.matchId];
        if (a.status != AuditStatus.AwaitingResults) return;

        string memory verdict = "clean"; // fail-safe default
        if (_isSuccess(status, responses)) {
            (uint256 cleans, uint256 suspects) = _tallyVerdicts(responses);
            verdict = suspects > cleans ? "suspect" : "clean";
        }
        if (keccak256(bytes(verdict)) == keccak256("suspect")) a.verdictsSuspect++;
        else a.verdictsClean++;
        a.verdictsDone++;

        uint256 auditorId = a.auditorIds[ctx.idx];
        emit VerdictReceived(ctx.matchId, auditorId, verdict);
        _maybeFinalize(ctx.matchId);
    }

    function _tallyVerdicts(Response[] memory responses) internal pure returns (uint256 cleans, uint256 suspects) {
        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status != ResponseStatus.Success) continue;
            string memory v = abi.decode(responses[i].result, (string));
            bytes32 h = keccak256(bytes(v));
            if (h == keccak256("clean")) cleans++;
            else if (h == keccak256("suspect")) suspects++;
        }
    }

    // --- Parse Website cross-check --------------------------------------------------------

    function _fireParseCheck(uint256 matchId, uint8 lotIdx) internal {
        LotCheck storage L = _lots[matchId][lotIdx];

        string memory question = string.concat(
            "What is the current ", L.category, " value as a single integer?"
        );

        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractANumber.selector,
            L.category,                  // key
            "current real-world numeric value",   // description
            uint256(0),                  // min
            uint256(1_000_000_000),      // max
            question,                    // prompt
            L.url,                       // url
            false,                       // resolveUrl
            L.numPages,                  // numPages
            parseConfidenceMin           // confidenceThreshold
        );

        uint256 requestId = _sendAdvanced(
            AgentIds.LLM_PARSE_WEBSITE,
            this.handleParseCheck.selector,
            payload,
            AgentIds.PRICE_PARSE_WEBSITE,
            parseSubcommittee,
            parseThreshold,
            ConsensusType.Threshold,
            900,
            keccak256(abi.encode(matchId, "parse", lotIdx))
        );
        _auditReqCtx[requestId] = AuditReqContext({kind: AuditReqKind.ParseCheck, matchId: matchId, idx: lotIdx});
        emit ParseCheckRequested(matchId, lotIdx, requestId);
    }

    function handleParseCheck(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        AuditReqContext memory ctx = _auditReqCtx[requestId];
        delete _auditReqCtx[requestId];
        Audit storage a = _audits[ctx.matchId];
        if (a.status != AuditStatus.AwaitingResults) return;

        LotCheck storage L = _lots[ctx.matchId][ctx.idx];
        bool suspect = true; // fail-open at the end if all-suspect; but per-lot we default to suspect on failure
        uint256 parsed;
        if (_isSuccess(status, responses)) {
            parsed = _medianUint(responses);
            L.parseValue = parsed;
            // suspect if drift > tolerance bps (or feed=0 which we don't expect)
            if (L.feedValue == 0) {
                suspect = parsed != 0;
            } else {
                uint256 hi = parsed > L.feedValue ? parsed : L.feedValue;
                uint256 lo = parsed > L.feedValue ? L.feedValue : parsed;
                uint256 driftBps = ((hi - lo) * 10_000) / L.feedValue;
                suspect = driftBps > parseToleranceBps;
            }
        }
        L.complete = true;
        L.suspect = suspect;
        if (suspect) a.parseChecksSuspect++;
        a.parseChecksDone++;
        emit ParseCheckReceived(ctx.matchId, ctx.idx, parsed, suspect);
        _maybeFinalize(ctx.matchId);
    }

    /// @dev On-chain median across the successful responses. Cheap insertion sort (n ≤ 5).
    function _medianUint(Response[] memory responses) internal pure returns (uint256) {
        uint256[] memory vs = new uint256[](responses.length);
        uint256 n;
        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status != ResponseStatus.Success) continue;
            vs[n++] = abi.decode(responses[i].result, (uint256));
        }
        if (n == 0) return 0;
        // insertion sort the first n
        for (uint256 i = 1; i < n; i++) {
            uint256 key = vs[i];
            uint256 j = i;
            while (j > 0 && vs[j - 1] > key) { vs[j] = vs[j - 1]; j--; }
            vs[j] = key;
        }
        return vs[n / 2]; // upper median on even counts
    }

    // --- Finalization ---------------------------------------------------------------------

    function _maybeFinalize(uint256 matchId) internal {
        Audit storage a = _audits[matchId];
        if (a.status != AuditStatus.AwaitingResults) return;
        if (a.verdictsDone < a.numAuditors) return;
        if (a.parseChecksDone < a.parseChecksTotal) return;

        // Quorum: 2-of-3 verdicts suspect, OR any parse-check suspect ⇒ suspect overall.
        bool suspectQuorum = (a.verdictsSuspect * 2 >= uint256(a.numAuditors))
                          || (a.parseChecksSuspect > 0);

        _finalize(matchId, suspectQuorum, "complete");
    }

    function _finalize(uint256 matchId, bool suspect, string memory reason) internal {
        Audit storage a = _audits[matchId];
        if (a.status == AuditStatus.Finalized) return;
        a.status = AuditStatus.Finalized;

        if (suspect) {
            // Treasury still frozen for the appeal window — refund the entrants.
            treasury.refundMatch(matchId);
        } else {
            treasury.unfreezeMatch(matchId);
            treasury.settleMatch(matchId, a.rankedAgentIds);
        }
        emit AuditFinalized(matchId, suspect, a.verdictsSuspect, a.verdictsClean, a.parseChecksSuspect);
        reason;
    }

    /// @notice Anyone can flush a stuck audit past the appeal window with fail-open `clean`.
    /// Keeps the protocol live if VRF or agents are slow.
    function appealTimeout(uint256 matchId) external {
        Audit storage a = _audits[matchId];
        if (a.status == AuditStatus.Finalized) revert AlreadyFinalized(matchId);
        if (a.status == AuditStatus.None) revert UnknownMatch(matchId);
        if (block.timestamp < a.appealUntil) revert AppealNotReady(a.appealUntil);

        emit AuditTimedOut(matchId, a.status == AuditStatus.AwaitingVRF ? "vrf" : "results");
        _finalize(matchId, false, "appeal-timeout");
    }

    // --- Views ----------------------------------------------------------------------------

    function getAudit(uint256 matchId) external view returns (
        AuditStatus status,
        uint256 vrfRequestId,
        uint256[] memory auditorIds,
        uint8 verdictsDone,
        uint8 verdictsSuspect,
        uint8 verdictsClean,
        uint8 parseChecksDone,
        uint8 parseChecksSuspect,
        uint256 appealUntil
    ) {
        Audit storage a = _audits[matchId];
        return (
            a.status, a.vrfRequestId, a.auditorIds,
            a.verdictsDone, a.verdictsSuspect, a.verdictsClean,
            a.parseChecksDone, a.parseChecksSuspect, a.appealUntil
        );
    }

    function getLotCheck(uint256 matchId, uint8 idx) external view returns (LotCheck memory) {
        return _lots[matchId][idx];
    }

    // --- Util -----------------------------------------------------------------------------

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bs = new bytes(len);
        while (v != 0) { len--; bs[len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(bs);
    }
}
