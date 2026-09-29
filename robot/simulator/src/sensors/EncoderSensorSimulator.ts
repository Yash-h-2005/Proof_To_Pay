/**
 * EncoderSensorSimulator — simulates wheel encoder distance measurement.
 *
 * NOTE: SIMULATED ENCODER — no real hardware communication occurs.
 * Real NEURICK encoder values will replace this in a future phase when the
 * wheels are available for physical movement testing.
 *
 * A physical encoder counts wheel rotations and converts them to distance
 * using the wheel circumference. This simulator maintains a running total
 * that increments as simulated movement steps are reported.
 *
 * All output from this module is labelled: SIMULATED ENCODER
 */

export interface EncoderReading {
  /** SIMULATED total distance in metres */
  distanceMetres: number;
  /** Simulated pulse count (1000 pulses/metre as placeholder) */
  pulseCount: number;
  /** Always true — reminds consumers this is simulation data */
  simulation: true;
  source: 'SIMULATED_ENCODER';
}

export class EncoderSensorSimulator {
  private distanceMetres: number = 0;
  /** Simulated pulses per metre (placeholder constant, not from real calibration) */
  private readonly pulsesPerMetre = 1000;

  /** Sets the current simulated distance (called by the movement simulation) */
  setDistance(metres: number): void {
    this.distanceMetres = parseFloat(metres.toFixed(3));
  }

  /** Increments the distance by a step (called per movement tick) */
  addStep(stepMetres: number): void {
    this.distanceMetres = parseFloat((this.distanceMetres + stepMetres).toFixed(3));
  }

  /** Returns the current simulated encoder reading */
  getReading(): EncoderReading {
    return {
      distanceMetres: this.distanceMetres,
      pulseCount: Math.round(this.distanceMetres * this.pulsesPerMetre),
      simulation: true,
      source: 'SIMULATED_ENCODER',
    };
  }

  /** Alias for getReading().distanceMetres — convenience getter */
  getDistance(): number {
    return this.distanceMetres;
  }

  /** Resets encoder to zero (called at start of each task) */
  reset(): void {
    this.distanceMetres = 0;
  }
}
