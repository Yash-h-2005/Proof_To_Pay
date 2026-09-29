import { VerificationCheck, ProofEvidence } from "../types/verification";
import { VERIFIER_CONFIG } from "../config";
import { generateProofHash } from "../utils/proofHash";

export class VerificationRules {
  
  static checkTaskId(expected: string, actual?: string): VerificationCheck {
    return {
      name: "Task ID",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "Matches expected Task ID." : "Task ID mismatch."
    };
  }

  static checkRobotId(expected: string, actual?: string): VerificationCheck {
    return {
      name: "Robot ID",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "Matches expected Robot ID." : "Robot ID mismatch."
    };
  }

  static checkPackageId(expected: string, actual?: string): VerificationCheck {
    return {
      name: "Package ID",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "Matches expected Package ID." : "Package ID mismatch."
    };
  }

  static checkSource(expected: string, actual?: string): VerificationCheck {
    return {
      name: "Source",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "Matches expected Source." : "Source mismatch."
    };
  }

  static checkDestination(expected: string, actual?: string): VerificationCheck {
    return {
      name: "Destination",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "Matches expected Destination." : "Destination mismatch."
    };
  }

  static checkRfid(expected: string, actual?: string): VerificationCheck {
    return {
      name: "RFID Package Identity",
      passed: expected === actual,
      expected,
      actual,
      reason: expected === actual ? "RFID matches expected package identity." : "RFID mismatch."
    };
  }

  static checkDistance(actual?: number): VerificationCheck {
    const passed = typeof actual === "number" && actual >= VERIFIER_CONFIG.minimumDistance;
    return {
      name: "Distance",
      passed,
      expected: `>= ${VERIFIER_CONFIG.minimumDistance}m`,
      actual: actual !== undefined ? `${actual}m` : undefined,
      reason: passed ? "Distance meets minimum required threshold." : "Distance insufficient."
    };
  }

  static checkTimestamp(actual?: number): VerificationCheck {
    const passed = typeof actual === "number" && actual > 0;
    return {
      name: "Timestamp",
      passed,
      expected: "> 0",
      actual,
      reason: passed ? "Valid positive Unix timestamp." : "Invalid or missing timestamp."
    };
  }

  static checkRequiredEvidence(evidence: ProofEvidence): VerificationCheck {
    const passed = !!(
      evidence.taskId &&
      evidence.robotId &&
      evidence.packageId &&
      evidence.source &&
      evidence.destination &&
      evidence.timestamp &&
      evidence.rfidUid &&
      evidence.distance !== undefined
    );
    return {
      name: "Required Evidence",
      passed,
      reason: passed ? "All required evidence fields present." : "Missing required evidence fields."
    };
  }

  static checkProofHashIntegrity(submittedHash: string, evidence: ProofEvidence): VerificationCheck {
    const { proofHash: calculatedHash } = generateProofHash(evidence);
    const passed = submittedHash === calculatedHash;
    return {
      name: "Proof Hash Integrity",
      passed,
      expected: submittedHash,
      actual: calculatedHash,
      reason: passed ? "Calculated hash matches submitted hash." : "Hash mismatch. Evidence may have been tampered with."
    };
  }
}
