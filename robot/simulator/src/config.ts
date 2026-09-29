/**
 * Robot Simulator Configuration
 *
 * All simulation parameters are defined here.
 * No private keys, wallet seeds, or blockchain signing credentials here.
 * The simulator communicates with the backend only — not directly with the blockchain.
 */

export const SIMULATOR_CONFIG = {
  // ─── Robot Identity ─────────────────────────────────────────────────────────
  robotId: 'NR-001',
  robotName: 'NEURICK Robot 001',

  // ─── Backend API ─────────────────────────────────────────────────────────────
  /** Backend URL — simulator talks to the Phase 4 backend, not the blockchain directly */
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:3001',

  // ─── Movement Simulation ─────────────────────────────────────────────────────
  /**
   * Simulated distance between source and destination (metres).
   * This is a fixed simulation value — not a real physical measurement.
   */
  simulatedDistance: 12.4,

  /** Step size per movement tick (metres) */
  movementStepSize: 2.0,

  /** Time between each movement tick (milliseconds) */
  movementIntervalMs: 500,

  // ─── RFID Sensor Simulation ───────────────────────────────────────────────────
  /**
   * RFID UID for T001 package.
   * This UID (D9:33:6A:F8) matches the hardware RFID tag used in bench testing.
   * In simulation mode this is injected programmatically — not read from the RC522.
   */
  rfidUidForT001: 'D9:33:6A:F8',

  /**
   * Simulated probability of RFID detection success (0.0 – 1.0).
   * 1.0 = always detected (default for deterministic tests).
   */
  rfidDetectionProbability: 1.0,

  // ─── GPS Simulation ──────────────────────────────────────────────────────────
  /**
   * GPS was not available during hardware testing (no valid NMEA data received).
   * These coordinates are placeholder simulation values only.
   * Do NOT present these as real GPS positions.
   */
  simulatedGps: {
    latitude: 12.9716,
    longitude: 77.5946,
  },

  /** Whether to include GPS in proof evidence */
  includeGps: false,

  // ─── Logging ─────────────────────────────────────────────────────────────────
  /** Log each movement step */
  logMovementSteps: true,
} as const;
