import { ethers } from "ethers";
import { getReadContract } from "../blockchain/contract";
import { verifyConnection } from "../blockchain/provider";
import {
  OnChainTask,
  ProofEvidence,
  ProofHashResult,
  TaskState,
  TASK_STATE_LABELS,
  WriteOperationInfo,
} from "../types/task";
import { env } from "../config/env";

// ─── In-Memory Proof Store (Development Only) ─────────────────────────────────
export const proofStore = new Map<string, ProofEvidence>();

// ─── Read Operations ─────────────────────────────────────────────────────────

/**
 * Fetches a single task directly from the deployed ProofToPay contract.
 * Returns null if the task does not exist on-chain.
 */
export async function fetchTask(taskId: string): Promise<OnChainTask | null> {
  const contract = getReadContract();

  let raw: Awaited<ReturnType<typeof contract.getTask>>;
  try {
    raw = await contract.getTask(taskId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Contract reverts with "Task does not exist" for missing tasks
    if (msg.includes("Task does not exist")) return null;
    throw err;
  }

  const stateNum = Number(raw.state) as TaskState;

  return {
    taskId: raw.taskId,
    creator: raw.creator,
    robot: raw.robot,
    // rewardWei returned as string — BigInt cannot be JSON-serialized
    rewardWei: (raw.reward as bigint).toString(),
    rewardMSTC: ethers.formatEther(raw.reward),
    packageId: raw.packageId,
    source: raw.source,
    destination: raw.destination,
    proofHash: raw.proofHash,
    state: stateNum,
    stateLabel: TASK_STATE_LABELS[stateNum] ?? "UNKNOWN",
    createdAt: Number(raw.createdAt),
    proofSubmittedAt: Number(raw.proofSubmittedAt),
    verifiedAt: Number(raw.verifiedAt),
  };
}

/**
 * Fetches all task IDs from the deployed contract, then returns an array of full tasks.
 */
export async function fetchAllTasks(): Promise<OnChainTask[]> {
  const contract = getReadContract();
  const ids: string[] = await contract.getAllTaskIds();
  const tasks = await Promise.all(ids.map(fetchTask));
  return tasks.filter((t): t is OnChainTask => t !== null);
}

/**
 * Returns live blockchain connectivity info.
 */
export async function getBlockchainInfo() {
  const conn = await verifyConnection();
  return {
    network: "MST Testnet",
    chainId: conn.chainId,
    rpcUrl: env.MST_RPC_URL,
    explorerUrl: env.MST_EXPLORER_URL,
    contractAddress: env.PROOF_TO_PAY_CONTRACT,
    blockNumber: conn.blockNumber,
  };
}

// ─── Proof Hash Service ───────────────────────────────────────────────────────

/**
 * Generates a deterministic keccak256 proof hash from physical evidence.
 *
 * The same evidence data always produces the same hash.
 * Only this hash is stored on-chain — the raw evidence stays off-chain.
 */
export function generateProofHash(evidence: ProofEvidence): ProofHashResult {
  // Canonical JSON: sorted keys, no extra whitespace — guarantees determinism
  const canonical: Record<string, unknown> = {
    taskId: evidence.taskId,
    robotId: evidence.robotId,
    packageId: evidence.packageId,
    source: evidence.source,
    destination: evidence.destination,
    timestamp: evidence.timestamp,
  };
  if (evidence.rfidUid !== undefined) canonical.rfidUid = evidence.rfidUid;
  if (evidence.distance !== undefined) canonical.distance = evidence.distance;
  if (evidence.gps !== undefined) canonical.gps = evidence.gps;

  const canonicalData = JSON.stringify(canonical, Object.keys(canonical).sort());
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalData));

  return { proofHash, canonicalData };
}

// ─── Write Operation Stubs ────────────────────────────────────────────────────
// These document each write operation and what BridgeKey will handle in Phase 5.

export function describeWriteOperation(operation: string): WriteOperationInfo {
  const ops: Record<string, WriteOperationInfo> = {
    createTask: {
      implemented: false,
      contractFunction: "createTask(taskId, reward, packageId, source, destination)",
      signer: "Task Creator (user wallet)",
      signingMethod: "BridgeKey wallet — frontend Phase 5",
      expectedStateTransition: "→ CREATED",
      emittedEvent: "TaskCreated(taskId, creator, reward, packageId, source, destination)",
      message:
        "createTask will be signed by the user via BridgeKey in the frontend. The backend does not hold user funds.",
    },
    fundTask: {
      implemented: false,
      contractFunction: "fundTask(taskId) payable",
      signer: "Task Creator (user wallet)",
      signingMethod: "BridgeKey wallet — frontend Phase 5",
      expectedStateTransition: "CREATED → FUNDED",
      emittedEvent: "TaskFunded(taskId, creator, amount)",
      message:
        "fundTask sends MSTC to the contract escrow. Must be signed by the creator with exact reward amount.",
    },
    assignRobot: {
      implemented: false,
      contractFunction: "assignRobot(taskId, robotAddress)",
      signer: "Task Creator (user wallet)",
      signingMethod: "BridgeKey wallet — frontend Phase 5",
      expectedStateTransition: "FUNDED → ASSIGNED",
      emittedEvent: "RobotAssigned(taskId, robot, creator)",
      message:
        "Creator assigns an EVM robot address. Signed via BridgeKey in the frontend.",
    },
    startTask: {
      implemented: false,
      contractFunction: "startTask(taskId)",
      signer: "Assigned Robot (robot wallet/backend)",
      signingMethod: "Backend signer (BACKEND_PRIVATE_KEY) or robot gateway",
      expectedStateTransition: "ASSIGNED → WORKING",
      emittedEvent: "TaskStarted(taskId, robot)",
      message:
        "Only the assigned robot address can call this. Backend will sign this when NEURICK is integrated.",
    },
    submitProof: {
      implemented: false,
      contractFunction: "submitProof(taskId, proofHash)",
      signer: "Assigned Robot (robot wallet/backend)",
      signingMethod: "Backend signer (BACKEND_PRIVATE_KEY) or robot gateway",
      expectedStateTransition: "WORKING → PROOF_SUBMITTED",
      emittedEvent: "ProofSubmitted(taskId, submitter, proofHash)",
      message:
        "The backend generates the proofHash from sensor evidence, then submits it on behalf of the robot.",
    },
    verifyTask: {
      implemented: false,
      contractFunction: "verifyTask(taskId, success)",
      signer: "Authorized Verifier address",
      signingMethod: "Backend verifier signer (BACKEND_PRIVATE_KEY) or independent verifier node",
      expectedStateTransition: "PROOF_SUBMITTED → VERIFIED (or unverified)",
      emittedEvent: "TaskVerified(taskId, verifier, success)",
      message:
        "Only the authorized verifier address can call this. The verifier must be independent of the robot.",
    },
    releasePayment: {
      implemented: false,
      contractFunction: "releasePayment(taskId)",
      signer: "Any address (permissionless once VERIFIED)",
      signingMethod: "BridgeKey wallet (creator) or backend signer",
      expectedStateTransition: "VERIFIED → PAID",
      emittedEvent: "PaymentReleased(taskId, robot, amount)",
      message:
        "Permissionless once the task is VERIFIED. Transfers escrowed MSTC to the robot.",
    },
    refundTask: {
      implemented: false,
      contractFunction: "refundTask(taskId)",
      signer: "Task Creator (user wallet)",
      signingMethod: "BridgeKey wallet — frontend Phase 5",
      expectedStateTransition: "FUNDED|ASSIGNED|PROOF_SUBMITTED → REFUNDED",
      emittedEvent: "TaskRefunded(taskId, creator, amount)",
      message:
        "Creator reclaims escrowed funds. Only allowed from FUNDED, ASSIGNED, or failed PROOF_SUBMITTED states.",
    },
  };

  return (
    ops[operation] ?? {
      implemented: false,
      contractFunction: "Unknown",
      signer: "Unknown",
      signingMethod: "Unknown",
      expectedStateTransition: "Unknown",
      emittedEvent: "Unknown",
      message: `Operation "${operation}" is not defined. Check the ProofToPay contract.`,
    }
  );
}

// ─── Robot Service Interface (Stub) ──────────────────────────────────────────

/**
 * RobotService — future integration boundary for NEURICK / robot simulator.
 * Phase 4: Stub only. No hardware is connected.
 */
export const RobotService = {
  /**
   * Sends a task assignment to the robot gateway.
   * Phase 4: NOT IMPLEMENTED — placeholder for NEURICK integration.
   */
  async sendTask(taskId: string): Promise<{ success: false; message: string }> {
    return {
      success: false,
      message: `Robot integration not connected. Task "${taskId}" will be sent to NEURICK in a future phase.`,
    };
  },

  /**
   * Requests status from the robot gateway.
   * Phase 4: NOT IMPLEMENTED — placeholder for NEURICK integration.
   */
  async getRobotStatus(robotId: string): Promise<{ connected: false; message: string }> {
    return {
      connected: false,
      message: `Robot "${robotId}" is not yet connected. NEURICK hardware integration is planned for a future phase.`,
    };
  },

  /**
   * Receives physical proof telemetry from robot or simulator.
   * Phase 4: NOT IMPLEMENTED — placeholder for robot simulator.
   */
  async receiveProof(taskId: string): Promise<{ available: false; message: string }> {
    return {
      available: false,
      message: `No proof data received from robot for task "${taskId}". Robot simulator integration is planned for a future phase.`,
    };
  },
};
