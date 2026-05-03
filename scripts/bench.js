// Runs the same tx mix on both contracts and prints a Markdown gas table.
// "Secondary sale" on the baseline is just transferFrom because the payment
// leg lives off-chain; on the capped contract it's listForResale + buyResale.

const hre = require("hardhat");

const PRIMARY_PRICE = hre.ethers.parseEther("0.05");
const RESALE_CAP = hre.ethers.parseEther("0.08");

async function gasOf(txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  return receipt.gasUsed;
}

async function deployGas(factory, args) {
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();
  await contract.waitForDeployment();
  return { contract, gasUsed: receipt.gasUsed };
}

function fmt(n) {
  return Number(n).toLocaleString("en-US");
}

async function main() {
  const [organizer, alice, bob] = await hre.ethers.getSigners();

  const Baseline = await hre.ethers.getContractFactory("BaselineTicketNFT");
  const Capped = await hre.ethers.getContractFactory("EventTicketNFT");

  const baselineDeploy = await deployGas(Baseline, [
    "Baseline Ticket",
    "BTIX",
    100,
    PRIMARY_PRICE,
  ]);
  const cappedDeploy = await deployGas(Capped, [
    "Capped Ticket",
    "TIX",
    100,
    PRIMARY_PRICE,
    RESALE_CAP,
  ]);

  const baseline = baselineDeploy.contract;
  const capped = cappedDeploy.contract;

  const baselineMint = await gasOf(baseline.connect(organizer).mintTo(alice.address));
  const cappedMint = await gasOf(capped.connect(organizer).mintTo(alice.address));

  const baselineBuy = await gasOf(
    baseline.connect(alice).buyTicket({ value: PRIMARY_PRICE })
  );
  const cappedBuy = await gasOf(
    capped.connect(alice).buyTicket({ value: PRIMARY_PRICE })
  );

  const baselineTransfer = await gasOf(
    baseline.connect(alice).transferFrom(alice.address, bob.address, 2)
  );

  const cappedList = await gasOf(
    capped.connect(alice).listForResale(2, PRIMARY_PRICE)
  );
  const cappedBuyResale = await gasOf(
    capped.connect(bob).buyResale(2, { value: PRIMARY_PRICE })
  );
  const cappedSecondaryTotal = cappedList + cappedBuyResale;

  const baselineRedeem = await gasOf(baseline.connect(organizer).redeem(1));
  const cappedRedeem = await gasOf(capped.connect(organizer).redeem(1));

  console.log("\n## Gas comparison (single hardhat run, optimizer off, solc 0.8.19)\n");
  console.log("| Action | Baseline (gas) | Capped (gas) | Delta |");
  console.log("|---|---:|---:|---:|");
  console.log(
    `| Deployment | ${fmt(baselineDeploy.gasUsed)} | ${fmt(cappedDeploy.gasUsed)} | +${fmt(cappedDeploy.gasUsed - baselineDeploy.gasUsed)} |`
  );
  console.log(`| mintTo | ${fmt(baselineMint)} | ${fmt(cappedMint)} | ${fmt(cappedMint - baselineMint)} |`);
  console.log(`| buyTicket (primary) | ${fmt(baselineBuy)} | ${fmt(cappedBuy)} | ${fmt(cappedBuy - baselineBuy)} |`);
  console.log(
    `| Secondary sale (transferFrom vs list+buyResale) | ${fmt(baselineTransfer)} | ${fmt(cappedSecondaryTotal)} | +${fmt(cappedSecondaryTotal - baselineTransfer)} |`
  );
  console.log(`| redeem | ${fmt(baselineRedeem)} | ${fmt(cappedRedeem)} | ${fmt(cappedRedeem - baselineRedeem)} |`);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
