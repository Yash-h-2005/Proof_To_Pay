/**
 * TaskDetailsT006Proof.test.tsx
 *
 * Tests specifically verifying clean T006 proof handling:
 * 1. Obtains the current proof hash from backend evidence API for T006 (0xf3e90ab9...)
 * 2. Displays 0xf3e90ab9... in the UI BEFORE submission
 * 3. Displays Hardware Evidence with Movement: SIMULATED and simulation: true
 * 4. Fallback fixture provides 0xf3e90ab9... when backend evidence is null
 * 5. Refreshes evidence upon clicking the Refresh Evidence button
 * 6. Submits submitProof('T006', '0xf3e90ab9...') on-chain
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetails from '../pages/TaskDetails';
import { TaskState } from '../types/task';
import type { ApiTask } from '../types/task';
import * as api from '../services/api';
import * as contract from '../blockchain/contract';

// Mock react-router-dom useParams to return T006
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ taskId: 'T006' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock API service
vi.mock('../services/api', () => ({
  getTask: vi.fn(),
  getTaskEvidence: vi.fn(),
  computeProofHash: vi.fn(),
  submitProofEvidence: vi.fn(),
}));

// Mock blockchain contract module
vi.mock('../blockchain/contract', () => ({
  fundTask: vi.fn(),
  assignRobot: vi.fn(),
  startTask: vi.fn(),
  createTask: vi.fn(),
  fetchTask: vi.fn(),
  fetchAllTaskIds: vi.fn(),
  fetchAllTasks: vi.fn(),
  submitProof: vi.fn(),
  verifyTask: vi.fn(),
  releasePayment: vi.fn(),
  refundTask: vi.fn(),
}));

const CREATOR_ADDRESS = '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302';
const ROBOT_ADDRESS   = '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302';

const T006_WORKING: ApiTask = {
  taskId: 'T006',
  creator: CREATOR_ADDRESS,
  robot: ROBOT_ADDRESS,
  rewardWei: '500000000000000000',
  rewardMSTC: '0.5',
  packageId: 'P06',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: TaskState.WORKING,
  stateLabel: 'WORKING',
  createdAt: 1790659219,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

const T006_EVIDENCE: api.TaskEvidence = {
  taskId: 'T006',
  robotId: 'NR-001',
  packageId: 'P06',
  source: 'Zone A',
  destination: 'Zone B',
  timestamp: 45137,
  rfidUid: 'D9:33:6A:F8',
  distance: 12.4,
  gps: null,
  simulation: true,
};

const T006_VERIFIED_HASH = '0xf3e90ab9b28af19f6d54c08bae947f1d65dbd19bc48a09307bc8484521d04e05';
const T004_STALE_HASH    = '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648';

const CONNECTED_WALLET = {
  isConnected: true,
  isCorrectNetwork: true,
  address: CREATOR_ADDRESS,
  chainId: 91562037,
  balanceMSTC: '10.0',
};

function mockTx(hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef') {
  return {
    hash,
    wait: vi.fn().mockResolvedValue({ status: 1 }),
  } as unknown as import('ethers').TransactionResponse;
}

describe('TaskDetails — T006 Proof Verification & Hardware Evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Obtains the T006 proof hash from backend evidence and displays 0xf3e90ab9... BEFORE submission', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T006_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T006_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T006_VERIFIED_HASH,
      canonicalData: '{}',
    });

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    const proofHashDisplay = screen.getByTestId('proof-hash-display');
    expect(proofHashDisplay).toHaveTextContent(T006_VERIFIED_HASH);
    expect(proofHashDisplay).not.toHaveTextContent(T004_STALE_HASH);
  });

  it('2. Displays Hardware Evidence with Movement: SIMULATED and simulation: true', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T006_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T006_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T006_VERIFIED_HASH,
      canonicalData: '{}',
    });

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    expect(screen.getByText('Movement:')).toBeInTheDocument();
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.queryByText('PHYSICAL')).not.toBeInTheDocument();
  });

  it('3. Uses T006 fallback fixture with 0xf3e90ab9... when backend evidence returns null', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T006_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(null);

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    const proofHashDisplay = screen.getByTestId('proof-hash-display');
    expect(proofHashDisplay).toHaveTextContent(T006_VERIFIED_HASH);
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
  });

  it('4. Refreshes evidence when clicking the Refresh Evidence button', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T006_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(null);

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refresh-evidence-btn')).toBeInTheDocument());

    vi.mocked(api.getTaskEvidence).mockResolvedValue(T006_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T006_VERIFIED_HASH,
      canonicalData: '{}',
    });

    fireEvent.click(screen.getByTestId('refresh-evidence-btn'));

    await waitFor(() => {
      expect(api.getTaskEvidence).toHaveBeenCalledWith('T006');
    });
  });

  it('5. Submits submitProof(T006, 0xf3e90ab9...) with the exact T006 proof hash', async () => {
    const TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    vi.mocked(api.getTask).mockResolvedValue(T006_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T006_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T006_VERIFIED_HASH,
      canonicalData: '{}',
    });
    vi.mocked(contract.submitProof).mockResolvedValue(mockTx(TX_HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() =>
      expect(contract.submitProof).toHaveBeenCalledWith('T006', T006_VERIFIED_HASH)
    );
  });
});
