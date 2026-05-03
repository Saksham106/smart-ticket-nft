// Two buyers race for the same listing. Capped only, since the baseline
// has no listing concept. First wins; second reverts with NotListed.

const hre = require("hardhat");
const { deployBoth, header, logRow, tryTx, PRIMARY_PRICE } = require("./_helpers");

async function main() {
  const [organizer, seller, buyerA, buyerB] = await hre.ethers.getSigners();
  const { capped } = await deployBoth();

  header("Scenario: two buyers race for the same listing (capped only)");

  await capped.connect(seller).buyTicket({ value: PRIMARY_PRICE });
  await capped.connect(seller).listForResale(1, PRIMARY_PRICE);
  logRow("Capped", "seller listed token 1 at primary price",
    { ok: true });

  const firstBuy = await tryTx(capped, "buyResale", async () => {
    const tx = await capped.connect(buyerA).buyResale(1, { value: PRIMARY_PRICE });
    await tx.wait();
  });
  logRow("Capped", "buyerA.buyResale(1)", firstBuy);
  logRow("Capped", "ownerOf(1)",
    { ok: true, detail: await capped.ownerOf(1) });

  const secondBuy = await tryTx(capped, "buyResale", async () => {
    const tx = await capped.connect(buyerB).buyResale(1, { value: PRIMARY_PRICE });
    await tx.wait();
  });
  logRow("Capped", "buyerB.buyResale(1)", secondBuy);

  const listing = await capped.getListing(1);
  logRow("Capped", "getListing(1).active",
    { ok: true, detail: String(listing.active) });

  console.log("\nResult: the listing is single-spend; the loser's tx reverts cleanly");
  console.log("       (their ETH stays in their wallet).\n");
}

module.exports = main;

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
