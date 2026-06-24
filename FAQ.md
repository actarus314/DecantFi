**English** · [Français](FAQ.fr.md)

# DecantFi — FAQ

Short answers to the questions that come up when running or trusting DecantFi. See the [README](README.md) for the overview.

## Safety & trust

### Does DecantFi ever touch my private key?

No. **It never requests, stores, or handles a private key.** The CLI is read-only and signs nothing. In the web app you connect a wallet (Freighter, xBull, Lobstr, Albedo, Rabet, Hana) and **sign inside that wallet**; the server only relays the transaction you already signed. Before relaying, it checks the transaction is a swap or trustline operation — it cannot be repurposed into anything else.

### Is this financial advice?

No. DecantFi is a **route recommender**: it tells you which venue would net you the most for a given swap, right now. It does not predict prices, manage funds, or decide for you. Verify the transaction in your wallet before signing.

### What is explicitly out of scope (threat model)?

DecantFi is a self-hosted, read-only quoting tool. It does **not** custody funds, hold keys, or move money on your behalf. The main trust surface is the `/api/submit` relay — it is hardened to accept only swap/trustline operations from a transaction you signed, and it adds **no capability** beyond submitting that transaction directly to Horizon yourself. The quoting sources are third parties; a malicious source can at worst make its own route look bad (it is one voice among several, and the winner is re-simulated). Running it publicly is your responsibility — put it behind a reverse proxy with TLS.

## Deployment

### What do I actually need to deploy it?

For **quoting**, nothing mandatory — every source has a keyless path or a public-endpoint default. For **executing** swaps from the web app, your wallet does the signing; the only optional key is `SOROSWAP_API_KEY` (used by the execution path to build Soroswap transactions). All `.env` keys are optional and documented in [`.env.example`](.env.example).

### Where is my data stored?

In a local SQLite database. Control its host location with `DECANTFI_DATA` (default `./data`, e.g. `/docker/decantfi/backend/data` on a server). Nothing is sent to a third party beyond the quoting/RPC requests themselves.

### Which RPC does it use? Can I use my own?

It uses a configurable Stellar RPC (`STELLAR_RPC_URL`) with a public fallback, and Horizon (`STELLAR_HORIZON_URL`). A dedicated provider (e.g. Validation Cloud) is recommended for reliability under load; self-hosting `stellar-rpc` is the long-term option. Public endpoints work for light use.

### How do I expose it to other people safely?

Put it behind a reverse proxy (Caddy or nginx) terminating **TLS**, and keep the app bound to localhost behind it. The app speaks plain HTTP by design and ships per-IP rate-limiting; the reverse proxy adds TLS and is the right place for any additional access control.

### How are dependencies kept up to date?

Dependabot opens PRs (npm, Docker, GitHub Actions); they are merged only after `typecheck` + tests pass — **current, but verified, never blind-merged**. `npm audit --omit=dev` is clean and gates CI.

## Design choices

### Why is "net" the gross amount, with gas shown separately?

Because that is how it actually settles. Swap fees and price impact are taken out of the asset you receive, so they belong in the net. **Gas is paid in XLM**, separately, and varies per transaction — your wallet and any block explorer show it on its own, so DecantFi does too. Folding a fluctuating XLM cost into a USDC/EURC figure would be less accurate, not more.

### Why does EURC have two routes?

There is no deep direct BLND/EURC market, so the best exit to EURC is often **BLND → USDC → EURC** (a composite, two transactions) rather than direct. DecantFi quotes both and keeps whichever nets more. When the same source wins both, the nets are identical and the tool says so rather than inventing a difference.

### Why two probe sizes (250 and 750 BLND)?

Both the winning route and the price impact depend on trade size — a venue that's best for a small exit can lose for a larger one, because price impact grows with the amount you push through a pool. Probing at two representative sizes (250 and 750 BLND) shows how the answer shifts with size, so a single number never misleads you. The live simulator quotes any amount you type; the 250/750 toggle applies to the historical dashboard.

### What is the dual price impact (Local vs EVM)?

For EURC only, price impact is shown two ways (toggle from the column header). **Local** compares against the EURC price on Stellar's SDEX order book — the right reference if you intend to stay on Stellar. **EVM** compares against the global EURC price on Base/Ethereum — the right reference if you intend to bridge out, because then Stellar's premium or discount over the global price becomes a real gain or loss. USDC is identical in both modes. Positive = you receive less, negative = you receive more.

### How is StellarBroker integrated, and why do some sources fail sometimes?

StellarBroker is integrated via its **authenticated WebSocket** (`wss://api.stellar.broker/ws?partner=<key>`). The API key is WS-only — the keyless REST endpoint remains Cloudflare-rate-limited and ignores the key. Quotes are classed on the **estimate** (`estimatedBuyingAmount`), with the realizable SDEX floor shown in the quote detail, because StellarBroker's best price is only achievable through its own execution layer (a multi-route split); routing it yourself yields approximately the floor. StellarBroker's fee is **opaque** (deducted on-chain at execution, per-partner; not disclosed in the quote), and its quote is **not on-chain simulated** — it is an off-chain RFQ over WebSocket. Other sources can fail transiently (timeouts, endpoint hiccups); that is expected, and the aggregator is built to rank fine without any single one.

### Why keep a GPL dependency / keyless routing?

DecantFi reads pool reserves **on-chain and keyless** wherever it can (e.g. Soroswap via `soroswap-router-sdk`), rather than depending on a hosted, keyed API. For a tool whose whole point is to tell you the truth about a swap and keep working when a service is down, on-chain truth is the better foundation — which is why the project is GPL-3 and keeps that dependency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for install, tests, and conventions.
