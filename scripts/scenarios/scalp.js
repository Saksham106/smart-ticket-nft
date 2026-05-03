// Scalper buys 3 primaries and tries to resell #1 at 10x.
// Baseline lets it through; capped blocks both the listing and the bypass.

const hre = require("hardhat");
const { deployBoth, header, logRow, tryTx, PRIMARY_PRICE, eth } = require("./_helpers");

async function main() {
  const [organizer, scalper, victim] = await hre.ethers.getSigners();
  const { baseline, capped } = await deployBoth();

  const tenX = PRIMARY_PRICE * 10n;
  header(`Scenario: scalper buys 3 tickets and tries to resell #1 at 10x ` +
    `(${eth(tenX)} ETH; primary ${eth(PRIMARY_PRICE)} ETH)`);

  console.log("\n-- Baseline (no resale rules) --");

  for (let i = 0; i < 3; i += 1) {
    await baseline.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
  }
  logRow("Baseline", "scalper bought 3 primary tickets",
    { ok: true, detail: `totalMinted=${await baseline.totalMinted()}` });

  await victim.sendTransaction({ to: scalper.address, value: tenX });
  logRow("Baseline", "victim sent 10x payment off-chain to scalper",
    { ok: true });

  const transferResult = await tryTx(baseline, "transferFrom", async () => {
    const tx = await baseline.connect(scalper).transferFrom(
      scalper.address,
      victim.address,
      1
    );
    await tx.wait();
  });
  logRow("Baseline", "scalper.transferFrom(scalper, victim, 1)", transferResult);
  logRow("Baseline", "ownerOf(1)",
    { ok: true, detail: await baseline.ownerOf(1) });

  console.log("\n-- Capped (EventTicketNFT) --");

  for (let i = 0; i < 3; i += 1) {
    await capped.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
  }
  logRow("Capped", "scalper bought 3 primary tickets",
    { ok: true, detail: `totalMinted=${await capped.totalMinted()}` });

  const listResult = await tryTx(capped, "listForResale", async () => {
    const tx = await capped.connect(scalper).listForResale(1, tenX);
    await tx.wait();
  });
  logRow("Capped", `listForResale(1, ${eth(tenX)} ETH)`, listResult);

  const directResult = await tryTx(capped, "transferFrom", async () => {
    const tx = await capped.connect(scalper).transferFrom(
      scalper.address,
      victim.address,
      1
    );
    await tx.wait();
  });
  logRow("Capped", "scalper.transferFrom(scalper, victim, 1)", directResult);
  logRow("Capped", "ownerOf(1)",
    { ok: true, detail: await capped.ownerOf(1) });

  console.log("\nResult: baseline allows 10x scalping; capped blocks both the listing");
  console.log("       and the bypass attempt at the contract level.\n");
}

module.exports = main;

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
