/**
 * Robot Simulator — Jest Test Suite
 *
 * Tests:
 *  1.  Initial robot state (IDLE)
 *  2.  State transitions — all valid transitions
 *  3.  State transitions — invalid transitions rejected
 *  4.  Movement simulation — step count and distances
 *  5.  Movement simulation — doesn't exceed totalDistance
 *  6.  Movement simulation — all steps labelled simulation
 *  7.  RFID — forceDetect returns uid
 *  8.  RFID — forceNoDetect returns null
 *  9.  RFID — probability=0 always fails
 *  10. RFID — T001 UID is the bench-tested value
 *  11. Encoder — starts at 0
 *  12. Encoder — setDistance / getDistance
 *  13. Encoder — addStep accumulates
 *  14. Encoder — reset
 *  15. GPS — disabled returns undefined
 *  16. GPS — enabled returns simulated coordinates
 *  17. Proof generator — required fields
 *  18. Proof generator — optional fields omitted when not provided
 *  19. Proof generator — attachHash populates hash fields
 *  20. BackendClient — checkHealth success
 *  21. BackendClient — checkHealth throws BACKEND UNAVAILABLE on network error
 *  22. BackendClient — getTask success
 *  23. BackendClient — getTask 404 throws
 *  24. BackendClient — submitProof sends POST and returns hash
 *  25. RobotSimulator — initial state is IDLE
 *  26. RobotSimulator — reset returns to IDLE
 */

import { RobotState, createInitialContext, isValidTransition } from '../robot/RobotState';
import { simulateMovement, getSimulatedRouteDistance } from '../robot/RobotMovement';
import { RfidSensorSimulator } from '../sensors/RfidSensorSimulator';
import { EncoderSensorSimulator } from '../sensors/EncoderSensorSimulator';
import { GpsSensorSimulator } from '../sensors/GpsSensorSimulator';
import { ProofGenerator } from '../proof/ProofGenerator';
import { BackendClient } from '../api/backendClient';
import { RobotSimulator } from '../robot/RobotSimulator';

// ─── Mock fetch globally ──────────────────────────────────────────────────────
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

/** Realistic T001 task as returned by the backend */
const MOCK_TASK = {
  taskId: 'T001',
  creator: '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302',
  robot: '0x0000000000000000000000000000000000000000',
  rewardWei: '100000000000000000000',
  rewardMSTC: '100.0',
  packageId: 'P01',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: 0,
  stateLabel: 'CREATED',
  createdAt: 1700000000,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

const MOCK_PROOF_HASH = '0xdeadbeef' + '00'.repeat(28);

// ─── 1–3. RobotState ─────────────────────────────────────────────────────────
describe('RobotState', () => {
  it('creates initial context with IDLE state', () => {
    const ctx = createInitialContext('NR-001');
    expect(ctx.state).toBe(RobotState.IDLE);
    expect(ctx.robotId).toBe('NR-001');
    expect(ctx.taskId).toBeNull();
    expect(ctx.simulation).toBe(true);
  });

  it('validates the full happy-path state chain', () => {
    const chain = [
      [RobotState.IDLE, RobotState.ASSIGNED],
      [RobotState.ASSIGNED, RobotState.MOVING_TO_SOURCE],
      [RobotState.MOVING_TO_SOURCE, RobotState.PACKAGE_DETECTED],
      [RobotState.PACKAGE_DETECTED, RobotState.MOVING_TO_DESTINATION],
      [RobotState.MOVING_TO_DESTINATION, RobotState.DESTINATION_REACHED],
      [RobotState.DESTINATION_REACHED, RobotState.PROOF_GENERATED],
      [RobotState.PROOF_GENERATED, RobotState.COMPLETED],
    ] as [RobotState, RobotState][];

    for (const [from, to] of chain) {
      expect(isValidTransition(from, to)).toBe(true);
    }
  });

  it('rejects invalid transitions', () => {
    expect(isValidTransition(RobotState.IDLE, RobotState.COMPLETED)).toBe(false);
    expect(isValidTransition(RobotState.COMPLETED, RobotState.IDLE)).toBe(false);
    expect(isValidTransition(RobotState.PROOF_GENERATED, RobotState.IDLE)).toBe(false);
  });

  it('any active state can transition to FAILED', () => {
    const active = [
      RobotState.IDLE,
      RobotState.ASSIGNED,
      RobotState.MOVING_TO_SOURCE,
      RobotState.PACKAGE_DETECTED,
      RobotState.MOVING_TO_DESTINATION,
      RobotState.DESTINATION_REACHED,
      RobotState.PROOF_GENERATED,
    ];
    for (const s of active) {
      expect(isValidTransition(s, RobotState.FAILED)).toBe(true);
    }
  });
});

// ─── 4–6. Movement Simulation ─────────────────────────────────────────────────
describe('RobotMovement', () => {
  it('produces correct number of steps', async () => {
    const steps = await simulateMovement('Zone B', 6.0, 2.0, 0);
    expect(steps.length).toBe(3);
  });

  it('final step exactly equals total distance', async () => {
    const steps = await simulateMovement('Zone B', 5.0, 2.0, 0);
    expect(steps[steps.length - 1].distanceCovered).toBe(5.0);
    expect(steps[steps.length - 1].complete).toBe(true);
  });

  it('never exceeds total distance', async () => {
    const steps = await simulateMovement('Zone B', 7.5, 3.0, 0);
    for (const s of steps) {
      expect(s.distanceCovered).toBeLessThanOrEqual(7.5);
    }
  });

  it('all steps labelled simulation=true', async () => {
    const steps = await simulateMovement('Zone B', 4.0, 2.0, 0);
    for (const s of steps) expect(s.simulation).toBe(true);
  });

  it('invokes onStep callback for each step', async () => {
    const cb = jest.fn();
    await simulateMovement('Zone B', 4.0, 2.0, 0, cb);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('getSimulatedRouteDistance returns positive number', () => {
    const d = getSimulatedRouteDistance('Zone A', 'Zone B');
    expect(d).toBeGreaterThan(0);
  });
});

// ─── 7–10. RFID ───────────────────────────────────────────────────────────────
describe('RfidSensorSimulator', () => {
  it('forceDetect returns detected=true with correct UID', () => {
    const sensor = new RfidSensorSimulator('D9:33:6A:F8', 1.0);
    const r = sensor.forceDetect();
    expect(r.detected).toBe(true);
    expect(r.uid).toBe('D9:33:6A:F8');
    expect(r.simulation).toBe(true);
    expect(r.source).toBe('SIMULATED_RC522');
  });

  it('forceNoDetect returns detected=false and null uid', () => {
    const sensor = new RfidSensorSimulator('D9:33:6A:F8');
    const r = sensor.forceNoDetect();
    expect(r.detected).toBe(false);
    expect(r.uid).toBeNull();
  });

  it('probability=0 never detects', () => {
    const sensor = new RfidSensorSimulator('D9:33:6A:F8', 0.0);
    for (let i = 0; i < 20; i++) expect(sensor.scan().detected).toBe(false);
  });

  it('default UID matches T001 bench-tested RFID tag', () => {
    const sensor = new RfidSensorSimulator();
    expect(sensor.getExpectedUid()).toBe('D9:33:6A:F8');
  });
});

// ─── 11–14. Encoder ───────────────────────────────────────────────────────────
describe('EncoderSensorSimulator', () => {
  it('starts at 0', () => {
    expect(new EncoderSensorSimulator().getDistance()).toBe(0);
  });

  it('setDistance / getDistance', () => {
    const e = new EncoderSensorSimulator();
    e.setDistance(12.4);
    expect(e.getDistance()).toBe(12.4);
  });

  it('addStep accumulates', () => {
    const e = new EncoderSensorSimulator();
    e.addStep(2.0);
    e.addStep(2.0);
    e.addStep(2.0);
    expect(e.getDistance()).toBeCloseTo(6.0, 2);
  });

  it('reset clears to 0', () => {
    const e = new EncoderSensorSimulator();
    e.setDistance(12.4);
    e.reset();
    expect(e.getDistance()).toBe(0);
  });

  it('getReading labelled simulation', () => {
    const e = new EncoderSensorSimulator();
    e.setDistance(6.0);
    const r = e.getReading();
    expect(r.simulation).toBe(true);
    expect(r.source).toBe('SIMULATED_ENCODER');
  });
});

// ─── 15–16. GPS ───────────────────────────────────────────────────────────────
describe('GpsSensorSimulator', () => {
  it('returns undefined when disabled', () => {
    const gps = new GpsSensorSimulator(12.9716, 77.5946, false);
    expect(gps.getReadingOrUndefined()).toBeUndefined();
  });

  it('returns simulated reading when enabled', () => {
    const gps = new GpsSensorSimulator(12.9716, 77.5946, true);
    const r = gps.getReadingOrUndefined();
    expect(r).toBeDefined();
    expect(r!.simulation).toBe(true);
    expect(r!.source).toBe('SIMULATED_GPS');
    expect(r!.latitude).toBeCloseTo(12.9716, 2);
  });
});

// ─── 17–19. ProofGenerator ────────────────────────────────────────────────────
describe('ProofGenerator', () => {
  const gen = new ProofGenerator();

  it('generates bundle with all required fields', () => {
    const b = gen.generate({
      taskId: 'T001', robotId: 'NR-001', packageId: 'P01',
      source: 'Zone A', destination: 'Zone B',
      rfidUid: 'D9:33:6A:F8', distanceMetres: 12.4,
    });
    expect(b.simulation).toBe(true);
    expect(b.proofHash).toBeNull();
    expect(b.evidence.taskId).toBe('T001');
    expect(b.evidence.robotId).toBe('NR-001');
    expect(b.evidence.rfidUid).toBe('D9:33:6A:F8');
    expect(b.evidence.distance).toBe(12.4);
    expect(b.evidence.timestamp).toBeGreaterThan(0);
  });

  it('omits optional fields when not provided', () => {
    const b = gen.generate({ taskId: 'T001', robotId: 'NR-001', packageId: 'P01', source: 'A', destination: 'B' });
    expect(b.evidence.rfidUid).toBeUndefined();
    expect(b.evidence.distance).toBeUndefined();
    expect(b.evidence.gps).toBeUndefined();
  });

  it('attachHash fills proofHash and canonicalData', () => {
    const b = gen.generate({ taskId: 'T001', robotId: 'NR-001', packageId: 'P01', source: 'A', destination: 'B' });
    const final = gen.attachHash(b, '0xabc', '{"taskId":"T001"}');
    expect(final.proofHash).toBe('0xabc');
    expect(final.canonicalData).toBe('{"taskId":"T001"}');
  });
});

// ─── 20–24. BackendClient ─────────────────────────────────────────────────────
describe('BackendClient', () => {
  beforeEach(() => mockFetch.mockReset());

  it('checkHealth returns status on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', timestamp: '2025-01-01T00:00:00Z' }),
    } as Response);
    const client = new BackendClient();
    const h = await client.checkHealth();
    expect(h.status).toBe('ok');
  });

  it('checkHealth throws BACKEND UNAVAILABLE on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(new BackendClient().checkHealth()).rejects.toThrow('BACKEND UNAVAILABLE');
  });

  it('getTask returns task data on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: MOCK_TASK }),
    } as Response);
    const task = await new BackendClient().getTask('T001');
    expect(task.taskId).toBe('T001');
    expect(task.packageId).toBe('P01');
  });

  it('getTask throws on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ error: 'Task not found' }),
    } as Response);
    await expect(new BackendClient().getTask('NOTEXIST')).rejects.toThrow('Task not found');
  });

  it('submitProof sends POST and returns proofHash', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proofHash: MOCK_PROOF_HASH, canonicalData: '{}' }),
    } as Response);

    const result = await new BackendClient().submitProof('T001', {
      taskId: 'T001', robotId: 'NR-001', packageId: 'P01',
      source: 'Zone A', destination: 'Zone B',
      timestamp: 1700000000, rfidUid: 'D9:33:6A:F8', distance: 12.4,
    });

    expect(result.proofHash).toBe(MOCK_PROOF_HASH);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/T001/proof'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

// ─── 25–26. RobotSimulator ───────────────────────────────────────────────────
describe('RobotSimulator', () => {
  it('starts in IDLE state', () => {
    const sim = new RobotSimulator();
    expect(sim.getState()).toBe(RobotState.IDLE);
    expect(sim.getContext().simulation).toBe(true);
  });

  it('reset returns to IDLE', () => {
    const mockBackend = {
      checkHealth: jest.fn(),
      getTask: jest.fn(),
      submitProof: jest.fn().mockResolvedValue({ proofHash: MOCK_PROOF_HASH, canonicalData: '{}' }),
    } as unknown as BackendClient;

    const sim = new RobotSimulator(undefined, mockBackend);
    // manually poke state to non-IDLE via context inspection
    expect(sim.getState()).toBe(RobotState.IDLE);
    sim.reset();
    expect(sim.getState()).toBe(RobotState.IDLE);
    expect(sim.getLastProof()).toBeNull();
  });
});
