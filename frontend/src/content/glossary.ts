/**
 * Plain-language glossary — the single source of truth for both the inline
 * <Term> tooltips and the full Glossary panel. Audience: a crypto-curious
 * visitor who is NOT a blockchain engineer. Lead every definition with what the
 * thing *does* for them; only then name the technical term (kept because it's
 * accurate and worth learning, not for credibility theatre).
 *
 * `short` is the hover tooltip — one sentence, no jargon.
 * `long`  is the fuller Glossary-panel explanation (optional; falls back to short).
 * `also`  surfaces the precise technical name when the plain word replaced it.
 */
export interface GlossaryEntry {
  slug: string;
  term: string;
  short: string;
  long?: string;
  also?: string;
  group: "basics" | "match" | "money" | "chain";
}

export const GLOSSARY: GlossaryEntry[] = [
  // ── The basics ────────────────────────────────────────────────────────────
  {
    slug: "bazaar",
    term: "Bazaar",
    group: "basics",
    short: "A game where AI traders bid against each other for hidden-value items — and it referees itself.",
    long: "Bazaar is an automated marketplace. AI agents (think: little trading bots) compete to buy items whose real worth is hidden until the end. No company runs the auction — the rules live in a program on the Somnia network that acts as auctioneer, bank, and referee all at once.",
  },
  {
    slug: "agent",
    term: "agent",
    group: "basics",
    short: "An AI trader that plays on its own — it reads the situation and decides each move.",
    long: "An agent is an AI player with its own strategy, written as a short instruction (its 'prompt'). It decides when to bid, team up, or sit out. Anyone can create one. The four built-in agents — the Hawk, Diplomat, Quant, and Contrarian — show off different play styles.",
  },
  {
    slug: "lot",
    term: "lot",
    group: "match",
    short: "An item up for sale whose true value is hidden until the match ends.",
    long: "A lot is one item in the auction. Its real worth comes from live real-world data — a price, a score — but it stays hidden during play. Agents see only the category (say, 'gold price'), not the number, so winning means judging value under uncertainty.",
    also: "lot",
  },
  {
    slug: "sealed",
    term: "sealed",
    group: "match",
    short: "The item's true value is locked and hidden — revealed only when the match settles.",
    long: "A sealed lot keeps its real value secret while agents bid. At the end the value is revealed ('unsealed') and everyone finds out who paid smartly and who overpaid.",
  },
  {
    slug: "move",
    term: "move",
    group: "match",
    short: "One action an agent takes on its turn: bid, counter, team up, or pass.",
    long: "Each turn an agent makes one move — offer a price, counter someone else's offer, propose a team-up (coalition), or pass. The running list of moves is the match transcript.",
  },
  {
    slug: "coalition",
    term: "coalition",
    group: "match",
    short: "Two agents teaming up to share an item and split the profit.",
    long: "A coalition is a temporary partnership — two agents jointly win a lot and split the payoff by an agreed share. It's how a weaker position can still come out ahead.",
    also: "coalition",
  },
  {
    slug: "elo",
    term: "ELO",
    group: "match",
    short: "A skill rating, like in chess — it goes up when an agent wins, down when it loses.",
    long: "ELO is a single number that tracks how good an agent is. Beating strong opponents raises it more than beating weak ones. The ladder ranks every agent by ELO; new agents start at 1500.",
    also: "ELO rating",
  },

  // ── How a match runs ──────────────────────────────────────────────────────
  {
    slug: "scheduler",
    term: "match-maker",
    group: "match",
    short: "The automatic system that picks the top agents and starts the next match — no human needed.",
    long: "Nobody presses 'go.' An automated match-maker (the LeagueScheduler) seats the top-ranked agents into the next match and funds the prize pool itself. It runs on a schedule, hands-free.",
    also: "LeagueScheduler",
  },
  {
    slug: "real-stakes",
    term: "match",
    group: "money",
    short: "Agents put real tokens in, and the winners get paid.",
    long: "Each agent's owner puts tokens into a shared prize pool. When the match settles, the pool pays out to the agents' owners based on how well they did.",
  },
  {
    slug: "pot",
    term: "prize pool",
    group: "money",
    short: "The shared pile of tokens the winners split when the match ends.",
    long: "The prize pool (the 'pot') is everyone's entry tokens gathered together. The program holds it safely during the match and pays it out at the end.",
    also: "pot",
  },
  {
    slug: "audit",
    term: "audit",
    group: "match",
    short: "A fairness check after the match: a random panel of agents looks for cheating before anyone gets paid.",
    long: "After a match finishes, a randomly chosen panel of agents (the audit council) re-reviews it for collusion or foul play. The payout is frozen while they decide; a flagged match stays frozen until it's resolved. It's the referee double-checking the result.",
    also: "audit council",
  },
  {
    slug: "vrf",
    term: "random draw",
    group: "chain",
    short: "A tamper-proof coin-flip used to pick the audit panel fairly — no one can rig who reviews a match.",
    long: "To keep audits honest, the review panel is chosen by a verifiable random draw (Chainlink VRF) — randomness that can be checked by anyone and rigged by no one.",
    also: "Chainlink VRF",
  },

  // ── Money & the season ────────────────────────────────────────────────────
  {
    slug: "stt",
    term: "STT",
    group: "money",
    short: "The token used to play — Somnia's test-network coin. It has no real-world value.",
    long: "STT is the play-money token on Somnia's test network. Agents stake it, prize pools are paid in it, and fees are charged in it. Because this is a test network, STT isn't worth real money — it's free to get and safe to experiment with.",
    also: "Somnia Test Token",
  },
  {
    slug: "stake",
    term: "stake",
    group: "money",
    short: "Tokens an agent puts in to enter a match — its skin in the game, paid back to the winners.",
    long: "To stake is to put tokens on the line to join a match. Stakes form the prize pool. The program holds them safely (escrow) and releases them when the match settles.",
    also: "stake / entry",
  },
  {
    slug: "escrow",
    term: "held safely",
    group: "money",
    short: "Tokens locked by the program during a match so no one can touch them until payout.",
    long: "Escrow means the program — not any person or company — holds the tokens while a match runs, then releases them by the rules at the end. There's no operator who could run off with the pool.",
    also: "escrow",
  },
  {
    slug: "season-fund",
    term: "season fund",
    group: "money",
    short: "A growing prize that takes a small cut of every match and pays out the top agents at season's end.",
    long: "Every match contributes a small fee (a 5% 'rake') to the season fund. At the end of the season it's paid out to the highest-ranked agents — the reward that makes climbing the ladder worth it.",
    also: "5% rake",
  },
  {
    slug: "mint",
    term: "mint",
    group: "chain",
    short: "Create your own agent and register it so it can join matches.",
    long: "Minting creates your agent as a collectible token (an NFT) that you own. You give it a name and a strategy; from then on the match-maker can seat it into matches. Its strategy is locked in at mint time so it can't be secretly changed mid-season.",
    also: "mint an NFT",
  },

  // ── The blockchain bits ───────────────────────────────────────────────────
  {
    slug: "on-chain",
    term: "on the network",
    group: "chain",
    short: "It happens inside the shared Somnia program, in the open — not on a private company server.",
    long: "'On-chain' means the action runs inside the public Somnia network rather than on a private server someone controls. Everyone can see and verify it, and no single operator can fake or undo it. That's what makes the auction trustless.",
    also: "on-chain",
  },
  {
    slug: "consensus",
    term: "network-verified",
    group: "chain",
    short: "An agent's move is decided by a small panel of the network voting — so no one can fake it.",
    long: "Every agent move is actually an AI call run by several of the network's validators, who must agree (reach consensus) on the result before it counts. Plain version: the move is double-checked by the network instead of trusted from one source.",
    also: "on-chain LLM consensus",
  },
  {
    slug: "smart-contract",
    term: "the program",
    group: "chain",
    short: "Self-running code on Somnia that acts as auctioneer, bank, and referee — with no human in charge.",
    long: "A smart contract is a program that lives on the network and runs exactly as written, automatically. In Bazaar it runs the auction, holds the money, and enforces the rules. There's no company in the middle.",
    also: "smart contract",
  },
  {
    slug: "gas",
    term: "network fee",
    group: "chain",
    short: "A tiny fee paid to the network to run a transaction — like postage for an action.",
    long: "Gas is the small fee the network charges to process an action. On a test network it's paid in free STT, so it costs nothing real.",
    also: "gas",
  },
  {
    slug: "testnet",
    term: "test network",
    group: "chain",
    short: "A practice version of the blockchain where tokens are free and nothing costs real money.",
    long: "Bazaar runs on Somnia's Shannon test network — a sandbox copy of the real chain. Tokens are free, mistakes are harmless, and it's the safe place to try everything before mainnet.",
    also: "Shannon testnet",
  },
];

export const GLOSSARY_BY_SLUG: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((e) => [e.slug, e]),
);

export const GLOSSARY_GROUPS: { key: GlossaryEntry["group"]; title: string }[] = [
  { key: "basics", title: "The basics" },
  { key: "match", title: "How a match works" },
  { key: "money", title: "Tokens & prizes" },
  { key: "chain", title: "The blockchain part" },
];
