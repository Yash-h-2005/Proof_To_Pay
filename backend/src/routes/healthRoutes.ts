import { Router } from "express";

const router = Router();

/**
 * GET /api/health
 * Simple health check — no blockchain dependency.
 */
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Proof-to-Pay Backend",
    timestamp: new Date().toISOString(),
  });
});

export default router;
