// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry — the NFT-as-agent ledger and discovery surface for Bazaar
/// @notice One ERC-721 token per autonomous agent. The token's `tokenId` is the agentId
/// referenced throughout Arena, Treasury, AuditCouncil. Stores the strategy-prompt content
/// hash + URI (the "DNA" anyone can fork), an ELO rating, lifetime stats, and a joinable
/// flag the Arena flips around matches.
///
/// Discovery surface: `listJoinable()` + `getAgent(id)` make the registry the canonical
/// "where are the agents?" answer, so any contract (the LeagueScheduler especially)
/// can seat matches without off-chain coordination.
contract AgentRegistry is ERC721, Ownable {
    uint16 public constant DEFAULT_ELO = 1500;

    struct Agent {
        bytes32 promptHash;     // content hash of the strategy prompt (immutable identity)
        string  promptURI;      // where the prompt lives off-chain (ipfs://..., https://...)
        string  name;           // human-readable, immutable after mint
        uint16  elo;            // current rating
        uint32  matches;        // lifetime matches played
        uint32  wins;           // lifetime wins
        bool    joinable;       // can be seated in a new match
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Agent) internal _agents;

    /// @notice contracts allowed to flip joinable / write ELO + stats (Arena, AuditCouncil, etc.)
    mapping(address => bool) public operators;

    event AgentMinted(uint256 indexed agentId, address indexed owner, bytes32 promptHash, string name, string promptURI);
    event AgentJoinableSet(uint256 indexed agentId, bool joinable);
    event EloUpdated(uint256 indexed agentId, uint16 oldElo, uint16 newElo, bool win);
    event OperatorSet(address indexed operator, bool allowed);

    error NotOperator(address sender);
    error UnknownAgent(uint256 agentId);
    error AgentNotJoinable(uint256 agentId);

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator(msg.sender);
        _;
    }

    constructor(address initialOwner) ERC721("Bazaar Agent", "BZRAGT") Ownable(initialOwner) {}

    // --- Admin (operators) ----------------------------------------------------------------

    /// @notice Owner authorises Arena / AuditCouncil / LeagueScheduler to mutate agent state.
    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    // --- Mint -----------------------------------------------------------------------------

    /// @notice Mint a new agent. Anyone may mint; the caller becomes the owner.
    /// `promptHash` should be `keccak256(promptBytes)` of the strategy file living at `promptURI`.
    function mint(
        address to,
        bytes32 promptHash,
        string calldata promptURI,
        string calldata name_
    ) external returns (uint256 agentId) {
        require(promptHash != bytes32(0), "promptHash=0");
        require(bytes(name_).length > 0 && bytes(name_).length <= 32, "bad name");

        agentId = nextTokenId++;
        _agents[agentId] = Agent({
            promptHash: promptHash,
            promptURI: promptURI,
            name: name_,
            elo: DEFAULT_ELO,
            matches: 0,
            wins: 0,
            joinable: true
        });
        _safeMint(to, agentId);
        emit AgentMinted(agentId, to, promptHash, name_, promptURI);
    }

    // --- Operator hooks -------------------------------------------------------------------

    /// @notice Arena calls this to lock agents when seating them in a match.
    function setJoinable(uint256 agentId, bool joinable) external onlyOperator {
        if (_ownerOf(agentId) == address(0)) revert UnknownAgent(agentId);
        _agents[agentId].joinable = joinable;
        emit AgentJoinableSet(agentId, joinable);
    }

    /// @notice Update an agent's ELO after settlement. Bumps `matches`; bumps `wins` if `win`.
    function recordResult(uint256 agentId, uint16 newElo, bool win) external onlyOperator {
        Agent storage a = _agents[agentId];
        if (_ownerOf(agentId) == address(0)) revert UnknownAgent(agentId);
        uint16 oldElo = a.elo;
        a.elo = newElo;
        unchecked { a.matches += 1; if (win) a.wins += 1; }
        emit EloUpdated(agentId, oldElo, newElo, win);
    }

    // --- Views ----------------------------------------------------------------------------

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        if (_ownerOf(agentId) == address(0)) revert UnknownAgent(agentId);
        return _agents[agentId];
    }

    function totalAgents() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /// @notice Returns up to `max` joinable agent IDs starting after `cursor` (0 = from start).
    /// Pagination keeps the call cheap as the registry grows.
    function listJoinable(uint256 cursor, uint256 max)
        external view returns (uint256[] memory ids, uint256 nextCursor)
    {
        uint256 last = nextTokenId - 1;
        if (cursor >= last) return (new uint256[](0), last);
        uint256[] memory buf = new uint256[](max);
        uint256 count = 0;
        uint256 i = cursor + 1;
        for (; i <= last && count < max; i++) {
            if (_agents[i].joinable && _ownerOf(i) != address(0)) {
                buf[count++] = i;
            }
        }
        ids = new uint256[](count);
        for (uint256 j = 0; j < count; j++) ids[j] = buf[j];
        nextCursor = i - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _agents[tokenId].promptURI;
    }
}
