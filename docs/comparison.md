# Baseline ERC-721 vs. Capped EventTicketNFT

This is the comparison the proposal asked for: an unrestricted ERC-721 ticket against the capped resale design we actually built.

The two contracts live side by side in `contracts/`:

- `BaselineTicketNFT.sol` — same primary sale and redemption surface as the capped contract, but no transfer hook, no listing, and no resale cap.
- `EventTicketNFT.sol` — adds the transfer hook, the on-chain listing, the atomic `buyResale` path, and the price cap.

To reproduce everything below:

```bash
npm test          # 22 unit tests across both contracts
npm run gas       # per-method gas table from hardhat-gas-reporter
npm run bench     # the apples-to-apples gas table used in §3
npm run scenarios # the side-by-side adversarial scripts quoted in §2
```

---

## 1. What's actually different

We kept `mintTo`, `buyTicket`, `redeem`, `isRedeemed`, the organizer-only modifier, and the `totalMinted`/`maxSupply` bookkeeping identical between the two contracts. That was deliberate: it means any difference we observe later has to be coming from the resale policy and not from something else.

The four things the capped contract adds:

1. **A transfer hook.** `EventTicketNFT` overrides `_beforeTokenTransfer` and reverts every non-mint, non-burn transfer unless an internal `_transferAllowed` flag is set. The flag only flips inside `buyResale`. The baseline has no override at all, so `transferFrom` and `safeTransferFrom` always work.
2. **An on-chain listing with a price cap.** `listForResale` stores `(seller, price, active)` and reverts if `price > resalePriceCap`. The baseline doesn't have a listing function — price is whatever the two parties agree on off-chain.
3. **Atomic ETH-for-NFT swap.** `buyResale` flips the transfer flag, transfers the NFT, and forwards the ETH to the seller in a single transaction. The baseline relies on the buyer trusting the seller (or paying through some external escrow).
4. **A constructor invariant.** The capped contract reverts deployment if `resalePriceCap < primaryPrice`. The baseline has nothing to enforce.

That's the whole delta.

---

## 2. Behavior comparison

Each row matches a unit test, a scenario script, or both, so anything in the table can be reproduced from the repo.

| Scenario | Baseline | Capped (`EventTicketNFT`) |
|---|---|---|
| Organizer mints to a user | Succeeds | Succeeds |
| Non-organizer tries to mint | Reverts `NotOrganizer` | Reverts `NotOrganizer` |
| User pays exact `primaryPrice` for `buyTicket` | Succeeds | Succeeds |
| User pays the wrong amount for `buyTicket` | Reverts `IncorrectPayment` | Reverts `IncorrectPayment` |
| Holder calls `transferFrom` directly | Succeeds at any off-chain price | Reverts `TransferNotAllowed` |
| Scalper lists at 10× primary | (no listing exists) | Reverts `ResalePriceTooHigh` |
| Buyer pays seller off-chain, seller never delivers | Buyer eats the loss | Impossible — `buyResale` is atomic |
| Two buyers race the same listing | n/a | First wins; second reverts `NotListed` |
| Buy a listing that doesn't exist | n/a | Reverts `NotListed` |
| Organizer redeems a ticket | Succeeds | Succeeds |
| Second redeem of the same ticket | Reverts `AlreadyRedeemed` | Reverts `AlreadyRedeemed` |
| Redeem an unminted token id | Reverts `InvalidTicket` | Reverts `InvalidTicket` |

`npm run scenarios` produces output like this:

```
[Baseline] scalper.transferFrom(scalper, victim, 1) PASS
[Baseline] ownerOf(1)                               PASS (0x3C44...93BC)
[Capped  ] listForResale(1, 0.5 ETH)                BLOCKED (ResalePriceTooHigh)
[Capped  ] scalper.transferFrom(scalper, victim, 1) BLOCKED (TransferNotAllowed)
```

That's the whole point of the comparison in one snippet: the same off-chain behavior reaches the victim under the baseline and is rejected by the capped contract.

---

## 3. Gas

These numbers come from `npm run bench`, single hardhat run, optimizer off, solc 0.8.19:

| Action | Baseline (gas) | Capped (gas) | Delta |
|---|---:|---:|---:|
| Deployment | 2,908,752 | 3,416,973 | +508,221 |
| `mintTo` | 98,300 | 98,338 | +38 |
| `buyTicket` (primary) | 61,841 | 61,966 | +125 |
| Secondary sale (`transferFrom` vs `listForResale + buyResale`) | 61,061 | 184,318 | +123,257 |
| `redeem` | 50,247 | 52,509 | +2,262 |

`npm run gas` (the hardhat-gas-reporter view across all 22 tests) lines up:

```
| Contract           | Method         | Avg gas |
| BaselineTicketNFT  | buyTicket      |  88,441 |
| BaselineTicketNFT  | mintTo         |  98,300 |
| BaselineTicketNFT  | redeem         |  50,247 |
| BaselineTicketNFT  | transferFrom   |  58,667 |
| EventTicketNFT     | buyResale      |  88,983 |
| EventTicketNFT     | buyTicket      |  96,166 |
| EventTicketNFT     | listForResale  |  95,335 |
| EventTicketNFT     | mintTo         |  98,338 |
| EventTicketNFT     | redeem         |  52,509 |
```

A few things to read out of these numbers:

Primary sale and redemption are essentially equal across both contracts (≤ a few percent). That's the experiment working — any large delta we see has to be coming from the resale path.

A complete secondary sale costs about 3× more on the capped contract (184k vs 61k gas). That extra gas pays for the listing storage write, the safety hook flip, the listing deactivation, and the on-chain ETH forward. In return, the buyer gets atomicity, a price cap the contract will actually enforce, and a single-spend listing — none of which the baseline gives them.

The capped contract's bytecode is about 17.5% larger at deploy time (3.42M vs 2.91M gas). The organizer pays this once and it's essentially noise next to the per-ticket savings users get from not being scammed.

The baseline `transferFrom` cost (~60k gas) also understates the real cost of a baseline secondary sale, because it ignores the off-chain payment leg — wire fees, marketplace cut, escrow, dispute risk, and so on.

---

## 4. Tradeoffs

### What the capped design gets you

The big one is anti-scalping at the protocol level — the 10× resale scenario is rejected by the contract itself, not by a marketplace policy that someone could route around. There's no third party left to bribe. On top of that:

- Payment and transfer happen in the same transaction. A buyer's ETH only leaves their wallet in the same tx that puts the NFT in their wallet, so non-delivery is impossible by construction.
- Listings are single-spend. Once a listing is filled, the second racer reverts cleanly with `NotListed` and keeps their ETH.
- `redeem` deactivates any open listing as a side effect, so a redeemed ticket can't accidentally be resold to someone who doesn't realize it's already been used.

### What it costs you

The +123k gas per resale is real and worth being honest about. On L1 mainnet at peak hours that's a meaningful surcharge. On an L2 or a testnet it's negligible.

The bigger functional cost is that we block *every* direct transfer. That means no gifting, no transferring to a family member, no migrating to a fresh wallet — the only legal exit from a holder's wallet is `buyResale` at a price ≤ cap. Adding an organizer-approved free-transfer path would be a small change but is intentionally out of scope for the prototype.

The transfer hook also breaks compatibility with external NFT marketplaces, since OpenSea/LooksRare/Blur all call `transferFrom` after a sale on their books. That's by design — resale has to go through our contract — but it means the ticket can't ride existing marketplace liquidity.

Finally, the cap is a one-shot decision. A premium-tier seat could legitimately be worth more than the cap, and the contract has no way to express tiered caps without more code.

### What neither design fixes

If two people coordinate off-chain — for example, by selling access to a wallet rather than the ticket itself — neither contract can do anything about it. The proposal's Challenges section already calls this out, and the only real mitigation is a KYC/identity layer that we explicitly took out of scope.

Both designs also assume the organizer's check-in process actually consults the chain. A scanner that doesn't would let a redeemed ticket back in regardless of which contract is deployed.

There's also a fairness tradeoff worth naming. A cap that's good at limiting scalpers also limits legitimate resale by people who can no longer attend, especially for popular events where the natural market price would clear above the cap.

---

## 5. When you'd pick which

| Goal | Pick |
|---|---|
| Free secondary trading, broad marketplace interop | Baseline |
| Organizer wants explicit price control + non-delivery protection | Capped (`EventTicketNFT`) |
| Attendance-tied access, no transfer at all | Soulbound variant (out of scope here) |

The capped design is the right pick for the proposal's actual goal — *"reduce counterfeit risk inside the system and limit uncontrolled secondary resale."* The numbers above are what you pay for that property: roughly +123k gas per resale and a 17.5% larger contract.

---

## 6. Where to look in the repo

Tests:

- `test/EventTicketNFT.js` — capped contract, 11 tests covering every demo case from the proposal.
- `test/BaselineTicketNFT.js` — baseline contract, 11 tests split into "same as capped" and "things the baseline can't enforce" so the difference is obvious in the file itself.

Scenarios (each runnable on its own with `npx hardhat run`):

- `scripts/scenarios/scalp.js`
- `scripts/scenarios/non-delivery.js`
- `scripts/scenarios/double-spend-listing.js`
- `scripts/scenarios/redemption-replay.js`
- `scripts/scenarios/run-all.js`

Gas measurement:

- `scripts/bench.js`
