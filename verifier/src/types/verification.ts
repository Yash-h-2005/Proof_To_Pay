export interface VerificationCheck {
  name: string;
  passed: boolean;
  expected?: string | number;
  actual?: string | number;
  reason: string;
}

export interface VerificationResult {
  taskId: string;
  robotId: string;
  verified: boolean;
  checks: VerificationCheck[];
  proofHash: string;
  timestamp: number;
  verifierId: string;
}

export interface ProofEvidence {
  taskId: string;
  robotId: string;
  packageId: string;
  source: string;
  destination: string;
  timestamp: number;
  rfidUid?: string;
  distance?: number;
  gps?: {
    latitude: number;
    longitude: number;
  } | null;
  /**
   * Audit flag from NEURICK hybrid demo.
   * simulation=true is permitted for this prototype.
   * No verification rule requires simulation=false.
   */
  simulation?: boolean;
}
