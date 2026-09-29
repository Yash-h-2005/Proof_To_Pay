import { ethers } from 'ethers';

/**
 * Task state enum — mirrors ProofToPay.sol TaskState exactly.
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

export const TASK_STATE_LABELS: Record<number, string> = {
  [TaskState.CREATED]: 'CREATED',
  [TaskState.FUNDED]: 'FUNDED',
  [TaskState.ASSIGNED]: 'ASSIGNED',
  [TaskState.WORKING]: 'WORKING',
  [TaskState.PROOF_SUBMITTED]: 'PROOF SUBMITTED',
  [TaskState.VERIFIED]: 'VERIFIED',
  [TaskState.PAID]: 'PAID',
  [TaskState.REFUNDED]: 'REFUNDED',
};

export const TASK_STATE_COLORS: Record<number, string> = {
  [TaskState.CREATED]: '#64748b',
  [TaskState.FUNDED]: '#3b82f6',
  [TaskState.ASSIGNED]: '#8b5cf6',
  [TaskState.WORKING]: '#f97316',
  [TaskState.PROOF_SUBMITTED]: '#eab308',
  [TaskState.VERIFIED]: '#22c55e',
  [TaskState.PAID]: '#10b981',
  [TaskState.REFUNDED]: '#ef4444',
};

/** Task as returned from the deployed ProofToPay contract */
export interface OnChainTask {
  taskId: string;
  creator: string;
  robot: string;
  /** Reward in wei as bigint */
  rewardWei: bigint;
  /** Reward in MSTC (human-readable) */
  rewardMSTC: string;
  packageId: string;
  source: string;
  destination: string;
  proofHash: string;
  state: TaskState;
  stateLabel: string;
  createdAt: number;
  proofSubmittedAt: number;
  verifiedAt: number;
}

/** Parses raw ethers.js contract tuple into a typed OnChainTask */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOnChainTask(raw: any): OnChainTask {
  const stateNum = Number(raw.state) as TaskState;
  return {
    taskId: raw.taskId as string,
    creator: raw.creator as string,
    robot: raw.robot as string,
    rewardWei: raw.reward as bigint,
    rewardMSTC: ethers.formatEther(raw.reward as bigint),
    packageId: raw.packageId as string,
    source: raw.source as string,
    destination: raw.destination as string,
    proofHash: raw.proofHash as string,
    state: stateNum,
    stateLabel: TASK_STATE_LABELS[stateNum] ?? 'UNKNOWN',
    createdAt: Number(raw.createdAt),
    proofSubmittedAt: Number(raw.proofSubmittedAt),
    verifiedAt: Number(raw.verifiedAt),
  };
}

/** Summary stats derived from a list of tasks */
export interface TaskSummary {
  total: number;
  active: number;
  escrowedMSTC: string;
  verified: number;
  paid: number;
}

export function computeTaskSummary(tasks: OnChainTask[]): TaskSummary {
  const activeStates = [
    TaskState.FUNDED,
    TaskState.ASSIGNED,
    TaskState.WORKING,
    TaskState.PROOF_SUBMITTED,
  ];
  const active = tasks.filter((t) => activeStates.includes(t.state)).length;
  const verified = tasks.filter((t) => t.state === TaskState.VERIFIED).length;
  const paid = tasks.filter((t) => t.state === TaskState.PAID).length;
  const escrowedWei = tasks
    .filter((t) => activeStates.includes(t.state))
    .reduce((sum, t) => sum + t.rewardWei, BigInt(0));

  return {
    total: tasks.length,
    active,
    escrowedMSTC: ethers.formatEther(escrowedWei),
    verified,
    paid,
  };
}

/** Transaction lifecycle state for create task UX */
export type TxStep =
  | 'idle'
  | 'preparing'
  | 'awaiting-approval'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed';

export const TX_STEP_LABELS: Record<TxStep, string> = {
  idle: '',
  preparing: 'Preparing transaction...',
  'awaiting-approval': 'Waiting for wallet approval...',
  submitted: 'Transaction submitted to MST Testnet',
  confirming: 'Waiting for block confirmation...',
  confirmed: 'Task created successfully!',
  failed: 'Transaction failed.',
};

/** Backend API task response shape */
export interface ApiTask {
  taskId: string;
  creator: string;
  robot: string;
  rewardWei: string;
  rewardMSTC: string;
  packageId: string;
  source: string;
  destination: string;
  proofHash: string;
  state: number;
  stateLabel: string;
  createdAt: number;
  proofSubmittedAt: number;
  verifiedAt: number;
}
