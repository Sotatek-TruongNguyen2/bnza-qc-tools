# BNZA QC Uniswap tools

Standalone Next.js app for QA/QC on **Base mainnet** (read-only):

1. **Position lookup** — Uniswap V3 LP NFT by `tokenId`
2. **Swap quote** — route comparison + slippage `amountOutMinimum`

Logic mirrors the helper scripts formerly in `bonanzapool` / `contracts/bnza-exbot/scripts/`:

- `query-uniswap-v3-position-base.mjs`
- `quote-uniswap-v3-routes-base.mjs`

No wallet or private key. RPC runs in Next.js API routes.

## Local

```bash
# Node ≥ 22
pnpm install   # or: npm install
pnpm dev       # http://localhost:3099
```

### Env

Copy `.env.example` → `.env.local`:

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
# or
ALCHEMY_API_KEY=your_key
```

If this repo is checked out **next to** a `bonanzapool` monorepo (`../bonanzapool`), `next.config.ts` also loads `BASE_RPC_URL` / `ALCHEMY_API_KEY` from `../bonanzapool/contracts/bnza-exbot/.env` (does not override `.env.local` / Vercel).

Without any of the above, falls back to public Base RPCs (may rate-limit).

## Vercel

1. Import this repo (root = project root — not a monorepo subfolder)
2. Framework: Next.js
3. Env: `BASE_RPC_URL` **or** `ALCHEMY_API_KEY` (Production + Preview)

Shareable URLs:

- `/?tool=position&tokenId=5036939`
- `/?tool=quote&amount=100&tokenIn=USDC&tokenOut=WETH&slippage=0.5`
