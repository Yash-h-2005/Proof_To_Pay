import { ethers } from "ethers";
import { env } from "../config/env";

let _provider: ethers.JsonRpcProvider | null = null;

/**
 * Returns a singleton read-only JsonRpcProvider connected to MST Testnet.
 */
export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(env.MST_RPC_URL);
  }
  return _provider;
}

/**
 * Returns a signer for backend-initiated transactions, if BACKEND_PRIVATE_KEY is set.
 * Most user-facing write transactions are signed by BridgeKey in the frontend.
 */
export function getSigner(): ethers.Wallet | null {
  if (!env.BACKEND_PRIVATE_KEY) {
    return null;
  }
  const key = env.BACKEND_PRIVATE_KEY.startsWith("0x")
    ? env.BACKEND_PRIVATE_KEY
    : `0x${env.BACKEND_PRIVATE_KEY}`;
  return new ethers.Wallet(key, getProvider());
}

/**
 * Verifies the provider can reach the MST Testnet RPC.
 * Returns network info or throws on failure.
 */
export async function verifyConnection(): Promise<{
  networkName: string;
  chainId: number;
  blockNumber: number;
}> {
  const provider = getProvider();
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  return {
    networkName: network.name ?? "mstTestnet",
    chainId: Number(network.chainId),
    blockNumber,
  };
}
