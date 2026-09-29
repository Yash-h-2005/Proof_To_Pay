import express from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRoutes from "./routes/healthRoutes";
import taskRoutes from "./routes/taskRoutes";
import { verifyConnection } from "./blockchain/provider";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/health", healthRoutes);
app.use("/api", taskRoutes);

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     Proof-to-Pay Backend Starting...     ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Contract: ${env.PROOF_TO_PAY_CONTRACT}`);
  console.log(`CORS Origin: ${env.CORS_ORIGIN}`);

  try {
    const conn = await verifyConnection();
    console.log(`✓ MST Testnet connected`);
    console.log(`  Network:     MST Testnet`);
    console.log(`  Chain ID:    ${conn.chainId}`);
    console.log(`  Block:       ${conn.blockNumber}`);
    console.log(`  RPC:         ${env.MST_RPC_URL}`);
  } catch (err) {
    console.error("✗ Warning: Could not connect to MST Testnet at startup:", err);
    console.error("  The server will still start — blockchain endpoints will return errors until RPC is reachable.");
  }

  app.listen(env.PORT, () => {
    console.log(`\n✓ Server running on http://localhost:${env.PORT}`);
    console.log(`  Health:     GET http://localhost:${env.PORT}/api/health`);
    console.log(`  Blockchain: GET http://localhost:${env.PORT}/api/blockchain`);
    console.log(`  Task T001:  GET http://localhost:${env.PORT}/api/tasks/T001`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

export default app;
