import { Request, Response } from "express";
import {
  fetchTask,
  fetchAllTasks,
  getBlockchainInfo,
  generateProofHash,
  describeWriteOperation,
  RobotService,
  proofStore
} from "../services/taskService";
import { ProofEvidence } from "../types/task";

// ─── Read Endpoints ───────────────────────────────────────────────────────────

/**
 * GET /api/tasks/:taskId
 * Reads task directly from the deployed ProofToPay contract on MST Testnet.
 */
export async function getTask(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;

  if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  try {
    const task = await fetchTask(taskId.trim());
    if (!task) {
      res.status(404).json({ error: `Task "${taskId}" not found on-chain` });
      return;
    }
    res.json({ success: true, data: task });
  } catch (err) {
    console.error(`[getTask] Error fetching task ${taskId}:`, err);
    res.status(500).json({ error: "Failed to fetch task from blockchain" });
  }
}

/**
 * GET /api/tasks
 * Returns all tasks recorded on the deployed contract.
 */
export async function getAllTasks(_req: Request, res: Response): Promise<void> {
  try {
    const tasks = await fetchAllTasks();
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    console.error("[getAllTasks] Error:", err);
    res.status(500).json({ error: "Failed to fetch tasks from blockchain" });
  }
}

/**
 * GET /api/blockchain
 * Returns live MST Testnet connectivity and contract information.
 */
export async function getBlockchain(_req: Request, res: Response): Promise<void> {
  try {
    const info = await getBlockchainInfo();
    res.json({ success: true, data: info });
  } catch (err) {
    console.error("[getBlockchain] Error:", err);
    res
      .status(500)
      .json({ error: "Failed to connect to MST Testnet RPC" });
  }
}

// ─── Write Operation Stubs ────────────────────────────────────────────────────

/**
 * POST /api/tasks
 * Documents the createTask write operation.
 * BridgeKey signing in Phase 5 frontend.
 */
export function postCreateTask(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("createTask"));
}

/**
 * POST /api/tasks/:id/fund
 */
export function postFundTask(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("fundTask"));
}

/**
 * POST /api/tasks/:id/assign
 */
export function postAssignRobot(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("assignRobot"));
}

/**
 * POST /api/tasks/:id/start
 */
export function postStartTask(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("startTask"));
}

/**
 * POST /api/tasks/:id/verify
 */
export function postVerifyTask(req: Request, res: Response): void {
  const taskId = req.params.id ?? req.params.taskId;
  const body = req.body;
  if (body && typeof body.verified === 'boolean') {
    res.json({
      success: true,
      taskId,
      verified: body.verified,
      verifierId: body.verifierId || "VERIFIER-001",
      proofHash: body.proofHash,
      checks: body.checks || [],
      message: "Verification result received. In Phase 7, no blockchain transaction is created."
    });
    return;
  }
  res.status(200).json(describeWriteOperation("verifyTask"));
}

/**
 * POST /api/tasks/:id/release
 */
export function postReleasePayment(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("releasePayment"));
}

/**
 * POST /api/tasks/:id/refund
 */
export function postRefundTask(_req: Request, res: Response): void {
  res.status(200).json(describeWriteOperation("refundTask"));
}

// ─── Proof Hash Endpoint ──────────────────────────────────────────────────────

/**
 * POST /api/tasks/:id/proof
 * Accepts physical sensor evidence and returns a deterministic keccak256 hash.
 * The hash is what gets submitted on-chain — NOT the raw evidence.
 */
export function postGenerateProofHash(req: Request, res: Response): void {
  // Route param is :id (not :taskId) — see taskRoutes.ts
  const taskId = req.params.id ?? req.params.taskId;
  const body = req.body as Partial<ProofEvidence>;

  if (!body.robotId || !body.packageId || !body.source || !body.destination || !body.timestamp) {
    res.status(400).json({
      error: "Missing required proof evidence fields: robotId, packageId, source, destination, timestamp",
    });
    return;
  }

  const evidence: ProofEvidence = {
    taskId,
    robotId: body.robotId,
    packageId: body.packageId,
    source: body.source,
    destination: body.destination,
    timestamp: Number(body.timestamp),
    rfidUid: body.rfidUid,
    distance: body.distance !== undefined ? Number(body.distance) : undefined,
    gps: body.gps,
    // Preserve simulation audit flag for off-chain transparency.
    // NOTE: simulation is intentionally NOT part of the canonical proof hash.
    // The canonical hash only covers: taskId, robotId, packageId, source,
    // destination, timestamp, rfidUid, distance, gps.
    ...(body.simulation !== undefined && { simulation: Boolean(body.simulation) }),
  };

  const result = generateProofHash(evidence);
  
  // Store evidence in memory for Phase 7 verifier
  proofStore.set(taskId, evidence);

  res.json({
    success: true,
    taskId,
    proofHash: result.proofHash,
    canonicalData: result.canonicalData,
    note: "Submit this proofHash on-chain via submitProof(taskId, proofHash). Raw evidence stays off-chain.",
  });
}

// ─── Evidence Storage Endpoints ───────────────────────────────────────────────

/**
 * GET /api/tasks/:id/evidence
 * Retrieves stored proof evidence for a task (development only)
 */
export function getTaskEvidence(req: Request, res: Response): void {
  const taskId = req.params.id ?? req.params.taskId;
  const evidence = proofStore.get(taskId);
  if (!evidence) {
    res.status(404).json({ error: "Evidence not found for this task." });
    return;
  }
  res.json({ success: true, data: evidence });
}

// ─── Robot Service Endpoints ──────────────────────────────────────────────────

/**
 * GET /api/robot/:robotId/status
 */
export async function getRobotStatus(req: Request, res: Response): Promise<void> {
  const { robotId } = req.params;
  const status = await RobotService.getRobotStatus(robotId);
  res.json({ success: true, data: status });
}
