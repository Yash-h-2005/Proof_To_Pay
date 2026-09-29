import express from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRoutes from "./routes/healthRoutes";
import taskRoutes from "./routes/taskRoutes";
import { verifyConnection } from "./blockchain/provider";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

const configuredOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim().replace(/\/+$/, ""));

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, hardware bridge, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      const cleanOrigin = requestOrigin.replace(/\/+$/, "");
      // Allow if wildcard configured or in explicit origins list
      if (env.CORS_ORIGIN === "*" || configuredOrigins.includes("*") || configuredOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      // Allow Vercel preview and production domains (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(cleanOrigin)) {
        return callback(null, true);
      }
      // Allow localhost dev origins
      if (/^http:\/\/localhost(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${requestOrigin}`));
    },
    credentials: true,
  })
);
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

  const HOST = process.env.HOST ?? "0.0.0.0";
  app.listen(env.PORT, HOST, () => {
    console.log(`\n✓ Server running on http://${HOST}:${env.PORT}`);
    console.log(`  Health:     GET http://${HOST}:${env.PORT}/api/health`);
    console.log(`  Blockchain: GET http://${HOST}:${env.PORT}/api/blockchain`);
    console.log(`  Task T001:  GET http://${HOST}:${env.PORT}/api/tasks/T001`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

export default app;
