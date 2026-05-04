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

## MetaMask setup (Hardhat localhost)

Hardhat listens on **`http://127.0.0.1:8545`** with chain ID **`31337`**. MetaMask must use that RPC—not Ethereum mainnet or a testnet—or the frontend cannot read `CONTRACT_ADDRESS` or submit transactions.

### 1. Add a custom network

In MetaMask: **Networks** → **Add network** → **Add a network manually** (wording varies by extension version):

| Field | Value |
|--------|--------|
| Network name | e.g. `Hardhat Local` |
| RPC URL | `127.0.0.1:8545` or `http://127.0.0.1:8545` (MetaMask often stores it without `http://`) |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

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
