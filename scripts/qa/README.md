# QA harnesses

Integration / adversarial tests that run against the **live Supabase DB** (they
create test users + rooms and clean up after). They import server-only modules,
so they need the `react-server` import condition.

```bash
set -a; source .env.local; set +a
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/qa/adversary.ts   # security: cheats must be blocked
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/qa/scenarios.ts   # gameplay: bj/bust/double/split/surrender/insurance + ledger
```

- **adversary.ts** — sets up a live round, then tries to cheat as anon, as a
  non-member, and as a logged-in member (read the secret deck, read another
  room's cards, write chips/ledger/hands directly, call privileged RPCs).
  Every attack must report `BLOCKED/OK`.
- **scenarios.ts** — seeds controlled decks to force each rule path through the
  real server engine + RPCs and asserts the outcome + payout + ledger.

Pure rules are covered separately by `npm test` (vitest, no DB).
