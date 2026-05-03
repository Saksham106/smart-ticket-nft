import { ethers } from "ethers";
import { CONTRACT_ABI } from "./contract.js";

const iface = new ethers.Interface(CONTRACT_ABI);

function collectRevertDataCandidates(error) {
  /** @type {string[]} */
  const out = [];
  /** @type {unknown} */
  let cur = error;
  let depth = 0;
  while (cur != null && depth < 12) {
    /** @type {any} */
    const e = cur;
    const pushIf = (s) => {
      if (typeof s === "string" && s.startsWith("0x") && s.length >= 10) out.push(s);
    };

    pushIf(e.data);
    pushIf(e.info?.error?.data);
    pushIf(e.error?.data);

    cur = e.cause;
    depth += 1;
  }
  return out;
}

function formatParsedRevert(parsed) {
  const fragment = parsed.fragment;
  if (!fragment.inputs.length) return `${parsed.name}()`;

  const pieces = fragment.inputs.map((input, idx) => {
    const v = parsed.args[idx];
    if (input.baseType === "uint256") {
      return `${input.name}=${ethers.formatEther(v)} ETH`;
    }
    return `${input.name}=${String(v)}`;
  });

  return `${parsed.name}(${pieces.join(", ")})`;
}

/**
 * Readable message for Solidity custom errors when revert data matches CONTRACT_ABI errors.
 */
export function formatRevertError(error) {
  for (const hex of collectRevertDataCandidates(error)) {
    try {
      const parsed = iface.parseError(hex);
      return formatParsedRevert(parsed);
    } catch (_) {
      /* wrong blob (e.g. tx calldata) */
    }
  }

  return error?.reason || error?.shortMessage || error?.message || "Transaction failed.";
}
