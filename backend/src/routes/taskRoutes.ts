import { Router } from "express";
import {
  getTask,
  getAllTasks,
  getBlockchain,
  postCreateTask,
  postFundTask,
  postAssignRobot,
  postStartTask,
  postGenerateProofHash,
  postVerifyTask,
  postReleasePayment,
  postRefundTask,
  getRobotStatus,
  getTaskEvidence,
} from "../controllers/taskController";

const router = Router();

// ─── Blockchain Info ──────────────────────────────────────────────────────────
router.get("/blockchain", getBlockchain);

// ─── Read-Only Task Endpoints ─────────────────────────────────────────────────
router.get("/tasks", getAllTasks);
router.get("/tasks/:taskId", getTask);

// ─── Write Operation Stubs (BridgeKey in Phase 5) ─────────────────────────────
router.post("/tasks", postCreateTask);
router.post("/tasks/:id/fund", postFundTask);
router.post("/tasks/:id/assign", postAssignRobot);
router.post("/tasks/:id/start", postStartTask);
router.post("/tasks/:id/verify", postVerifyTask);
router.post("/tasks/:id/release", postReleasePayment);
router.post("/tasks/:id/refund", postRefundTask);

// ─── Proof Hash Generation ────────────────────────────────────────────────────
router.post("/tasks/:id/proof", postGenerateProofHash);
router.get("/tasks/:id/evidence", getTaskEvidence);

// ─── Robot Service ────────────────────────────────────────────────────────────
router.get("/robot/:robotId/status", getRobotStatus);

export default router;
