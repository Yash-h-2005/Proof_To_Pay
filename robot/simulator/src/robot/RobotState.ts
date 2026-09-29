/**
 * RobotState — state machine for the NEURICK robot simulator.
 *
 * These states mirror the physical task execution lifecycle:
 *   IDLE → ASSIGNED → MOVING_TO_SOURCE → PACKAGE_DETECTED →
 *   MOVING_TO_DESTINATION → DESTINATION_REACHED → PROOF_GENERATED → COMPLETED
 *
 * FAILED can be reached from any state on an unrecoverable error.
 */

export enum RobotState {
  IDLE = 'IDLE',
  ASSIGNED = 'ASSIGNED',
  MOVING_TO_SOURCE = 'MOVING_TO_SOURCE',
  PACKAGE_DETECTED = 'PACKAGE_DETECTED',
  MOVING_TO_DESTINATION = 'MOVING_TO_DESTINATION',
  DESTINATION_REACHED = 'DESTINATION_REACHED',
  PROOF_GENERATED = 'PROOF_GENERATED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Current snapshot of the robot's runtime context */
export interface RobotContext {
  state: RobotState;
  robotId: string;
  /** Task currently assigned (null if IDLE) */
  taskId: string | null;
  packageId: string | null;
  source: string | null;
  destination: string | null;
  /** Simulated distance covered in metres */
  distanceCovered: number;
  /** Total simulated route distance in metres */
  totalDistance: number;
  /** RFID UID detected at source (null if not yet detected) */
  rfidUid: string | null;
  /** Whether sensor values are simulated (always true for the simulator) */
  simulation: true;
  /** Unix timestamp (seconds) of the most recent state change */
  lastUpdatedAt: number;
}

export function createInitialContext(robotId: string): RobotContext {
  return {
    state: RobotState.IDLE,
    robotId,
    taskId: null,
    packageId: null,
    source: null,
    destination: null,
    distanceCovered: 0,
    totalDistance: 0,
    rfidUid: null,
    simulation: true,
    lastUpdatedAt: Math.floor(Date.now() / 1000),
  };
}

/** Legal state transitions for the robot state machine */
export const VALID_TRANSITIONS: Record<RobotState, RobotState[]> = {
  [RobotState.IDLE]: [RobotState.ASSIGNED, RobotState.FAILED],
  [RobotState.ASSIGNED]: [RobotState.MOVING_TO_SOURCE, RobotState.FAILED],
  [RobotState.MOVING_TO_SOURCE]: [RobotState.PACKAGE_DETECTED, RobotState.FAILED],
  [RobotState.PACKAGE_DETECTED]: [RobotState.MOVING_TO_DESTINATION, RobotState.FAILED],
  [RobotState.MOVING_TO_DESTINATION]: [RobotState.DESTINATION_REACHED, RobotState.FAILED],
  [RobotState.DESTINATION_REACHED]: [RobotState.PROOF_GENERATED, RobotState.FAILED],
  [RobotState.PROOF_GENERATED]: [RobotState.COMPLETED, RobotState.FAILED],
  [RobotState.COMPLETED]: [],
  [RobotState.FAILED]: [],
};

/** Returns true if a transition from → to is valid */
export function isValidTransition(from: RobotState, to: RobotState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
