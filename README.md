# NFT Ticketing dApp (Simple Prototype)

A minimal, student-level NFT ticketing demo for a single event. Each ticket is an ERC-721 NFT with organizer-only minting, capped resale, blocked direct transfers, and one-time **holder-initiated** redemption at check-in.

## Requirements

- Node.js 18+
- MetaMask (for frontend demo)

## Install

```bash
npm install
cd frontend
npm install
```

## Local Test + Gas Report

```bash
npm test
npm run gas
```

Gas report output includes minting, resale purchase, and redemption calls.

## Baseline vs. Capped Comparison

The baseline contract (`contracts/BaselineTicketNFT.sol`) and parallel tests (`test/BaselineTicketNFT.js`) are committed alongside `EventTicketNFT`, plus four reproducible scenarios in `scripts/scenarios/` and an gas benchmark in `scripts/bench.js`.

```bash
npm run bench
npm run scenarios
```

The full write-up is in [`docs/comparison.md`](docs/comparison.md).

## Local Demo Flow

### 1) Start local chain

```bash
npm run node
```

### 2) Deploy contract

Open another terminal:

```bash
npm run deploy
```

Copy the deployed address into frontend/src/contract.js as `CONTRACT_ADDRESS`.

### 3) Run the frontend

```bash
cd frontend
npm run dev
```

Open the Vite URL printed by Vite (usually `http://localhost:5173`) in **the same desktop browser** where MetaMask runs.

## Configuring supply, primary price, and resale cap

We tune **ticket supply**, **primary sale price**, and **maximum resale price** once, at deployment. The [`EventTicketNFT`](contracts/EventTicketNFT.sol) constructor takes `maxSupply`, `primaryPrice`, and `resalePriceCap` (in wei) alongside the ERC‑721 `"name"` and `"symbol"`. Those three economic parameters become **`immutable` on-chain**, there is **no setter**, so changing them later means **deploying a new contract** (and updating [`frontend/src/contract.js`](frontend/src/contract.js) with the new address).

Our default deploy script is [`scripts/deploy.js`](scripts/deploy.js). Adjust the literals passed into `EventTicketNFT.deploy`:

| Constructor argument order | Meaning                                                                   | Demo default                |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| 1–2                        | Token name / symbol (`"Event Ticket"`, `"TIX"`)                           | As in script                |
| 3 `maxSupply_`             | Maximum number of NFT tickets that can be minted (`mintTo` + `buyTicket`) | `100`                       |
| 4 `primaryPrice_`          | Exact ETH required per primary `buyTicket` (wei)                          | `ethers.parseEther("0.05")` |
| 5 `resalePriceCap_`        | Highest allowed resale list price (`listForResale` reverts above this)    | `ethers.parseEther("0.08")` |

Hard requirement enforced in Solidity: **`resalePriceCap_` must be ≥ `primaryPrice_`**. If the cap were lower than the face value, the constructor reverts with `ResaleCapTooLow`.

After editing the script, run `npm run deploy` again (with a local node or your target network) and copy the new contract address into the frontend as described above.

## Redemption design: holder-initiated vs organizer-only

In this prototype, **check-in is holder-initiated**: only the **current owner** of a ticket may call `redeem(tokenId)` on [`EventTicketNFT`](contracts/EventTicketNFT.sol). The organizer can still **verify** ownership and redemption status (`ownerOf`, `isRedeemed`) off-chain or from the UI, but they do **not** sign an on-chain “redeem this id” transaction for attendees.

Our [`BaselineTicketNFT`](contracts/BaselineTicketNFT.sol) keeps the contrasting pattern for comparison: **`redeem` is `onlyOrganizer`**, closer to “staff taps a button in the organizer wallet.”

### Why we prefer holder redemption for `EventTicketNFT`

**Reduced blast radius if the organizer’s hot wallet is compromised.** Organizer-only redemption concentrates power in whoever controls `owner()`:

- With **organizer redemption**, anyone who obtains that key, or tricks the organizer into signing malicious transactions, can call `redeem` on **arbitrary ticket ids**. That can **mark legitimate tickets burned/used**, lock holders out of the entry flow encoded in `isRedeemed`, or harass the venue at scale, all **without needing the attendee’s credentials** beyond knowing token ids. Recovery is cumbersome, since ticketing state is irreversibly on-chain for those ids unless the protocol has an admin reversal (ours does not).
- With **holder redemption**, forging “used” state for someone else’s NFT still requires **the holder to sign**, because `redeem` checks `ownerOf(tokenId) == msg.sender`. A stolen **organizer** key remains dangerous for other privileges, but **it cannot unilaterally invalidate every attendee’s ticket** through the redemption path alone.

**Trade-offs.** Organizer-only redemption is operationally simpler for non-crypto gate staff. Holder redemption assumes the attendee brings a signing wallet at entry, which fits this dApp demonstration but adds UX overhead in real venues. Neither model removes **all** operational risk, for example, a compromised organizer key paired with careless mint privileges can still affect supply, so production systems often separate roles, multisigs, hardware keys, or off-chain ticketing systems.

## MetaMask setup (Hardhat localhost)

Hardhat listens on **`http://127.0.0.1:8545`** with chain ID **`31337`**. MetaMask must use that RPC—not Ethereum mainnet or a testnet—or the frontend cannot read `CONTRACT_ADDRESS` or submit transactions.

### 1. Add a custom network

In MetaMask: **Networks** → **Add network** → **Add a network manually** (wording varies by extension version):

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Network name    | e.g. `Hardhat Local`                                                                     |
| RPC URL         | `127.0.0.1:8545` or `http://127.0.0.1:8545` (MetaMask often stores it without `http://`) |
| Chain ID        | `31337`                                                                                  |
| Currency symbol | `ETH`                                                                                    |

Leave the block explorer URL empty for local demos.

MetaMask may warn that **`31337` matches “GoChain Testnet”** or suggests “GO”—you can **ignore that** on a local Hardhat node.

### 2. Import an account that has ETH on this chain

Hardhat prefunds deterministic dev accounts **only on the node started by `npm run node`**.

When **`npm run node`** starts, its terminal prints **Account #0, Account #1, …** and each **Private key**.

1. Stay on networks: select **Hardhat Local** (`31337`).
2. In MetaMask choose **Import account** and paste **one of those printed private keys** (e.g. Account #0).  
   You should see a large **ETH** balance—that is normal test ether, not real money.

Do **not** import a random personal wallet and expect localhost funds unless you’ve sent test ETH there from one of the prefunded Hardhat accounts first.

### 3. Turn on the UI and connect

1. **`npm run node`** (running)
2. **`npm run deploy`** → set `CONTRACT_ADDRESS` in `frontend/src/contract.js`
3. **`cd frontend && npm run dev`** → open the app URL

Click **Connect** in the app and approve MetaMask if prompted; keep the extension on **Hardhat Local**.

### Notes

- **Same machine:** Browser + MetaMask + Hardhat must all see **`127.0.0.1:8545`**. Easiest workflow: **desktop Chrome/Firefox/Edge with MetaMask on the PC that runs Hardhat.** On **MetaMask mobile**, `127.0.0.1` is the phone—not your laptop—unless you deliberately tunnel or host on a LAN IP.
- Restarting **`npm run node`** wipes chain state → run **`npm run deploy`** again and update **`CONTRACT_ADDRESS`**.
- Visiting `http://127.0.0.1:8545` in a normal browser tab shows a JSON-RPC parse error—that is expected; RPC is meant for wallets and apps, not as a webpage.

## Demo Steps

1. Organizer deploys the contract.
2. Buyer purchases a ticket.
3. Buyer lists the ticket for resale under the cap.
4. Another buyer purchases the resale ticket.
5. Attempted resale above the cap fails.
6. Attempted direct transfer fails.
7. **Check-in:** organizer confirms `ownerOf` / `!isRedeemed` (e.g. “View My Ticket Status”), then the **ticket holder** submits **Redeem at gate**; organizer confirms `isRedeemed`.
8. A second redeem (or redeem by someone who does not own the ticket) fails.

## Notes

- Contract: EventTicketNFT in contracts/EventTicketNFT.sol
- Tests: test/EventTicketNFT.js
- Frontend: frontend/src/App.jsx

## AI acknowledgement

We produced this project with assistance from AI-assisted tools for scaffolding, refactoring, explanations, documentation, and debugging suggestions. We reviewed, tested, and edited all generated material before adding it to our codebase.
