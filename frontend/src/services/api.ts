/**
 * Backend API service — communicates with the Phase 4 Express backend.
 *
 * The backend is a gateway to the deployed ProofToPay contract.
 * The blockchain is the source of truth — the backend only reads/proxies data.
 */

import { ethers } from 'ethers';
import { BACKEND_URL } from '../blockchain/config';
import type { ApiTask } from '../types/task';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ApiError {
  error: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = BACKEND_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const primaryUrl = `${baseUrl}${cleanPath}`;
  try {
    const res = await fetch(primaryUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as ApiError;
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    // If running in browser and direct request failed (e.g. CORS mismatch), try relative path via Vite proxy
    if (typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch(path, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
          },
        });
        if (fallbackRes.ok) {
          return fallbackRes.json() as Promise<T>;
        }
      } catch {
        // Fallback failed, throw original error
      }
    }
    throw err;
  }
}

/** GET /api/health */
export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  return apiFetch('/api/health');
}

/** GET /api/blockchain */
export async function getBlockchainInfo(): Promise<{
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: string;
  blockNumber: number;
}> {
  const res = await apiFetch<ApiResponse<ReturnType<typeof getBlockchainInfo>>>('/api/blockchain');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res as any).data;
}

/** GET /api/tasks */
export async function getAllTasks(): Promise<ApiTask[]> {
  const res = await apiFetch<{ success: boolean; count: number; data: ApiTask[] }>('/api/tasks');
  return res.data;
}

/** GET /api/tasks/:taskId */
export async function getTask(taskId: string): Promise<ApiTask> {
  const res = await apiFetch<ApiResponse<ApiTask>>(`/api/tasks/${encodeURIComponent(taskId)}`);
  return res.data;
}

/** POST /api/tasks/:taskId/proof — generate proof hash from evidence */
export async function submitProofEvidence(
  taskId: string,
  evidence: {
    robotId: string;
    packageId: string;
    source: string;
    destination: string;
    timestamp: number;
    rfidUid?: string;
  }
): Promise<{ proofHash: string; canonicalData: string }> {
  return apiFetch<{ proofHash: string; canonicalData: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/proof`,
    {
      method: 'POST',
      body: JSON.stringify(evidence),
    }
  );
}

export interface TaskEvidence {
  taskId: string;
  robotId: string;
  packageId: string;
  source: string;
  destination: string;
  timestamp: number;
  rfidUid?: string;
  distance?: number;
  gps?: string | null;
  simulation?: boolean;
}

/** GET /api/tasks/:taskId/evidence — retrieve sensor evidence from backend proofStore */
export async function getTaskEvidence(taskId: string): Promise<TaskEvidence | null> {
  try {
    const res = await apiFetch<{ success: boolean; data: TaskEvidence }>(
      `/api/tasks/${encodeURIComponent(taskId)}/evidence`
    );
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Computes deterministic keccak256 proof hash for physical evidence matching
 * backend and smart contract specification.
 */
export function computeProofHash(evidence: TaskEvidence): { proofHash: string; canonicalData: string } {
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

