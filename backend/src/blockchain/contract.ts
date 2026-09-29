import { ethers } from "ethers";
import { getProvider, getSigner } from "./provider";
import { PROOF_TO_PAY_ABI } from "./abi";
import { env } from "../config/env";

/**
 * Returns a read-only contract instance connected to the MST Testnet provider.
 * Safe for all view/pure functions — does not require or expose any wallet.
 */
export function getReadContract(): ethers.Contract {
  return new ethers.Contract(
    env.PROOF_TO_PAY_CONTRACT,
    PROOF_TO_PAY_ABI,
    getProvider()
  );
}

/**
 * Returns a write-capable contract instance using the backend signer.
 * Only available if BACKEND_PRIVATE_KEY is configured in .env.
 * Most user write operations are signed by BridgeKey in the frontend.
 */
export function getWriteContract(): ethers.Contract | null {
  const signer = getSigner();
  if (!signer) return null;
  return new ethers.Contract(
    env.PROOF_TO_PAY_CONTRACT,
    PROOF_TO_PAY_ABI,
    signer
  );
}
