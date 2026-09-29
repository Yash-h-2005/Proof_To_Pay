/**
 * TaskDetailsSettlement.test.tsx
 *
 * Phase C -- On-chain settlement UI tests.
 * Covers:
 *  - submitProof  button: WORKING state
 *  - verifyTask   button: PROOF_SUBMITTED state
 *  - releasePayment button: VERIFIED state
 *  - payment-released card: PAID state
 *  - Transaction hash rendering (only after real TX)
 *  - Wallet-disconnected / wrong-network safety guards
 *  - Error handling (user rejection, contract revert)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetails from '../pages/TaskDetails';
import { TaskState } from '../types/task';
import type { ApiTask } from '../types/task';
import * as api from '../services/api';
import * as contract from '../blockchain/contract';

// -- Router mock ---------------------------------------------------------------
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ taskId: 'T004' }),
    useNavigate: () => vi.fn(),
  };
});

// -- API mock ------------------------------------------------------------------
vi.mock('../services/api', () => ({
  getTask: vi.fn(),
  getTaskEvidence: vi.fn(),
  computeProofHash: vi.fn(),
  submitProofEvidence: vi.fn(),
}));

// -- Contract mock (includes ALL exported helpers) -----------------------------
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

// -- Fixtures ------------------------------------------------------------------
const CREATOR_ADDRESS = '0xBFe5A4c2a3e4D7Fc9A12B3f6789012345678e302';
const ROBOT_ADDRESS   = '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302';
const OTHER_ADDRESS   = '0x1111111111111111111111111111111111111111';

const BASE: ApiTask = {
  taskId: 'T004',
  creator: CREATOR_ADDRESS,
  robot: ROBOT_ADDRESS,
  rewardWei: '500000000000000000',
  rewardMSTC: '0.5',
  packageId: 'P04',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: TaskState.WORKING,
  stateLabel: 'WORKING',
  createdAt: 1700000000,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

const T004_WORKING: ApiTask         = { ...BASE, state: TaskState.WORKING,         stateLabel: 'WORKING' };
const T004_PROOF_SUBMITTED: ApiTask = {
  ...BASE,
  state: TaskState.PROOF_SUBMITTED,
  stateLabel: 'PROOF_SUBMITTED',
  proofHash: '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648',
  proofSubmittedAt: 1700010000,
};
const T004_VERIFIED: ApiTask = {
  ...T004_PROOF_SUBMITTED,
  state: TaskState.VERIFIED,
  stateLabel: 'VERIFIED',
  verifiedAt: 1700020000,
};
const T004_PAID: ApiTask = { ...T004_VERIFIED, state: TaskState.PAID, stateLabel: 'PAID' };

const CONNECTED_WALLET = {
  isConnected: true,
  isCorrectNetwork: true,
  address: CREATOR_ADDRESS,
  chainId: 91562037,
  balanceMSTC: '10.0',
};
const DISCONNECTED_WALLET = {
  isConnected: false,
  isCorrectNetwork: false,
  address: null,
  chainId: null,
  balanceMSTC: null,
};
const WRONG_NETWORK_WALLET = { ...CONNECTED_WALLET, isCorrectNetwork: false, chainId: 1 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockTx(hash: string): any {
  return { hash, wait: vi.fn().mockResolvedValue({ status: 1 }) };
}

// -- submitProof tests ---------------------------------------------------------

describe('TaskDetails Phase C -- submitProof', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Submit Proof card with hash for WORKING task', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    expect(screen.getByTestId('submit-proof-btn')).not.toBeDisabled();
    expect(screen.getByTestId('submit-proof-btn')).toHaveTextContent('Submit Proof to Blockchain');
    expect(screen.getByTestId('proof-hash-display')).toHaveTextContent(
      '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648'
    );
    expect(screen.getByTestId('submit-proof-card')).toHaveTextContent('10 / 10 CHECKS PASSED');
    expect(screen.getByTestId('submit-proof-card')).toHaveTextContent('SIMULATED');
  });

  it('disables Submit Proof button when wallet disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    render(<MemoryRouter><TaskDetails wallet={DISCONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());

    expect(screen.getByTestId('submit-proof-btn')).toBeDisabled();
    expect(screen.getByTestId('proof-wallet-disconnected-warning')).toBeInTheDocument();
  });

  it('disables Submit Proof button on wrong network', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    render(<MemoryRouter><TaskDetails wallet={WRONG_NETWORK_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());

    expect(screen.getByTestId('submit-proof-btn')).toBeDisabled();
    expect(screen.getByTestId('proof-wrong-network-warning')).toBeInTheDocument();
  });

  it('hides Submit Proof button for PROOF_SUBMITTED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('proof-submitted-card')).toBeInTheDocument());

    expect(screen.queryByTestId('submit-proof-btn')).not.toBeInTheDocument();
  });

  it('calls contract.submitProof with correct args and transitions to PROOF_SUBMITTED', async () => {
    const HASH = '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222';
    vi.mocked(api.getTask)
      .mockResolvedValueOnce(T004_WORKING)
      .mockResolvedValueOnce(T004_PROOF_SUBMITTED);
    vi.mocked(contract.submitProof).mockResolvedValue(mockTx(HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() =>
      expect(contract.submitProof).toHaveBeenCalledWith(
        'T004',
        '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648'
      )
    );

    await waitFor(() => expect(screen.getByTestId('proof-submitted-card')).toBeInTheDocument());
    expect(screen.queryByTestId('submit-proof-btn')).not.toBeInTheDocument();
  });

  it('handles user rejection without fabricating PROOF_SUBMITTED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    vi.mocked(contract.submitProof).mockRejectedValue(new Error('user rejected action'));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() => expect(screen.getByTestId('proof-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('proof-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    expect(screen.getByTestId('task-status')).toHaveTextContent('WORKING');
    expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument();
  });

  it('handles contract revert of submitProof with specific message', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    vi.mocked(contract.submitProof).mockRejectedValue(
      new Error('execution reverted: Task must be in WORKING state')
    );

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('submit-proof-btn'));

    await waitFor(() => expect(screen.getByTestId('proof-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('proof-tx-error')).toHaveTextContent(
      'Task must be in WORKING state to submit proof.'
    );
    expect(screen.getByTestId('task-status')).toHaveTextContent('WORKING');
  });
});

// -- verifyTask tests ----------------------------------------------------------

describe('TaskDetails Phase C -- verifyTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Verify Task card for PROOF_SUBMITTED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-card')).toBeInTheDocument());

    expect(screen.getByTestId('verify-task-btn')).not.toBeDisabled();
    expect(screen.getByTestId('verify-task-btn')).toHaveTextContent('Record Verification On-Chain');
    expect(screen.getByTestId('verify-task-card')).toHaveTextContent('Authorized Verifier');
  });

  it('hides Verify Task button for WORKING state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());

    expect(screen.queryByTestId('verify-task-btn')).not.toBeInTheDocument();
  });

  it('hides Verify Task button for VERIFIED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('task-verified-card')).toBeInTheDocument());

    expect(screen.queryByTestId('verify-task-btn')).not.toBeInTheDocument();
  });

  it('disables Verify button when wallet disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={DISCONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-btn')).toBeInTheDocument());

    expect(screen.getByTestId('verify-task-btn')).toBeDisabled();
    expect(screen.getByTestId('verify-wallet-disconnected-warning')).toBeInTheDocument();
  });

  it('calls contract.verifyTask(taskId, true) and transitions to VERIFIED', async () => {
    const HASH = '0xbbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333';
    vi.mocked(api.getTask)
      .mockResolvedValueOnce(T004_PROOF_SUBMITTED)
      .mockResolvedValueOnce(T004_VERIFIED);
    vi.mocked(contract.verifyTask).mockResolvedValue(mockTx(HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('verify-task-btn'));

    await waitFor(() => expect(contract.verifyTask).toHaveBeenCalledWith('T004', true));

    await waitFor(() => expect(screen.getByTestId('task-verified-card')).toBeInTheDocument());
    expect(screen.queryByTestId('verify-task-btn')).not.toBeInTheDocument();
  });

  it('handles user rejection of verifyTask without fabricating VERIFIED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    vi.mocked(contract.verifyTask).mockRejectedValue(new Error('user rejected action'));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('verify-task-btn'));

    await waitFor(() => expect(screen.getByTestId('verify-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('verify-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    expect(screen.getByTestId('task-status')).toHaveTextContent('PROOF SUBMITTED');
    expect(screen.getByTestId('verify-task-btn')).toBeInTheDocument();
  });

  it('handles Only authorized verifier revert', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    vi.mocked(contract.verifyTask).mockRejectedValue(
      new Error('execution reverted: Only authorized verifier can verify task')
    );

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('verify-task-btn'));

    await waitFor(() => expect(screen.getByTestId('verify-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('verify-tx-error')).toHaveTextContent(
      'Only the authorized verifier can call verifyTask.'
    );
  });
});

// -- releasePayment tests ------------------------------------------------------

describe('TaskDetails Phase C -- releasePayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Release Payment card for VERIFIED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-card')).toBeInTheDocument());

    expect(screen.getByTestId('release-payment-btn')).not.toBeDisabled();
    expect(screen.getByTestId('release-payment-btn')).toHaveTextContent('Release Payment to Robot');
    expect(screen.getByTestId('release-payment-card')).toHaveTextContent('0.5 MSTC');
    expect(screen.getByTestId('release-payment-card')).toHaveTextContent('Verified');
  });

  it('hides Release Payment button for PROOF_SUBMITTED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('verify-task-card')).toBeInTheDocument());

    expect(screen.queryByTestId('release-payment-btn')).not.toBeInTheDocument();
  });

  it('hides Release Payment button for PAID state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PAID);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('payment-released-card')).toBeInTheDocument());

    expect(screen.queryByTestId('release-payment-btn')).not.toBeInTheDocument();
  });

  it('disables Release button when wallet disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    render(<MemoryRouter><TaskDetails wallet={DISCONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument());

    expect(screen.getByTestId('release-payment-btn')).toBeDisabled();
    expect(screen.getByTestId('release-wallet-disconnected-warning')).toBeInTheDocument();
  });

  it('disables Release button on wrong network', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    render(<MemoryRouter><TaskDetails wallet={WRONG_NETWORK_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument());

    expect(screen.getByTestId('release-payment-btn')).toBeDisabled();
    expect(screen.getByTestId('release-wrong-network-warning')).toBeInTheDocument();
  });

  it('calls contract.releasePayment and transitions to PAID with correct details', async () => {
    const HASH = '0xcccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444';
    vi.mocked(api.getTask)
      .mockResolvedValueOnce(T004_VERIFIED)
      .mockResolvedValueOnce(T004_PAID);
    vi.mocked(contract.releasePayment).mockResolvedValue(mockTx(HASH));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('release-payment-btn'));

    await waitFor(() => expect(contract.releasePayment).toHaveBeenCalledWith('T004'));

    await waitFor(() => expect(screen.getByTestId('payment-released-card')).toBeInTheDocument());

    const card = screen.getByTestId('payment-released-card');
    expect(card).toHaveTextContent('PAID');
    expect(card).toHaveTextContent('0.5 MSTC');
    expect(card).toHaveTextContent('NR-001');
    expect(screen.queryByTestId('release-payment-btn')).not.toBeInTheDocument();
  });

  it('handles user rejection of releasePayment without fabricating PAID state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    vi.mocked(contract.releasePayment).mockRejectedValue(new Error('user rejected action'));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('release-payment-btn'));

    await waitFor(() => expect(screen.getByTestId('release-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('release-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    expect(screen.getByTestId('task-status')).toHaveTextContent('VERIFIED');
    expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument();
  });

  it('handles contract revert of releasePayment', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    vi.mocked(contract.releasePayment).mockRejectedValue(
      new Error('execution reverted: Task must be in VERIFIED state')
    );

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('release-payment-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('release-payment-btn'));

    await waitFor(() => expect(screen.getByTestId('release-tx-error')).toBeInTheDocument());

    expect(screen.getByTestId('release-tx-error')).toHaveTextContent(
      'Task must be in VERIFIED state to release payment.'
    );
  });
});

// -- PAID card tests -----------------------------------------------------------

describe('TaskDetails Phase C -- PAID card', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows payment-released card with correct info for PAID task', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PAID);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('payment-released-card')).toBeInTheDocument());

    const card = screen.getByTestId('payment-released-card');
    expect(card).toHaveTextContent('PAID');
    expect(card).toHaveTextContent('0.5 MSTC');
    expect(card).toHaveTextContent('NR-001');
    expect(card).toHaveTextContent(ROBOT_ADDRESS);
    expect(card).toHaveTextContent('Escrow Settled');
  });

  it('does not show any action buttons for PAID task', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PAID);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('payment-released-card')).toBeInTheDocument());

    expect(screen.queryByTestId('submit-proof-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('verify-task-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('release-payment-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refund-task-btn')).not.toBeInTheDocument();
  });
});

// -- refundTask tests ----------------------------------------------------------

describe('TaskDetails Phase C -- refundTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Refund Task card for PROOF_SUBMITTED state when connected as creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-card')).toBeInTheDocument());

    const btn = screen.getByTestId('refund-task-btn');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('Refund Task Escrow');
    expect(screen.getByTestId('refund-task-card')).toHaveTextContent('Warning: Refunding cancels further on-chain progress');
  });

  it('hides Refund Task card for WORKING and VERIFIED states', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);
    const { unmount } = render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('submit-proof-card')).toBeInTheDocument());
    expect(screen.queryByTestId('refund-task-card')).not.toBeInTheDocument();
    unmount();

    vi.mocked(api.getTask).mockResolvedValue(T004_VERIFIED);
    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('task-verified-card')).toBeInTheDocument());
    expect(screen.queryByTestId('refund-task-card')).not.toBeInTheDocument();
  });

  it('disables Refund button when wallet disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    render(<MemoryRouter><TaskDetails wallet={DISCONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-card')).toBeInTheDocument());

    expect(screen.getByTestId('refund-task-btn')).toBeDisabled();
    expect(screen.getByTestId('refund-wallet-disconnected-warning')).toBeInTheDocument();
  });

  it('disables Refund button when connected wallet is not the creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    const nonCreatorWallet = { ...CONNECTED_WALLET, address: OTHER_ADDRESS };
    render(<MemoryRouter><TaskDetails wallet={nonCreatorWallet} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-card')).toBeInTheDocument());

    expect(screen.getByTestId('refund-task-btn')).toBeDisabled();
    expect(screen.getByTestId('refund-not-creator-warning')).toBeInTheDocument();
  });

  it('calls contract.refundTask(taskId) and transitions to REFUNDED', async () => {
    const REFUND_TX = '0x9999888877776666555544443333222211110000999988887777666655554444';
    const T004_REFUNDED: ApiTask = {
      ...T004_PROOF_SUBMITTED,
      state: TaskState.REFUNDED,
      stateLabel: 'REFUNDED',
    };
    vi.mocked(api.getTask)
      .mockResolvedValueOnce(T004_PROOF_SUBMITTED)
      .mockResolvedValueOnce(T004_REFUNDED);
    vi.mocked(contract.refundTask).mockResolvedValue(mockTx(REFUND_TX));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('refund-task-btn'));

    await waitFor(() => expect(contract.refundTask).toHaveBeenCalledWith('T004'));
    await waitFor(() => expect(screen.getByTestId('task-refunded-card')).toBeInTheDocument());

    expect(screen.getByTestId('task-refunded-card')).toHaveTextContent('Task Refunded');
    expect(screen.getByTestId('task-refunded-card')).toHaveTextContent('0.5 MSTC');
  });

  it('handles user rejection of refundTask without fabricating REFUNDED state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_PROOF_SUBMITTED);
    vi.mocked(contract.refundTask).mockRejectedValue(new Error('User denied transaction signature'));

    render(<MemoryRouter><TaskDetails wallet={CONNECTED_WALLET} /></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('refund-task-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('refund-task-btn'));

    await waitFor(() => expect(screen.getByTestId('refund-tx-error')).toBeInTheDocument());
    expect(screen.getByTestId('refund-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    expect(screen.queryByTestId('task-refunded-card')).not.toBeInTheDocument();
  });
});

