/**
 * ProofGenerator — assembles sensor evidence into a structured proof payload.
 *
 * Design principle:
 *   - The simulator generates the EVIDENCE OBJECT (off-chain).
 *   - The BACKEND is responsible for canonical hashing (keccak256).
 *   - The SMART CONTRACT stores only the hash — not the raw evidence.
 *
 * This matches the backend's existing generateProofHash() implementation in
 * backend/src/services/taskService.ts which uses:
 *   keccak256(JSON.stringify(canonical, Object.keys(canonical).sort()))
 *
 * The simulator sends the evidence to the backend via POST /api/tasks/:id/proof
 * and receives the proofHash in return.
 */

import type { GpsReading } from '../sensors/GpsSensorSimulator';

/**
 * Structured proof evidence — matches the backend ProofEvidence type exactly.
 * All field names must match backend/src/types/task.ts ProofEvidence.
 */
export interface ProofEvidence {
  taskId: string;
  robotId: string;
  packageId: string;
  source: string;
  destination: string;
  /** Unix timestamp in seconds when evidence was collected */
  timestamp: number;
  /** SIMULATED: RFID UID from RC522 reader (or real UID from hardware testing) */
  rfidUid?: string;
  /** SIMULATED: Encoder distance reading in metres */
  distance?: number;
  /** SIMULATED: GPS coordinates (disabled by default — no real NMEA data) */
  gps?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Proof bundle — the full evidence object with simulation metadata.
 * The proofHash is populated AFTER the backend returns it.
 */
export interface ProofBundle {
  evidence: ProofEvidence;
  /** True — all sensor values are simulated */
  simulation: true;
  /** ISO timestamp when the proof bundle was assembled */
  generatedAt: string;
  /** Populated after backend submission */
  proofHash: string | null;
  /** Populated after backend submission */
  canonicalData: string | null;
}

export class ProofGenerator {
  /**
   * Assembles a ProofBundle from the completed task execution data.
   *
   * NOTE: sensor values marked with [SIM] are simulated, not from real hardware.
   * The rfidUid "D9:33:6A:F8" was obtained from bench testing of the physical
   * RC522 hardware, so it reflects a real RFID tag — but the read itself is
   * simulated (not live from the hardware).
   */
  generate(params: {
    taskId: string;
    robotId: string;
    packageId: string;
    source: string;
    destination: string;
    rfidUid?: string;            // [SIM] RFID UID
    distanceMetres?: number;     // [SIM] Encoder distance
    gps?: GpsReading;            // [SIM] GPS (disabled by default)
  }): ProofBundle {
    const evidence: ProofEvidence = {
      taskId: params.taskId,
      robotId: params.robotId,
      packageId: params.packageId,
      source: params.source,
      destination: params.destination,
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (params.rfidUid) evidence.rfidUid = params.rfidUid;
    if (params.distanceMetres !== undefined) evidence.distance = params.distanceMetres;
    if (params.gps) {
      evidence.gps = {
        latitude: params.gps.latitude,
        longitude: params.gps.longitude,
      };
    }

    return {
      evidence,
      simulation: true,
      generatedAt: new Date().toISOString(),
      proofHash: null,
      canonicalData: null,
    };
  }

  /** Fills in the proofHash and canonicalData returned by the backend */
  attachHash(bundle: ProofBundle, proofHash: string, canonicalData: string): ProofBundle {
    return {
      ...bundle,
      proofHash,
      canonicalData,
    };
  }
}
