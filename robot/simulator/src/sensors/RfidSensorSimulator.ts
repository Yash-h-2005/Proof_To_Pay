/**
 * RfidSensorSimulator — simulates the RC522 RFID reader module.
 *
 * NOTE: This is a SOFTWARE SIMULATION.
 * No real RC522 hardware communication occurs.
 * The RFID UID is injected programmatically, not read from a physical reader.
 *
 * The UID "D9:33:6A:F8" corresponds to the physical RFID tag used in bench
 * testing for T001. In a real deployment, this would be read over SPI from
 * the RC522 connected to the ESP32-S3.
 *
 * All output from this module is labelled: SIMULATED RFID
 */

import { SIMULATOR_CONFIG } from '../config';

export interface RfidReadResult {
  /** Whether a tag was detected */
  detected: boolean;
  /** UID in colon-separated hex format (e.g. "D9:33:6A:F8") */
  uid: string | null;
  /** Always true — reminds consumers this is simulation data */
  simulation: true;
  /** Human-readable label */
  source: 'SIMULATED_RC522';
  /** ISO timestamp of the simulated read */
  readAt: string;
}

export class RfidSensorSimulator {
  private readonly expectedUid: string;
  private readonly detectionProbability: number;
  private lastResult: RfidReadResult | null = null;

  constructor(
    expectedUid: string = SIMULATOR_CONFIG.rfidUidForT001,
    detectionProbability: number = SIMULATOR_CONFIG.rfidDetectionProbability
  ) {
    this.expectedUid = expectedUid;
    this.detectionProbability = detectionProbability;
  }

  /**
   * Simulates scanning for an RFID tag.
   *
   * Uses detectionProbability to allow simulating failed reads
   * (e.g. 0.0 = always fail, 1.0 = always succeed).
   */
  scan(): RfidReadResult {
    const detected = Math.random() < this.detectionProbability;

    this.lastResult = {
      detected,
      uid: detected ? this.expectedUid : null,
      simulation: true,
      source: 'SIMULATED_RC522',
      readAt: new Date().toISOString(),
    };

    return this.lastResult;
  }

  /** Forces a successful detection of the given UID (for deterministic testing) */
  forceDetect(uid: string = this.expectedUid): RfidReadResult {
    this.lastResult = {
      detected: true,
      uid,
      simulation: true,
      source: 'SIMULATED_RC522',
      readAt: new Date().toISOString(),
    };
    return this.lastResult;
  }

  /** Forces a failed detection (tag not present or read error) */
  forceNoDetect(): RfidReadResult {
    this.lastResult = {
      detected: false,
      uid: null,
      simulation: true,
      source: 'SIMULATED_RC522',
      readAt: new Date().toISOString(),
    };
    return this.lastResult;
  }

  getLastResult(): RfidReadResult | null {
    return this.lastResult;
  }

  getExpectedUid(): string {
    return this.expectedUid;
  }
}
