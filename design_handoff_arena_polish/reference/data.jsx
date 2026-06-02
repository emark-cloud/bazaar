// data.jsx — mock on-chain state for the Arena kit. Shapes mirror
// frontend/src/chain/types.ts (Agent, MoveEntry, lot tuples). Values are
// illustrative; in production the UI is a pure observer of on-chain reads.

const AGENTS = [
  { id: 1n, name: "Hawk-Prime",      elo: 1714, matches: 41, wins: 19, joinable: true,  promptHash: "0x9f2c…a17e" },
  { id: 2n, name: "Diplomat-01",     elo: 1689, matches: 44, wins: 17, joinable: true,  promptHash: "0x4b81…dd02" },
  { id: 3n, name: "Quant-Theta",     elo: 1652, matches: 39, wins: 14, joinable: true,  promptHash: "0x77a0…9c4f" },
  { id: 4n, name: "Contrarian-9",    elo: 1607, matches: 38, wins: 12, joinable: false, promptHash: "0x1de5…6b33" },
  { id: 5n, name: "Hawk-Reserve",    elo: 1540, matches: 22, wins: 7,  joinable: true,  promptHash: "0xc4f1…2a90" },
  { id: 6n, name: "Mercator",        elo: 1512, matches: 18, wins: 5,  joinable: true,  promptHash: "0x88be…0f71" },
  { id: 7n, name: "Diplomat-Echo",   elo: 1488, matches: 16, wins: 4,  joinable: true,  promptHash: "0x2a3c…e5d8" },
  { id: 8n, name: "Quant-Sigma",     elo: 1455, matches: 13, wins: 3,  joinable: false, promptHash: "0x6f09…b1c2" },
];

// The four competitors in the live match (by id).
const MATCH_AGENT_IDS = [1n, 2n, 3n, 4n];

const BUDGETS = { "1": 38n, "2": 44n, "3": 51n, "4": 29n };

// Lots — abstract assets, real-world value sealed until settlement.
const LOTS = [
  { category: "BTC close", feedUrl: "https://api.coinbase.com/v2/prices/BTC-USD/spot", valueHint: "price feed", revealed: false, revealedValue: 0n,  ownerAgentId: 1n, paidPrice: 14n, standingOfferPrice: 0n, standingOfferBy: 0n, coalitionPartner: 0n },
  { category: "ETH close", feedUrl: "https://api.coinbase.com/v2/prices/ETH-USD/spot", valueHint: "price feed", revealed: false, revealedValue: 0n,  ownerAgentId: 0n, paidPrice: 0n,  standingOfferPrice: 11n, standingOfferBy: 2n, coalitionPartner: 0n },
  { category: "Goal diff", feedUrl: "https://api.football-data.org/v4/matches", valueHint: "fixture", revealed: false, revealedValue: 0n,  ownerAgentId: 2n, paidPrice: 9n,  standingOfferPrice: 0n, standingOfferBy: 0n, coalitionPartner: 3n },
  { category: "Temp °C", feedUrl: "https://api.open-meteo.com/v1/forecast", valueHint: "weather", revealed: false, revealedValue: 0n,  ownerAgentId: 0n, paidPrice: 0n,  standingOfferPrice: 0n, standingOfferBy: 0n, coalitionPartner: 0n },
];

// Revealed values used by the settlement beat (counts up on reveal).
const LOT_REVEALS = [22n, 17n, 13n, 8n];

// Move log — newest is appended last; matches MoveEntry. raw uses |-delimited tokens.
const MOVES = [
  { round: 1, turnIdx: 0, agentId: 1n, kind: "OFFER",     raw: "lot=1|price=12",            requestId: 84512n },
  { round: 1, turnIdx: 1, agentId: 2n, kind: "COUNTER",   raw: "lot=1|price=10",            requestId: 84518n },
  { round: 1, turnIdx: 2, agentId: 3n, kind: "PASS",      raw: "pass",                      requestId: 84524n },
  { round: 1, turnIdx: 3, agentId: 4n, kind: "OFFER",     raw: "lot=4|price=6",             requestId: 84531n },
  { round: 2, turnIdx: 0, agentId: 1n, kind: "OFFER",     raw: "lot=1|price=14",            requestId: 84547n },
  { round: 2, turnIdx: 1, agentId: 2n, kind: "COALITION", raw: "partner=3|share=50|lot=3",  requestId: 84556n },
  { round: 2, turnIdx: 2, agentId: 3n, kind: "OFFER",     raw: "lot=3|price=9",             requestId: 84562n },
  { round: 2, turnIdx: 3, agentId: 4n, kind: "REJECTED",  raw: "lot=4|price=-2",            reason: "negative price", requestId: 84569n },
  { round: 3, turnIdx: 0, agentId: 1n, kind: "OFFER",     raw: "lot=2|price=13",            requestId: 84580n },
  { round: 3, turnIdx: 1, agentId: 2n, kind: "COUNTER",   raw: "lot=2|price=11",            requestId: 84588n },
  { round: 3, turnIdx: 2, agentId: 3n, kind: "DEFAULTED", raw: "",                          reason: "request timed out", requestId: 84594n },
];

// Season + scheduler stats for the chrome.
const SEASON = { fundStt: "182.4", matchesScheduled: 214n, callbacksReceived: 213n, nextMatchId: 15n, current: 14n };

// Per-agent match history — derived from finalized matches. result: win|loss,
// pnl is net STT, opp is the opponent agent id this agent placed against.
const MATCH_HISTORY = {
  "1": [
    { match: 13, result: "win",  pnl: 8,   eloΔ: 14, opp: 2n },
    { match: 11, result: "win",  pnl: 5,   eloΔ: 11, opp: 4n },
    { match: 9,  result: "loss", pnl: -3,  eloΔ: -9, opp: 3n },
    { match: 7,  result: "win",  pnl: 12,  eloΔ: 16, opp: 2n },
    { match: 5,  result: "loss", pnl: -2,  eloΔ: -7, opp: 4n },
  ],
  "2": [
    { match: 13, result: "loss", pnl: 2,   eloΔ: -6, opp: 1n },
    { match: 12, result: "win",  pnl: 9,   eloΔ: 13, opp: 3n },
    { match: 10, result: "win",  pnl: 4,   eloΔ: 10, opp: 4n },
    { match: 8,  result: "loss", pnl: -5,  eloΔ: -11, opp: 1n },
  ],
  "3": [
    { match: 12, result: "loss", pnl: -1,  eloΔ: -8, opp: 2n },
    { match: 10, result: "win",  pnl: 6,   eloΔ: 12, opp: 4n },
    { match: 6,  result: "win",  pnl: 3,   eloΔ: 9,  opp: 1n },
  ],
  "4": [
    { match: 11, result: "loss", pnl: -4,  eloΔ: -10, opp: 1n },
    { match: 10, result: "loss", pnl: -2,  eloΔ: -7,  opp: 3n },
    { match: 6,  result: "win",  pnl: 7,   eloΔ: 13,  opp: 2n },
  ],
};

// ELO trajectory (most recent last) for the profile sparkline.
const ELO_TRACK = {
  "1": [1500, 1512, 1505, 1531, 1540, 1700, 1714],
  "2": [1500, 1496, 1520, 1509, 1540, 1689],
  "3": [1500, 1492, 1518, 1530, 1610, 1652],
  "4": [1500, 1490, 1512, 1525, 1590, 1607],
};

Object.assign(window, {
  AGENTS, MATCH_AGENT_IDS, BUDGETS, LOTS, LOT_REVEALS, MOVES, SEASON,
  MATCH_HISTORY, ELO_TRACK,
});
