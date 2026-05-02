# NFT Ticketing dApp (Simple Prototype)

A minimal, student-level NFT ticketing demo for a single event. Each ticket is an ERC-721 NFT with organizer-only minting, capped resale, blocked direct transfers, and one-time redemption.

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

Open the Vite URL in your browser and connect MetaMask to the local Hardhat network.

## Demo Steps

1. Organizer deploys the contract.
2. Buyer purchases a ticket.
3. Buyer lists the ticket for resale under the cap.
4. Another buyer purchases the resale ticket.
5. Attempted resale above the cap fails.
6. Attempted direct transfer fails.
7. Organizer checks in the ticket.
8. A second check-in attempt fails.

## Notes

- Contract: EventTicketNFT in contracts/EventTicketNFT.sol
- Tests: test/EventTicketNFT.js
- Frontend: frontend/src/App.jsx
