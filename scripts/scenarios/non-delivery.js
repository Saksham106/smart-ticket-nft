// Buyer pays seller off-chain but seller never transfers.
// Baseline can't do anything about it; capped's buyResale is atomic.

const hre = require("hardhat");
const { deployBoth, header, logRow, tryTx, PRIMARY_PRICE, eth } = require("./_helpers");

async function main() {
  const [organizer, scalper, victim] = await hre.ethers.getSigners();
  const { baseline, capped } = await deployBoth();

  const askPrice = PRIMARY_PRICE * 5n;
  header(`Scenario: victim pays scalper ${eth(askPrice)} ETH off-chain for ticket #1`);

  console.log("\n-- Baseline (no atomic resale path) --");

  await baseline.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
  const victimBalanceBefore = await hre.ethers.provider.getBalance(victim.address);

  const sendTx = await victim.sendTransaction({ to: scalper.address, value: askPrice });
  await sendTx.wait();
  logRow("Baseline", "victim.sendTransaction(askPrice -> scalper)",
    { ok: true });

  const victimBalanceAfter = await hre.ethers.provider.getBalance(victim.address);
  const lost = victimBalanceBefore - victimBalanceAfter;
  logRow("Baseline", "ownerOf(1) after off-chain payment",
    { ok: true, detail: await baseline.ownerOf(1) });
  logRow("Baseline", "victim ETH delta",
    { ok: true, detail: `-${eth(lost)} ETH` });

  console.log("\n-- Capped (EventTicketNFT) --");

  await capped.connect(scalper).buyTicket({ value: PRIMARY_PRICE });

  const fragments = capped.interface.fragments
    .filter((f) => f.type === "function" && f.payable)
    .map((f) => f.name);
  logRow("Capped", "payable functions in ABI",
    { ok: true, detail: fragments.join(", ") });

  const buyWithoutListing = await tryTx(capped, "buyResale", async () => {
    const tx = await capped.connect(victim).buyResale(1, { value: askPrice });
    await tx.wait();
  });
  logRow("Capped", `buyResale(1) with no listing, value=${eth(askPrice)} ETH`,
    buyWithoutListing);

  await capped.connect(scalper).listForResale(1, PRIMARY_PRICE);
  const buyAfterListing = await tryTx(capped, "buyResale", async () => {
    const tx = await capped.connect(victim).buyResale(1, { value: PRIMARY_PRICE });
    await tx.wait();
  });
  logRow("Capped", `buyResale(1) after listing at primary price`, buyAfterListing);
  logRow("Capped", "ownerOf(1) after atomic resale",
    { ok: true, detail: await capped.ownerOf(1) });

  console.log("\nResult: baseline lets the victim lose ETH with no on-chain recourse;");
  console.log("       capped only moves money in the same tx that moves the ticket.\n");
}

module.exports = main;

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
