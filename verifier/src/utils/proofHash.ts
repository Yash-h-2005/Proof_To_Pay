import { ethers } from "ethers";
import { ProofEvidence } from "../types/verification";

export function generateProofHash(evidence: ProofEvidence): { proofHash: string; canonicalData: string } {
  // Canonical JSON: sorted keys, no extra whitespace
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
