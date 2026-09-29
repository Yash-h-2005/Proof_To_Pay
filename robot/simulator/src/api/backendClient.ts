/**
 * BackendClient — HTTP client for the Proof-to-Pay backend API.
 *
 * The simulator communicates with the Phase 4 backend only.
 * It does NOT connect to the blockchain directly.
 * All blockchain interactions are handled by the backend.
 *
 * Architecture:
 *   Simulator → BackendClient → Backend API → MST Testnet → ProofToPay Contract
 *
 * Security:
 *   - No private keys in this module.
 *   - No blockchain signing credentials.
 *   - The simulator only submits proof evidence — it does not sign transactions.
 */

import { SIMULATOR_CONFIG } from '../config';
import type { ProofEvidence } from '../proof/ProofGenerator';

const BASE_URL = SIMULATOR_CONFIG.backendUrl;

/** Task data as returned by GET /api/tasks/:taskId */
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

/** Result of submitting proof evidence to POST /api/tasks/:id/proof */
export interface ProofSubmissionResult {
  success: boolean;
  proofHash: string;
  canonicalData: string;
  note?: string;
}

/** Raw fetch wrapper — throws on non-2xx with a clear message */
async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `ProofToPay-RobotSimulator/NR-001`,
        ...(options?.headers ?? {}),
      },
    });
  } catch (networkErr) {
    throw new Error(
      `BACKEND UNAVAILABLE — could not reach ${BASE_URL}. ` +
        `Is the backend running? (npm run dev in backend/)\n` +
        String(networkErr)
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(body.error ?? `Backend returned HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export class BackendClient {
  /**
   * GET /api/health
   * Verifies the backend is running before starting task execution.
   */
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    return apiFetch<{ status: string; timestamp: string }>('/api/health');
  }

  /**
   * GET /api/tasks/:taskId
   * Fetches the task from the backend (which reads from MST Testnet).
   */
  async getTask(taskId: string): Promise<ApiTask> {
    const res = await apiFetch<{ success: boolean; data: ApiTask }>(
      `/api/tasks/${encodeURIComponent(taskId)}`
    );
    return res.data;
  }

  /**
   * POST /api/tasks/:taskId/proof
   * Submits the robot's proof evidence.
   * The backend handles canonical hashing and returns the keccak256 proofHash.
   *
   * This follows the Phase 4 backend ProofEvidence interface exactly.
   */
  async submitProof(
    taskId: string,
    evidence: ProofEvidence
  ): Promise<ProofSubmissionResult> {
    const res = await apiFetch<ProofSubmissionResult>(
      `/api/tasks/${encodeURIComponent(taskId)}/proof`,
      {
        method: 'POST',
        body: JSON.stringify({
          robotId: evidence.robotId,
          packageId: evidence.packageId,
          source: evidence.source,
          destination: evidence.destination,
          timestamp: evidence.timestamp,
          rfidUid: evidence.rfidUid,
          distance: evidence.distance,
          gps: evidence.gps,
        }),
      }
    );
    return res;
  }
}
