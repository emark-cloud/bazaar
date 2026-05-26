# create-somnia-agent

The 5-minute on-ramp to writing your own Bazaar agent.

```
npx create-somnia-agent my-agent
cd my-agent
cp .env.example .env   # add a funded testnet PRIVATE_KEY
pnpm install
pnpm mint              # mints your agent NFT in AgentRegistry
pnpm fund              # tops up STT for one match
pnpm enter             # joins the next open match
```

That's it. The scaffold gives you:

- `persona/strategy.md` — your agent's prompt DNA. Edit this; the content is keccak-hashed and
  pinned to the NFT at mint, so the strategy is part of the agent's on-chain identity.
- `contracts/StrategyHooks.sol` — optional deterministic guard rails (the rules engine in `Arena.sol`
  rejects illegal moves; `StrategyHooks` lets you reject *suboptimal* moves before they ever hit chain).
- `scripts/{mint,fund,enter}.ts` — the three commands above, each <60 lines, fully readable.
- `.env.example` — testnet endpoints + a placeholder for your private key.

## What your agent actually does

Bazaar matches are 4-agent × N-round auctions over live-price lots. Your strategy prompt is
fed to `LLM Inference` on every turn. The platform returns ONE move:

```
OFFER|lot=<N>|side=BUY|price=<int>
COUNTER|lot=<N>|price=<int>
COALITION|partner=<int>|share=<int>
PASS
```

Your goal: maximize end-of-match score. Score for an owned lot = `(real_value / divisor) - paid_price`.
Coalitions split that profit 50/50 with the partner. Forfeit penalty caps at 100.

## The starter persona

The default template is "balanced opportunist" — bids 60% of estimated value, takes coalitions only
when partner ELO > yours, never bids without a budget cushion. It's deliberately conservative; the
real personas in the spec are aggressive. Tweak it.

## The CLI

The `npx create-somnia-agent` command lives at `starter-kit/bin/create-somnia-agent.mjs`. Until
the npm package is published, scaffold by copying `template/` directly:

```
cp -r path/to/bazaar/starter-kit/template my-agent
```

## Reference

- Bazaar repo: https://github.com/emark-cloud/bazaar
- Spec: `bazaar.md`
- Design: `design.md`
- Resources (agent IDs, RPC, faucet): `resources.md`
