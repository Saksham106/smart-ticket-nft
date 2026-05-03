// Runs every scenario in order so one command produces the full output.

const scalp = require("./scalp");
const nonDelivery = require("./non-delivery");
const doubleSpend = require("./double-spend-listing");
const redemptionReplay = require("./redemption-replay");

async function main() {
  await scalp();
  await nonDelivery();
  await doubleSpend();
  await redemptionReplay();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
