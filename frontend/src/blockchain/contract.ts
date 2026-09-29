/**
 * Contract interaction module for ProofToPay.
 *
 * Read operations: use a static JsonRpcProvider (no wallet needed).
 * Write operations: use the user's connected wallet signer via BridgeKey.
 */

import { ethers } from 'ethers';
import { PROOF_TO_PAY_ABI } from './abi';
import { PROOF_TO_PAY_CONTRACT, MST_RPC_URL } from './config';
import { getSigner } from './wallet';
import type { OnChainTask } from '../types/task';
import { parseOnChainTask } from '../types/task';

/** Read-only provider connected to MST Testnet */
function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(MST_RPC_URL);
}

/** Read-only contract instance — no wallet required */
function getReadContract(): ethers.Contract {
  return new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, getReadProvider());
}

/** Returns task by ID from chain. Returns null if not found. */
export async function fetchTask(taskId: string): Promise<OnChainTask | null> {
  const contract = getReadContract();
  try {
    const raw = await contract.getTask(taskId);
    return parseOnChainTask(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Task does not exist')) return null;
    throw err;
  }
}

/** Returns all task IDs registered on-chain */
export async function fetchAllTaskIds(): Promise<string[]> {
  const contract = getReadContract();
  return contract.getAllTaskIds() as Promise<string[]>;
}

/** Returns all full task objects */
export async function fetchAllTasks(): Promise<OnChainTask[]> {
  const ids = await fetchAllTaskIds();
  const tasks = await Promise.all(ids.map(fetchTask));
  return tasks.filter((t): t is OnChainTask => t !== null);
}

/**
 * Creates a new task on-chain via the user's connected wallet.
 *
 * Signature: createTask(taskId, reward, packageId, source, destination)
 * reward is in wei (use ethers.parseEther to convert from MSTC)
 */
export async function createTask(
  taskId: string,
  rewardMSTC: string,
  packageId: string,
  source: string,
  destination: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected. Please connect BridgeKey first.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const rewardWei = ethers.parseEther(rewardMSTC);

  // Exact Solidity signature: createTask(taskId, reward, packageId, source, destination)
  const tx = await contract.createTask(taskId, rewardWei, packageId, source, destination);
  return tx as ethers.TransactionResponse;
}

/**
 * Funds a task by sending exactly the reward amount to the escrow.
 * Only the task creator can fund. Amount must match task.reward.
 */
export async function fundTask(
  taskId: string,
  rewardWei: bigint
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.fundTask(taskId, { value: rewardWei });
  return tx as ethers.TransactionResponse;
}

/**
 * Assigns an autonomous robot to a funded task.
 * Only the task creator can assign. Task must be in FUNDED state.
 */
export async function assignRobot(
  taskId: string,
  robotAddress: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.assignRobot(taskId, robotAddress);
  return tx as ethers.TransactionResponse;
}

/**
 * Starts an assigned task, transitioning state to WORKING.
 * Must be called when task is in ASSIGNED state.
 */
export async function startTask(
  taskId: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.startTask(taskId);
  return tx as ethers.TransactionResponse;
}

/**
 * Submits the canonical sensor-proof hash on-chain.
 * Can be called by the assigned robot address OR the authorized verifier address.
 * Must be called when task is in WORKING state.
 *
 * @param taskId - Task identifier (e.g., "T004")
 * @param proofHash - keccak256 hex string (0x-prefixed, 32 bytes) of canonical sensor evidence
 */
export async function submitProof(
  taskId: string,
  proofHash: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.submitProof(taskId, proofHash);
  return tx as ethers.TransactionResponse;
}

/**
 * Records the independent verifier's decision on-chain.
 * Can only be called by the authorized verifier address set in the contract.
 * Must be called when task is in PROOF_SUBMITTED state.
 *
 * @param taskId - Task identifier
 * @param success - true if proof is valid, false otherwise
 */
export async function verifyTask(
  taskId: string,
  success: boolean
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.verifyTask(taskId, success);
  return tx as ethers.TransactionResponse;
}

/**
 * Releases escrowed reward to the robot wallet.
 * Permissionless once task is in VERIFIED state — any caller can trigger payout.
 *
 * @param taskId - Task identifier
 */
export async function releasePayment(
  taskId: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.releasePayment(taskId);
  return tx as ethers.TransactionResponse;
}

/**
 * Refunds the escrowed reward back to the task creator.
 * Can be called by the task creator when task is in FUNDED, ASSIGNED, or PROOF_SUBMITTED state.
 *
 * @param taskId - Task identifier
 */
export async function refundTask(
  taskId: string
): Promise<ethers.TransactionResponse> {
  const signer = await getSigner();
  if (!signer) throw new Error('Wallet not connected.');

  const contract = new ethers.Contract(PROOF_TO_PAY_CONTRACT, PROOF_TO_PAY_ABI, signer);
  const tx = await contract.refundTask(taskId);
  return tx as ethers.TransactionResponse;
}


