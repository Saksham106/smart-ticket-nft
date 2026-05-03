const hre = require("hardhat");

const PRIMARY_PRICE = hre.ethers.parseEther("0.05");
const RESALE_CAP = hre.ethers.parseEther("0.08");
const NAME_BASE = "Baseline Ticket";
const SYMBOL_BASE = "BTIX";
const NAME_CAPPED = "Capped Ticket";
const SYMBOL_CAPPED = "TIX";
const MAX_SUPPLY = 10;

async function deployBoth() {
  const Baseline = await hre.ethers.getContractFactory("BaselineTicketNFT");
  const baseline = await Baseline.deploy(NAME_BASE, SYMBOL_BASE, MAX_SUPPLY, PRIMARY_PRICE);
  await baseline.waitForDeployment();

  const Capped = await hre.ethers.getContractFactory("EventTicketNFT");
  const capped = await Capped.deploy(
    NAME_CAPPED,
    SYMBOL_CAPPED,
    MAX_SUPPLY,
    PRIMARY_PRICE,
    RESALE_CAP
  );
  await capped.waitForDeployment();

  return { baseline, capped };
}

function eth(v) {
  return hre.ethers.formatEther(v);
}

function logRow(contractName, action, result) {
  const okMark = result.ok ? "PASS" : "BLOCKED";
  const detail = result.detail ? ` (${result.detail})` : "";
  console.log(`  [${contractName.padEnd(8)}] ${action.padEnd(38)} ${okMark}${detail}`);
}

function header(title) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

function decodeError(contract, error) {
  const data = error?.data || error?.info?.error?.data || error?.error?.data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    try {
      const parsed = contract.interface.parseError(data);
      return parsed?.name || error.shortMessage || error.message;
    } catch (_) {
      // not a custom error from this ABI -- fall through
    }
  }
  return error?.shortMessage || error?.reason || error?.message || "unknown error";
}

async function tryTx(contract, label, fn) {
  try {
    const out = await fn();
    return { ok: true, detail: out?.detail };
  } catch (error) {
    return { ok: false, detail: decodeError(contract, error) };
  }
}

module.exports = {
  PRIMARY_PRICE,
  RESALE_CAP,
  MAX_SUPPLY,
  deployBoth,
  eth,
  header,
  logRow,
  tryTx,
  decodeError,
};
