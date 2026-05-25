# Phase 0.3 — Discord pitch for testnet STT

Send this in the Somnia Discord `#dev-chat` (tag DevRel — docs name `@emreyeth`). Also viable in the Somnia Developer Telegram. Goal: ≥600 STT for development + 32 STT lock for `LeagueScheduler` + demo headroom. Tagging this with the Bazaar elevator pitch is intentional — getting in front of DevRel pre-submission is a feature, not a side effect (Demo Engineer hiring angle).

---

Copy-paste below the line — replace `<WALLET>` with the deployer address from `.env`.

---

Hey @emreyeth / Somnia DevRel — looking for a testnet STT grant for an Agentathon submission.

I'm building **Bazaar** — an autonomous on-chain agent marketplace where smart-contract-owned agents negotiate and auction over lots whose true worth is set by live real-world data. Every move is a consensus-verified `inferChat` call; settlement is fully on-chain; a separate audit council of agents verifies each match's integrity (`Threshold` `inferString`); a `LeagueScheduler` on Reactivity opens matches autonomously.

Multi-agent, fully on-chain end to end, uses three base agents (LLM Inference + JSON API Request + Parse Website) plus VRF and Reactivity. Pitch-line: *the contract is the auctioneer; the agents are the players; even the integrity check is an agent — it cannot exist on any chain that isn't agentic.*

**Budget I need:** ~600 STT for development + recorded seasons, plus 32 STT to lock in the on-chain Reactivity scheduler. Total ~650 STT.

**Wallet:** `<WALLET>` (testnet 50312).

GitHub repo coming online over the next 2 days as Phase 1 lands. Happy to share the design doc + screen-record a Phase-0 spike once it deploys. Also planning a video walkthrough + a `create-somnia-agent` starter kit so the negotiation arena is forkable in 5 minutes.

Thanks 🙏

---

### Notes for ourselves (not part of pitch)

- The DevRel-facing pitch is deliberately the *same* one we'll use in the submission video — practice it.
- If they ask for a deployable demo before granting STT, deploy `MoveDecider` on a fresh dev wallet seeded by the public faucet and link the tx. Faucet caps at ~0.01 STT/day per the docs, but enough for one `MoveDecider` deploy + one self-call.
- Backup channel: Somnia Developer Telegram; same pitch.
- If grant denied: faucet daily + community trading via #general for small amounts. Plan B is to spike everything on a smaller budget and request top-up once the demo is live (success there is the strongest case for the second ask).
