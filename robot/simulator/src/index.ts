/**
 * Proof-to-Pay Robot Simulator — CLI Entry Point
 *
 * Usage:
 *   npm run simulate            # simulates T001 (default)
 *   npm run simulate -- T002   # simulates a specific task ID
 *
 * Architecture:
 *   CLI → BackendClient → Backend API (port 3001) → MST Testnet → ProofToPay contract
 *
 * No blockchain signing in this module. The simulator only reads tasks and
 * submits proof evidence to the backend.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { BackendClient } from './api/backendClient';
import { RobotSimulator } from './robot/RobotSimulator';
import { SIMULATOR_CONFIG } from './config';

// Load .env if present (optional — all defaults are hard-coded in config.ts)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Parse task ID from CLI args ─────────────────────────────────────────────
// Support: npm run simulate -- T001  or  ts-node src/index.ts T001
const args = process.argv.slice(2);
const taskId = args[0] ?? 'T001';

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\n[${SIMULATOR_CONFIG.robotId}] Initializing robot simulator...`);
  console.log(`[${SIMULATOR_CONFIG.robotId}] Target task: ${taskId}`);
  console.log(`[${SIMULATOR_CONFIG.robotId}] Backend: ${SIMULATOR_CONFIG.backendUrl}`);
  console.log();

  const client = new BackendClient();
  const simulator = new RobotSimulator();

  // ── Step 1: Health check ──────────────────────────────────────────────────
  console.log('[NR-001] Checking backend health...');
  try {
    const health = await client.checkHealth();
    console.log(`[NR-001] ✓ Backend online — ${health.status} @ ${health.timestamp}\n`);
  } catch (err) {
    console.error(`[NR-001] ✗ BACKEND UNAVAILABLE`);
    console.error(`         ${String(err)}`);
    console.error(`\n         Make sure the backend is running:`);
    console.error(`         cd backend && npm run dev\n`);
    process.exit(1);
  }

  // ── Step 2: Fetch task ────────────────────────────────────────────────────
  console.log(`[NR-001] Fetching task ${taskId} from backend...`);
  let task;
  try {
    task = await client.getTask(taskId);
    console.log(`[NR-001] ✓ Task found: ${task.taskId} | State: ${task.stateLabel}`);
    console.log(`         Package: ${task.packageId} | ${task.source} → ${task.destination}`);
    console.log(`         Reward: ${task.rewardMSTC} MSTC\n`);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('not found')) {
      console.error(`[NR-001] ✗ Task "${taskId}" not found on-chain.`);
    } else {
      console.error(`[NR-001] ✗ Failed to fetch task: ${msg}`);
    }
    process.exit(1);
  }

  // ── Step 3: Execute task ──────────────────────────────────────────────────
  try {
    await simulator.executeTask(task);
  } catch (err) {
    const msg = String(err);
    console.error(`\n[NR-001] ✗ Task execution failed:`);
    console.error(`         ${msg}`);

    if (msg.includes('RFID detection failed')) {
      console.error('\n         → RFID tag not detected at source location.');
      console.error('           In real operation: check RC522 alignment.');
    } else if (msg.includes('Proof submission')) {
      console.error('\n         → Proof could not be submitted to backend.');
      console.error('           Check backend connection and logs.');
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
