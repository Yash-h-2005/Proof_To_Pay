import { VerificationEngine } from "../src/verification/VerificationEngine";
import { ProofEvidence } from "../src/types/verification";
import { generateProofHash } from "../src/utils/proofHash";

const mockTask = {
  taskId: "T001",
  robot: "NR-001",
  packageId: "P01",
  source: "Zone A",
  destination: "Zone B",
};

const validEvidence: ProofEvidence = {
  taskId: "T001",
  robotId: "NR-001",
  packageId: "P01",
  source: "Zone A",
  destination: "Zone B",
  timestamp: 1600000000,
  rfidUid: "D9:33:6A:F8",
  distance: 12.4,
};

describe("Independent Verification Engine", () => {
  let engine: VerificationEngine;

  beforeEach(() => {
    engine = new VerificationEngine();
  });

  it("1. Valid T001 proof passes verification", () => {
    const { proofHash } = generateProofHash(validEvidence);
    const result = engine.verify(mockTask, validEvidence, proofHash);
    expect(result.verified).toBe(true);
  });

  it("2. Invalid task ID fails", () => {
    const evidence = { ...validEvidence, taskId: "T999" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Task ID")?.passed).toBe(false);
  });

  it("3. Invalid robot ID fails", () => {
    const evidence = { ...validEvidence, robotId: "NR-999" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Robot ID")?.passed).toBe(false);
  });

  it("4. Invalid package ID fails", () => {
    const evidence = { ...validEvidence, packageId: "P999" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Package ID")?.passed).toBe(false);
  });

  it("5. Invalid source fails", () => {
    const evidence = { ...validEvidence, source: "Zone Z" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Source")?.passed).toBe(false);
  });

  it("6. Invalid destination fails", () => {
    const evidence = { ...validEvidence, destination: "Zone Z" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Destination")?.passed).toBe(false);
  });

  it("7. Invalid RFID fails (Tampered RFID)", () => {
    const evidence = { ...validEvidence, rfidUid: "AA:BB:CC:DD" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "RFID Package Identity")?.passed).toBe(false);
  });

  it("8. Insufficient distance fails (Tampered distance)", () => {
    const evidence = { ...validEvidence, distance: 2.0 };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Distance")?.passed).toBe(false);
  });

  it("9. Missing timestamp fails", () => {
    const evidence = { ...validEvidence, timestamp: 0 };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Timestamp")?.passed).toBe(false);
  });

  it("10. Missing required evidence fails", () => {
    const evidence = { ...validEvidence, distance: undefined };
    const { proofHash } = generateProofHash(evidence as any);
    const result = engine.verify(mockTask, evidence as any, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Required Evidence")?.passed).toBe(false);
  });

  it("11. Modified proof hash fails", () => {
    const { proofHash } = generateProofHash(validEvidence);
    const fakeHash = proofHash.replace("0x1", "0x2").replace("a", "b");
    const result = engine.verify(mockTask, validEvidence, fakeHash);
    expect(result.verified).toBe(false);
    expect(result.checks.find(c => c.name === "Proof Hash Integrity")?.passed).toBe(false);
  });
  
  it("12. Tampered distance fails overall verification", () => {
    const evidence = { ...validEvidence, distance: 2.0 };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
  });

  it("13. Tampered RFID fails overall verification", () => {
    const evidence = { ...validEvidence, rfidUid: "AA:BB:CC:DD" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
  });

  it("14. Tampered task ID fails overall verification", () => {
    const evidence = { ...validEvidence, taskId: "T999" };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
  });

  it("15. Complete valid verification", () => {
    const { proofHash } = generateProofHash(validEvidence);
    const result = engine.verify(mockTask, validEvidence, proofHash);
    expect(result.verified).toBe(true);
    expect(result.checks.length).toBe(10);
  });

  it("16. Complete failed verification", () => {
    const evidence = { ...validEvidence, rfidUid: "AA:BB:CC:DD", distance: 2.0 };
    const { proofHash } = generateProofHash(evidence);
    const result = engine.verify(mockTask, evidence, proofHash);
    expect(result.verified).toBe(false);
    expect(result.checks.filter(c => !c.passed).length).toBe(2);
  });
});
