/**
 * RobotSimulator — orchestrates the full task execution lifecycle for NR-001.
 *
 * Flow:
 *   IDLE → ASSIGNED → MOVING_TO_SOURCE → PACKAGE_DETECTED →
 *   MOVING_TO_DESTINATION → DESTINATION_REACHED → PROOF_GENERATED → COMPLETED
 *
 * NOTE: This is a SOFTWARE SIMULATION.
 * No real motor control, hardware sensors, or physical movement.
 * All sensor values are clearly labelled SIMULATED.
 */

import { SIMULATOR_CONFIG } from '../config';
import {
  RobotState,
  createInitialContext,
  isValidTransition,
  type RobotContext,
} from './RobotState';
import { simulateMovement, getSimulatedRouteDistance } from './RobotMovement';
import { RfidSensorSimulator } from '../sensors/RfidSensorSimulator';
import { EncoderSensorSimulator } from '../sensors/EncoderSensorSimulator';
import { GpsSensorSimulator } from '../sensors/GpsSensorSimulator';
import { ProofGenerator, type ProofBundle } from '../proof/ProofGenerator';
import { BackendClient, type ApiTask } from '../api/backendClient';

export class RobotSimulator {
  private ctx: RobotContext;
  private readonly rfid: RfidSensorSimulator;
  private readonly encoder: EncoderSensorSimulator;
  private readonly gps: GpsSensorSimulator;
  private readonly proofGen: ProofGenerator;
  private readonly backend: BackendClient;

  private stepCounter: number = 0;
  private lastProof: ProofBundle | null = null;

  constructor(
    rfidOverride?: RfidSensorSimulator,
    backendOverride?: BackendClient
  ) {
    this.ctx = createInitialContext(SIMULATOR_CONFIG.robotId);
    this.rfid = rfidOverride ?? new RfidSensorSimulator();
    this.encoder = new EncoderSensorSimulator();
    this.gps = new GpsSensorSimulator();
    this.proofGen = new ProofGenerator();
    this.backend = backendOverride ?? new BackendClient();
  }

  // ─── State Machine ─────────────────────────────────────────────────────────

  private transition(to: RobotState, reason?: string): void {
    if (!isValidTransition(this.ctx.state, to)) {
      throw new Error(
        `Invalid state transition: ${this.ctx.state} → ${to}` +
          (reason ? ` (${reason})` : '')
      );
    }
    this.ctx.state = to;
    this.ctx.lastUpdatedAt = Math.floor(Date.now() / 1000);
  }

  private step(message: string): void {
    this.stepCounter++;
    console.log(`[${this.stepCounter}] ${message}`);
  }

  getContext(): RobotContext {
    return { ...this.ctx };
  }

  getState(): RobotState {
    return this.ctx.state;
  }

  getLastProof(): ProofBundle | null {
    return this.lastProof;
  }

  // ─── Main Entry Point ──────────────────────────────────────────────────────

  /**
   * Executes the full task lifecycle for a given task.
   *
   * Call with a task obtained from the backend:
   *   const task = await backend.getTask('T001');
   *   await simulator.executeTask(task);
   */
  async executeTask(task: ApiTask): Promise<ProofBundle> {
    this.stepCounter = 0;
    this.encoder.reset();

    printBanner(this.ctx.robotId, task.taskId, task.packageId);

    // ── 1. ASSIGNED ──────────────────────────────────────────────────────────
    this.transition(RobotState.ASSIGNED);
    this.ctx.taskId = task.taskId;
    this.ctx.packageId = task.packageId;
    this.ctx.source = task.source;
    this.ctx.destination = task.destination;
    this.step(`ASSIGNED — Task ${task.taskId} accepted`);
    console.log(`       Package: ${task.packageId} | Reward: ${task.rewardMSTC} MSTC`);

    // ── 2. MOVING TO SOURCE ───────────────────────────────────────────────────
    this.transition(RobotState.MOVING_TO_SOURCE);
    this.step(`MOVING TO SOURCE — Navigating to ${task.source}`);
    console.log(`       [SIM] Route: ${task.source} → ${task.destination}`);

    const routeDist = getSimulatedRouteDistance(task.source, task.destination);
    this.ctx.totalDistance = routeDist;

    // Simulate movement to source (half the total distance)
    await simulateMovement(
      task.source,
      routeDist / 2,
      SIMULATOR_CONFIG.movementStepSize,
      SIMULATOR_CONFIG.movementIntervalMs,
      (s) => {
        this.ctx.distanceCovered = s.distanceCovered;
        this.encoder.setDistance(s.distanceCovered);
        if (SIMULATOR_CONFIG.logMovementSteps) {
          const bar = '█'.repeat(Math.floor(s.distanceCovered / s.totalDistance * 10));
          const empty = '░'.repeat(10 - bar.length);
          process.stdout.write(
            `\r       [SIM ENCODER] ${s.distanceCovered.toFixed(1)}m / ${s.totalDistance.toFixed(1)}m  [${bar}${empty}]`
          );
        }
      }
    );
    console.log(); // newline after progress bar

    // ── 3. PACKAGE DETECTED ───────────────────────────────────────────────────
    this.transition(RobotState.PACKAGE_DETECTED);
    const rfidResult = this.rfid.forceDetect(SIMULATOR_CONFIG.rfidUidForT001);

    if (!rfidResult.detected) {
      this.transition(RobotState.FAILED, 'RFID not detected at source');
      this.step(`FAILED — RFID tag not detected at ${task.source}`);
      throw new Error(
        `[NR-001] RFID detection failed at ${task.source}. ` +
          `Package ${task.packageId} could not be confirmed.`
      );
    }

    this.ctx.rfidUid = rfidResult.uid;
    this.step(`PACKAGE DETECTED — RFID UID: ${rfidResult.uid} [SIMULATED RC522]`);

    // ── 4. MOVING TO DESTINATION ──────────────────────────────────────────────
    this.transition(RobotState.MOVING_TO_DESTINATION);
    this.step(`MOVING TO DESTINATION — Navigating to ${task.destination}`);

    await simulateMovement(
      task.destination,
      routeDist / 2,
      SIMULATOR_CONFIG.movementStepSize,
      SIMULATOR_CONFIG.movementIntervalMs,
      (s) => {
        const totalSoFar = routeDist / 2 + s.distanceCovered;
        this.ctx.distanceCovered = parseFloat(totalSoFar.toFixed(2));
        this.encoder.setDistance(this.ctx.distanceCovered);
        if (SIMULATOR_CONFIG.logMovementSteps) {
          const frac = this.ctx.distanceCovered / routeDist;
          const bar = '█'.repeat(Math.floor(frac * 10));
          const empty = '░'.repeat(10 - bar.length);
          process.stdout.write(
            `\r       [SIM ENCODER] ${this.ctx.distanceCovered.toFixed(1)}m / ${routeDist.toFixed(1)}m  [${bar}${empty}]`
          );
        }
      }
    );
    console.log();

    // ── 5. DESTINATION REACHED ────────────────────────────────────────────────
    this.transition(RobotState.DESTINATION_REACHED);
    this.ctx.distanceCovered = routeDist;
    this.encoder.setDistance(routeDist);
    this.step(`DESTINATION REACHED — Arrived at ${task.destination}`);
    console.log(`       [SIM ENCODER] Total distance: ${this.encoder.getDistance().toFixed(2)}m`);

    // ── 6. PROOF GENERATED ────────────────────────────────────────────────────
    this.transition(RobotState.PROOF_GENERATED);
    this.step(`GENERATING PROOF — Assembling sensor evidence`);

    const gpsReading = this.gps.getReadingOrUndefined();
    const bundle = this.proofGen.generate({
      taskId: task.taskId,
      robotId: this.ctx.robotId,
      packageId: task.packageId,
      source: task.source,
      destination: task.destination,
      rfidUid: rfidResult.uid ?? undefined,
      distanceMetres: this.encoder.getDistance(),
      gps: gpsReading,
    });

    console.log(`       Evidence:`);
    console.log(`         - taskId:    ${bundle.evidence.taskId}`);
    console.log(`         - robotId:   ${bundle.evidence.robotId}`);
    console.log(`         - packageId: ${bundle.evidence.packageId}`);
    console.log(`         - source:    ${bundle.evidence.source}`);
    console.log(`         - dest:      ${bundle.evidence.destination}`);
    console.log(`         - timestamp: ${bundle.evidence.timestamp}`);
    console.log(`         - rfidUid:   ${bundle.evidence.rfidUid ?? 'N/A'} [SIMULATED]`);
    console.log(`         - distance:  ${bundle.evidence.distance?.toFixed(2) ?? 'N/A'}m [SIMULATED]`);
    if (bundle.evidence.gps) {
      console.log(`         - gps:       ${bundle.evidence.gps.latitude}, ${bundle.evidence.gps.longitude} [SIMULATED]`);
    }

    // ── 7. SUBMIT PROOF TO BACKEND ────────────────────────────────────────────
    this.step(`SUBMITTING PROOF — POST /api/tasks/${task.taskId}/proof`);

    let proofResult: { proofHash: string; canonicalData: string };
    try {
      proofResult = await this.backend.submitProof(task.taskId, bundle.evidence);
    } catch (err) {
      this.transition(RobotState.FAILED, 'Proof submission failed');
      this.step(`FAILED — Proof submission error: ${String(err)}`);
      throw err;
    }

    const finalBundle = this.proofGen.attachHash(
      bundle,
      proofResult.proofHash,
      proofResult.canonicalData
    );
    this.lastProof = finalBundle;

    // ── 8. COMPLETED ──────────────────────────────────────────────────────────
    this.transition(RobotState.COMPLETED);
    this.step(`PROOF SUBMITTED — Proof hash received from backend`);

    printSummary(task.taskId, proofResult.proofHash);

    return finalBundle;
  }

  /** Resets the simulator back to IDLE for re-use */
  reset(): void {
    this.ctx = createInitialContext(SIMULATOR_CONFIG.robotId);
    this.encoder.reset();
    this.lastProof = null;
    this.stepCounter = 0;
  }
}

// ─── Log Helpers ──────────────────────────────────────────────────────────────

function printBanner(robotId: string, taskId: string, packageId: string): void {
  console.log('\n========================================');
  console.log('     PROOF-TO-PAY ROBOT SIMULATOR      ');
  console.log('========================================');
  console.log(`Robot:   ${robotId}`);
  console.log(`Mode:    SIMULATION (no physical hardware)`);
  console.log(`Task:    ${taskId}`);
  console.log(`Package: ${packageId}`);
  console.log('----------------------------------------');
}

function printSummary(taskId: string, proofHash: string): void {
  console.log('----------------------------------------');
  console.log(`STATUS:  COMPLETED`);
  console.log(`Task:    ${taskId}`);
  console.log(`\nProof Hash:`);
  console.log(`${proofHash}`);
  console.log('\n⚠️  NOTE: Sensor values above are SIMULATED.');
  console.log('   No real physical movement occurred.');
  console.log('   Real NEURICK integration: future phase.');
  console.log('========================================\n');
}
