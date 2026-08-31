# Voltex Coin (VXC) — utility & rewards layer

Voltex Coin is the loyalty and rewards credit that runs across the whole VoltexAI
ecosystem. It is **launched today as an in-app utility credit** — safe, useful, and
carrying no securities or custody risk — and it is **architected to bridge to
Bitcoin and Ethereum** later, when a real on-chain launch clears legal, audit and
registration gates.

> **Important:** VXC is currently an in-app utility & rewards credit — **not a
> security, investment, or on-chain cryptocurrency**. The peg below is a
> loyalty-point rate, not a market price or a promise of cash redemption.

## What an average person gets out of it

| Benefit | Why it matters to everyday users |
|---|---|
| **Earn while you learn & trade** | Daily check-ins, logging trades, finishing Academy lessons and inviting friends all pay VXC — no crypto knowledge needed to start. |
| **Purchase cashback** | Every plan or store purchase pays **5% back in VXC**, boosted for paid tiers (Trader 1.25×, Pro 1.5×, Elite 2×). |
| **Real discounts** | Redeem VXC for up to **30% off** any VoltexAI checkout — subscriptions, courses, tools. Coins turn effort into savings. |
| **Referral income** | Earn **750 VXC** every time a friend joins with your link — stackable with the affiliate program. |
| **One balance, chain-ready** | Built to move on-chain later, so the value you accrue today can migrate to a wallet **you fully own** tomorrow. |
| **Financial inclusion** | Africa-first: earn value without a bank or a card, then spend it inside the ecosystem. |

## Economics

- **Peg (display):** `100 VXC = $1` of in-app value.
- **Cashback:** 5% of purchase value, × plan multiplier.
- **Redemption cap:** coins can cover up to 30% of a checkout.
- **Ledger:** every earn/redeem is an append-only row; a balance is always the
  sum of its entries — auditable and tamper-evident.

## Earn rules (initial)

| Reason | Reward (VXC) | Idempotent |
|---|---|---|
| `signup_bonus` | 500 | once per user |
| `verify_email` | 200 | once |
| `daily_checkin` | 25 | once per day |
| `journal_trade` | 15 | per closed trade |
| `academy_lesson` | 40 | per lesson |
| `referral_signup` | 750 | per referred join |
| `first_purchase` | 300 | once |
| `purchase_cashback` | 5% × plan boost | per purchase |

## The "chain-ready" architecture (dual-protocol)

VXC is designed so an on-chain launch is **additive, not a rewrite**:

- **Ethereum (ERC-20)** — primary settlement. Deploying VXC as a standard ERC-20
  token means it works with every mainstream wallet, DEX and DeFi protocol out of
  the box. The ledger already accounts in ERC-20-style precision (`decimals: 18`).
- **Bitcoin (Wrapped / Lightning)** — VXC can be funded from and settled to BTC via
  a wrapped representation and Lightning payments, combining **Bitcoin's security**
  with **Ethereum's programmability**.
- **Bridge slot** — the ledger row carries a reserved `chain_ref` column so an
  on-chain transaction hash can be stamped against the same off-chain history with
  **no migration**.

### Roadmap (status: `utility_rewards`)

1. **Now — Utility & rewards** *(shipped)*: earn/redeem in-app, cashback, referrals.
2. **Testnet**: deploy the ERC-20 contract to an EVM testnet; mirror balances; audit.
3. **Mainnet (gated)**: legal review + registration + security audit → optional
   on-chain bridge, BTC/ETH funding, self-custody withdrawals.

Steps 2–3 are **explicitly gated** on professional legal counsel and a smart-contract
audit before any real token exists.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/coin/info` | public | What VXC is, the peg, benefits, BTC/ETH roadmap |
| GET | `/api/coin/wallet` | user | Balance, USD value, earn ways, history, chain info |
| POST | `/api/coin/checkin` | user | Claim the once-a-day check-in reward |
| POST | `/api/coin/redeem` | user | Spend VXC for in-app credit |

Wired earn hooks: **signup bonus** (registration) and **purchase cashback +
first-purchase bonus** (payment webhooks, Stripe + Flutterwave, store + plans).
