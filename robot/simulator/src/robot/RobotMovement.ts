/**
 * RobotMovement — simulates physical robot locomotion.
 *
 * NOTE: This is a software simulation. No real motor control, encoder hardware,
 * or physical movement occurs. All values are deterministic and clearly labelled
 * as SIMULATED.
 */

import { SIMULATOR_CONFIG } from '../config';

export interface MovementStep {
  /** SIMULATED distance covered so far (metres) */
  distanceCovered: number;
  /** SIMULATED total route distance (metres) */
  totalDistance: number;
  stepNumber: number;
  complete: boolean;
  /** Reminder that this is simulation data */
  simulation: true;
}

/** Pauses execution for the given number of milliseconds */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates the robot moving from its current position to a target location.
 *
 * Movement is broken into incremental steps, each separated by a configurable
 * interval. This produces realistic-looking progress logs without real hardware.
 *
 * @param targetLabel   Human-readable destination label (e.g. "Zone A")
 * @param totalDistance Total simulated route distance in metres
 * @param stepSize      How far the robot moves per tick (metres)
 * @param intervalMs    Delay between ticks (milliseconds)
 * @param onStep        Callback invoked after every tick
 */
export async function simulateMovement(
  targetLabel: string,
  totalDistance: number = SIMULATOR_CONFIG.simulatedDistance,
  stepSize: number = SIMULATOR_CONFIG.movementStepSize,
  intervalMs: number = SIMULATOR_CONFIG.movementIntervalMs,
  onStep?: (step: MovementStep) => void
): Promise<MovementStep[]> {
  const steps: MovementStep[] = [];
  let covered = 0;
  let stepNumber = 0;

  while (covered < totalDistance) {
    await delay(intervalMs);
    covered = Math.min(covered + stepSize, totalDistance);
    stepNumber++;

    const complete = covered >= totalDistance;
    const step: MovementStep = {
      distanceCovered: parseFloat(covered.toFixed(2)),
      totalDistance,
      stepNumber,
      complete,
      simulation: true,
    };

    steps.push(step);
    if (onStep) onStep(step);
  }

  return steps;
}

/**
 * Returns the simulated route distance between two zones.
 * For the simulator, this is a fixed constant regardless of zone names.
 * Real physical distance will be measured by the NEURICK encoder hardware.
 */
export function getSimulatedRouteDistance(
  _source: string,
  _destination: string
): number {
  return SIMULATOR_CONFIG.simulatedDistance;
}
