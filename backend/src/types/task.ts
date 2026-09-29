/**
 * Task state enum — mirrors ProofToPay.sol TaskState enum exactly.
 * The blockchain is the authoritative source of truth for all task states.
 */
export enum TaskState {
  CREATED = 0,
  FUNDED = 1,
  ASSIGNED = 2,
  WORKING = 3,
  PROOF_SUBMITTED = 4,
  VERIFIED = 5,
  PAID = 6,
  REFUNDED = 7,
}

export const TASK_STATE_LABELS: Record<TaskState, string> = {
  [TaskState.CREATED]: "CREATED",
  [TaskState.FUNDED]: "FUNDED",
  [TaskState.ASSIGNED]: "ASSIGNED",
  [TaskState.WORKING]: "WORKING",
  [TaskState.PROOF_SUBMITTED]: "PROOF_SUBMITTED",
  [TaskState.VERIFIED]: "VERIFIED",
  [TaskState.PAID]: "PAID",
  [TaskState.REFUNDED]: "REFUNDED",
};

/**
 * Task data as returned from the ProofToPay smart contract getTask() function.
 * All fields are read directly from on-chain state. The backend does not maintain
 * a duplicate task-state system.
 */
export interface OnChainTask {
  taskId: string;
  creator: string;
  robot: string;
  /** Reward in wei as a decimal string (BigInt serialized as string) */
  rewardWei: string;
  /** Reward in MSTC (human-readable string) */
  rewardMSTC: string;
  packageId: string;
  source: string;
  destination: string;
  /** Proof hash as hex string — 0x000...000 if not yet submitted */
  proofHash: string;
  state: TaskState;
  stateLabel: string;
  /** Unix timestamp in seconds (0 if not yet set) */
  createdAt: number;
  proofSubmittedAt: number;
  verifiedAt: number;
}

/**
 * Off-chain physical sensor evidence object.
 * This is what the robot/simulator will eventually send to the backend.
 * Only the canonical hash of this is stored on-chain (never the raw data).
 */
export interface ProofEvidence {
  taskId: string;
  robotId: string;
  packageId: string;
  source: string;
  destination: string;
  /** Unix timestamp in seconds when evidence was collected */
  timestamp: number;
  /** RFID tag UID scanned at pickup/dropoff */
  rfidUid?: string;
  /** Ultrasonic sensor distance reading (cm) */
  distance?: number;
  /** Optional GPS coordinates */
  gps?: {
    latitude: number;
    longitude: number;
  } | null;
  /**
   * Audit flag: true if movement/distance was simulated (NEURICK hybrid demo).
   * This field is stored in the off-chain evidence record for transparency.
   * It is intentionally EXCLUDED from the canonical proof hash to ensure
   * the on-chain hash reflects only physical sensor data fields.
   */
  simulation?: boolean;
}

/**
 * Canonical proof hash response from the proof hash service.
 */
export interface ProofHashResult {
  proofHash: string;
  /** The normalized canonical JSON used to derive the hash */
  canonicalData: string;
}

/**
 * Write operation descriptions for all blockchain-mutating endpoints.
 * These document what will be connected to BridgeKey in Phase 5 (frontend).
 */
export interface WriteOperationInfo {
  implemented: boolean;
  contractFunction: string;
  signer: string;
  signingMethod: string;
  expectedStateTransition: string;
  emittedEvent: string;
  message: string;
}
