/**
 * TaskDetailsT005Proof.test.tsx
 *
 * Tests specifically verifying clean T005 proof handling:
 * 1. Obtains the current proof hash from backend evidence API for T005 (0x6f0b0d28...)
 * 2. Displays 0x6f0b0d28... in the UI BEFORE submission
 * 3. Submits submitProof('T005', '0x6f0b0d28...') on-chain
 * 4. Critical anti-stale safety guard: Stale T004 proof hash can NEVER be submitted for T005
 * 5. UI clearly distinguishes cryptographic Proof Hash from Proof Transaction Hash
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetails from '../pages/TaskDetails';
import { TaskState } from '../types/task';
import type { ApiTask } from '../types/task';
import * as api from '../services/api';
import * as contract from '../blockchain/contract';

// Mock react-router-dom useParams to return T005
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ taskId: 'T005' }),
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

const CREATOR_ADDRESS = '0xBFe5A4c2a3e4D7Fc9A12B3f6789012345678e302';
const ROBOT_ADDRESS   = '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302';

const T005_WORKING: ApiTask = {
  taskId: 'T005',
  creator: CREATOR_ADDRESS,
  robot: ROBOT_ADDRESS,
  rewardWei: '500000000000000000',
  rewardMSTC: '0.5',
  packageId: 'P05',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: TaskState.WORKING,
  stateLabel: 'WORKING',
  createdAt: 1790655451,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

const T005_EVIDENCE: api.TaskEvidence = {
  taskId: 'T005',
  robotId: 'NR-001',
  packageId: 'P05',
  source: 'Zone A',
  destination: 'Zone B',
  timestamp: 36402,
  rfidUid: 'D9:33:6A:F8',
  distance: 12.4,
  gps: null,
  simulation: true,
};

const T005_VERIFIED_HASH = '0x6f0b0d28d6d10490d2f21ea0030c46bfaf95e528728ab2db8872a62bc761ad32';
const T004_STALE_HASH    = '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648';

const CONNECTED_WALLET = {
  isConnected: true,
  isCorrectNetwork: true,
  address: CREATOR_ADDRESS,
  chainId: 91562037,
  balanceMSTC: '10.0',
};

function mockTx(hash = '0x393ea77a9123456789abcdef0123456789abcdef0123456789abcdef01234567') {
  return {
    hash,
    wait: vi.fn().mockResolvedValue({ status: 1 }),
  } as unknown as import('ethers').TransactionResponse;
}

describe('TaskDetails — T005 Proof Verification & Anti-Stale Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Obtains the T005 proof hash from backend evidence and displays 0x6f0b0d28... BEFORE submission', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T005_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T005_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T005_VERIFIED_HASH,
      canonicalData: '{}',
    });

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    const proofHashDisplay = screen.getByTestId('proof-hash-display');
    expect(proofHashDisplay).toHaveTextContent(T005_VERIFIED_HASH);
    expect(proofHashDisplay).not.toHaveTextContent(T004_STALE_HASH);

    // Verify ready info banner also references T005 hash prefix
    expect(screen.getByTestId('proof-ready-info')).toHaveTextContent(T005_VERIFIED_HASH.slice(0, 18));
  });

  it('2. Submits submitProof(T005, 0x6f0b0d28...) with the exact T005 proof hash', async () => {
    const TX_HASH = '0x393ea77a9123456789abcdef0123456789abcdef0123456789abcdef01234567';
    vi.mocked(api.getTask).mockResolvedValue(T005_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T005_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T005_VERIFIED_HASH,
      canonicalData: '{}',
    });
    vi.mocked(contract.submitProof).mockResolvedValue(mockTx(TX_HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() =>
      expect(contract.submitProof).toHaveBeenCalledWith('T005', T005_VERIFIED_HASH)
    );

    // Ensure it NEVER called with stale T004 hash
    expect(contract.submitProof).not.toHaveBeenCalledWith('T005', T004_STALE_HASH);
  });

  it('3. Anti-stale safety guard: Stale T004 proof hash cannot be submitted for T005', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T005_WORKING);
    // Simulate an errant evidence or mock returning stale T004 hash
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T005_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T004_STALE_HASH,
      canonicalData: '{}',
    });

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() => expect(screen.getByTestId('proof-tx-error')).toBeInTheDocument());
    expect(screen.getByTestId('proof-tx-error')).toHaveTextContent(
      'Safety guard: Stale T004 proof hash cannot be submitted for task T005.'
    );

    // contract.submitProof MUST NOT be called!
    expect(contract.submitProof).not.toHaveBeenCalled();
  });

  it('4. UI clearly distinguishes cryptographic Proof Hash from Proof Transaction Hash', async () => {
    const TX_HASH = '0x393ea77a9123456789abcdef0123456789abcdef0123456789abcdef01234567';
    vi.mocked(api.getTask).mockResolvedValue(T005_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(T005_EVIDENCE);
    vi.mocked(api.computeProofHash).mockReturnValue({
      proofHash: T005_VERIFIED_HASH,
      canonicalData: '{}',
    });
    vi.mocked(contract.submitProof).mockResolvedValue(mockTx(TX_HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() => expect(screen.getByTestId('proof-submitted-card')).toBeInTheDocument());

    // 1) The Proof Hash element contains the cryptographic proof hash
    const proofHashElement = screen.getByTestId('on-chain-proof-hash');
    expect(proofHashElement).toHaveTextContent(T005_VERIFIED_HASH);
    // MUST NOT display the transaction hash as the proof hash!
    expect(proofHashElement).not.toHaveTextContent(TX_HASH);

    // 2) The Proof Transaction Hash element is separate and contains the tx hash
    const txSection = screen.getByTestId('proof-tx-hash-section');
    expect(txSection).toHaveTextContent('Proof Transaction Hash');
    expect(txSection).toHaveTextContent('0x393e');
  });

  it('5. Fallback fixture for T005 generates T005 hash, never T004, if backend evidence is null', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T005_WORKING);
    vi.mocked(api.getTaskEvidence).mockResolvedValue(null); // backend store empty

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    const proofHashDisplay = screen.getByTestId('proof-hash-display');
    expect(proofHashDisplay).toHaveTextContent(T005_VERIFIED_HASH);
    expect(proofHashDisplay).not.toHaveTextContent(T004_STALE_HASH);
  });

  it('6. T005 in PROOF_SUBMITTED state exposes Refund Task action and calls refundTask("T005")', async () => {
    const T005_PROOF_SUBMITTED: ApiTask = {
      ...T005_WORKING,
      state: TaskState.PROOF_SUBMITTED,
      stateLabel: 'PROOF_SUBMITTED',
      proofHash: '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648',
    };
    const T005_REFUNDED: ApiTask = {
      ...T005_PROOF_SUBMITTED,
      state: TaskState.REFUNDED,
      stateLabel: 'REFUNDED',
    };
    const REFUND_TX = '0x8888777766665555444433332222111100009999888877776666555544443333';
    vi.mocked(api.getTask)
      .mockResolvedValueOnce(T005_PROOF_SUBMITTED)
      .mockResolvedValueOnce(T005_REFUNDED);
    vi.mocked(contract.refundTask).mockResolvedValue(mockTx(REFUND_TX));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-card')).toBeInTheDocument());

    const refundBtn = screen.getByTestId('refund-task-btn');
    expect(refundBtn).toHaveTextContent('Refund Task Escrow (0.5 MSTC)');
    expect(refundBtn).not.toBeDisabled();

    fireEvent.click(refundBtn);

    await waitFor(() => expect(contract.refundTask).toHaveBeenCalledWith('T005'));
    await waitFor(() => expect(screen.getByTestId('task-refunded-card')).toBeInTheDocument());
    expect(screen.getByTestId('task-refunded-card')).toHaveTextContent('Task Refunded');
  });
});
