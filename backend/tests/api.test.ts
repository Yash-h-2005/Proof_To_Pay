import request from "supertest";
import express from "express";
import cors from "cors";
import healthRoutes from "../src/routes/healthRoutes";
import taskRoutes from "../src/routes/taskRoutes";
import { generateProofHash } from "../src/services/taskService";

// ─── Test App ─────────────────────────────────────────────────────────────────
// A stripped-down Express instance for testing (no server.listen needed)

const testApp = express();
testApp.use(cors());
testApp.use(express.json());
testApp.use("/api/health", healthRoutes);
testApp.use("/api", taskRoutes);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Proof-to-Pay Backend API Tests", () => {

  // ── 1. Health Endpoint ──────────────────────────────────────────────────────
  describe("GET /api/health", () => {
    it("should return status ok", async () => {
      const res = await request(testApp).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.service).toBe("Proof-to-Pay Backend");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ── 2. Blockchain Information Endpoint ─────────────────────────────────────
  describe("GET /api/blockchain", () => {
    it("should return live MST Testnet connection info", async () => {
      const res = await request(testApp).get("/api/blockchain");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        network: "MST Testnet",
        chainId: 91562037,
        contractAddress: "0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347",
      });
      expect(typeof res.body.data.blockNumber).toBe("number");
      expect(res.body.data.blockNumber).toBeGreaterThan(0);
    }, 15000); // Allow 15s for RPC call
  });

  // ── 3. Real On-Chain Task Retrieval — T001 ─────────────────────────────────
  describe("GET /api/tasks/T001", () => {
    it("should retrieve real on-chain task T001 from MST Testnet", async () => {
      const res = await request(testApp).get("/api/tasks/T001");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const task = res.body.data;
      expect(task.taskId).toBe("T001");
      expect(task.packageId).toBe("P01");
      expect(task.source).toBe("Zone A");
      expect(task.destination).toBe("Zone B");
      expect(task.stateLabel).toBe("CREATED");
      expect(task.state).toBe(0);
      expect(task.rewardMSTC).toBe("100.0");
      expect(task.creator).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }, 15000); // Allow 15s for RPC call
  });

  // ── 4. Invalid Task Request Handling ──────────────────────────────────────
  describe("GET /api/tasks/:taskId — invalid cases", () => {
    it("should return 404 for a non-existent task", async () => {
      const res = await request(testApp).get("/api/tasks/DOES_NOT_EXIST_9999");
      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found on-chain");
    }, 15000);
  });

  // ── 5. Proof Hash Generation ───────────────────────────────────────────────
  describe("Proof Hash Service", () => {
    it("should generate a deterministic keccak256 proof hash", () => {
      const evidence = {
        taskId: "T001",
        robotId: "R01",
        packageId: "P01",
        source: "Zone A",
        destination: "Zone B",
        timestamp: 1700000000,
        rfidUid: "AABBCCDD",
      };

      const result1 = generateProofHash(evidence);
      const result2 = generateProofHash(evidence);

      expect(result1.proofHash).toBe(result2.proofHash);
      expect(result1.proofHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result1.canonicalData).toContain("T001");
    });

    it("should generate different hashes for different evidence", () => {
      const evidenceA = {
        taskId: "T001", robotId: "R01", packageId: "P01",
        source: "Zone A", destination: "Zone B", timestamp: 1700000000,
      };
      const evidenceB = {
        ...evidenceA,
        timestamp: 1700001234, // Different timestamp
      };

      const hashA = generateProofHash(evidenceA).proofHash;
      const hashB = generateProofHash(evidenceB).proofHash;
      expect(hashA).not.toBe(hashB);
    });

    it("POST /api/tasks/T001/proof should return proofHash from evidence", async () => {
      const res = await request(testApp)
        .post("/api/tasks/T001/proof")
        .send({
          robotId: "R01",
          packageId: "P01",
          source: "Zone A",
          destination: "Zone B",
          timestamp: 1700000000,
          rfidUid: "AABBCCDD",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.proofHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(res.body.taskId).toBe("T001");
    });

    it("POST /api/tasks/T001/proof should return 400 if required fields missing", async () => {
      const res = await request(testApp)
        .post("/api/tasks/T001/proof")
        .send({ robotId: "R01" }); // Missing required fields
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // ── 6. Write Operation Stubs ───────────────────────────────────────────────
  describe("Write operation stubs — BridgeKey pending", () => {
    it("POST /api/tasks should return implemented:false info", async () => {
      const res = await request(testApp).post("/api/tasks").send({});
      expect(res.status).toBe(200);
      expect(res.body.implemented).toBe(false);
      expect(res.body.contractFunction).toBeDefined();
    });

    it("POST /api/tasks/T001/fund should return implemented:false info", async () => {
      const res = await request(testApp).post("/api/tasks/T001/fund").send({});
      expect(res.status).toBe(200);
      expect(res.body.implemented).toBe(false);
    });
  });
});
