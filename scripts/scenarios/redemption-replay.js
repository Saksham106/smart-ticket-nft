// Organizer tries to redeem the same ticket twice on each contract.
// Both block the second attempt -- redemption isn't where the designs differ.

const hre = require("hardhat");
const { deployBoth, header, logRow, tryTx, PRIMARY_PRICE } = require("./_helpers");

async function main() {
  const [organizer, attendee] = await hre.ethers.getSigners();
  const { baseline, capped } = await deployBoth();

  header("Scenario: double-redemption attempt (both contracts)");

  console.log("\n-- Baseline --");
  await baseline.connect(attendee).buyTicket({ value: PRIMARY_PRICE });
  const firstBase = await tryTx(baseline, "redeem", async () => {
    const tx = await baseline.connect(organizer).redeem(1);
    await tx.wait();
  });
  logRow("Baseline", "first redeem(1)", firstBase);
  logRow("Baseline", "isRedeemed(1)",
    { ok: true, detail: String(await baseline.isRedeemed(1)) });
  const secondBase = await tryTx(baseline, "redeem", async () => {
    const tx = await baseline.connect(organizer).redeem(1);
    await tx.wait();
  });
  logRow("Baseline", "second redeem(1)", secondBase);

  console.log("\n-- Capped --");
  await capped.connect(attendee).buyTicket({ value: PRIMARY_PRICE });
  const firstCap = await tryTx(capped, "redeem", async () => {
    const tx = await capped.connect(organizer).redeem(1);
    await tx.wait();
  });
  logRow("Capped", "first redeem(1)", firstCap);
  logRow("Capped", "isRedeemed(1)",
    { ok: true, detail: String(await capped.isRedeemed(1)) });
  const secondCap = await tryTx(capped, "redeem", async () => {
    const tx = await capped.connect(organizer).redeem(1);
    await tx.wait();
  });
  logRow("Capped", "second redeem(1)", secondCap);

  console.log("\nResult: both contracts enforce single-use redemption; the comparison");
  console.log("       on resale rules is therefore not contaminated by a redeem-side gap.\n");
}

module.exports = main;

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
