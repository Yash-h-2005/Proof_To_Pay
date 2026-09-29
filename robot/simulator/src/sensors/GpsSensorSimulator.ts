/**
 * GpsSensorSimulator — simulates GPS position data.
 *
 * NOTE: SIMULATED GPS — no real GPS hardware communication occurs.
 * GPS integration was attempted during hardware testing but no valid NMEA
 * sentences were received. This module provides a placeholder interface so
 * real GPS can be substituted in a future phase without API changes.
 *
 * All output from this module is labelled: SIMULATED GPS
 *
 * Coordinates below are placeholder values — NOT real robot positions.
 */

import { SIMULATOR_CONFIG } from '../config';

export interface GpsReading {
  latitude: number;
  longitude: number;
  /** GPS accuracy in metres (simulated placeholder) */
  accuracyMetres: number;
  /** Always true — reminds consumers this is simulation data */
  simulation: true;
  source: 'SIMULATED_GPS';
  /** ISO timestamp of the simulated fix */
  fixAt: string;
}

export class GpsSensorSimulator {
  private readonly baseLatitude: number;
  private readonly baseLongitude: number;
  private enabled: boolean;

  constructor(
    baseLatitude: number = SIMULATOR_CONFIG.simulatedGps.latitude,
    baseLongitude: number = SIMULATOR_CONFIG.simulatedGps.longitude,
    enabled: boolean = SIMULATOR_CONFIG.includeGps
  ) {
    this.baseLatitude = baseLatitude;
    this.baseLongitude = baseLongitude;
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Returns the simulated GPS fix for the current position.
   * Adds a tiny deterministic jitter to the base coordinates to simulate
   * minor GPS drift (±0.0001 degrees ≈ ±11 metres).
   */
  getReading(): GpsReading {
    const jitter = () => (Math.random() - 0.5) * 0.0001;
    return {
      latitude: parseFloat((this.baseLatitude + jitter()).toFixed(6)),
      longitude: parseFloat((this.baseLongitude + jitter()).toFixed(6)),
      accuracyMetres: 5.0,
      simulation: true,
      source: 'SIMULATED_GPS',
      fixAt: new Date().toISOString(),
    };
  }

  /** Returns null-safe GPS reading — returns undefined if GPS is disabled */
  getReadingOrUndefined(): GpsReading | undefined {
    if (!this.enabled) return undefined;
    return this.getReading();
  }
}
