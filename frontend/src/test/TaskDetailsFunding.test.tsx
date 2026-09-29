import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetails from '../pages/TaskDetails';
import { TaskState } from '../types/task';
import type { ApiTask } from '../types/task';
import * as api from '../services/api';
import * as contract from '../blockchain/contract';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ taskId: 'T004' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock api service
vi.mock('../services/api', () => ({
  getTask: vi.fn(),
  getTaskEvidence: vi.fn(),
  computeProofHash: vi.fn(),
  submitProofEvidence: vi.fn(),
}));

// Mock contract module
vi.mock('../blockchain/contract', () => ({
  fundTask: vi.fn(),
  createTask: vi.fn(),
  fetchTask: vi.fn(),
  fetchAllTaskIds: vi.fn(),
  fetchAllTasks: vi.fn(),
  refundTask: vi.fn(),
}));

const CREATOR_ADDRESS = '0xBFe5A4c2a3e4D7Fc9A12B3f6789012345678e302';
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111';

const T004_CREATED: ApiTask = {
  taskId: 'T004',
  creator: CREATOR_ADDRESS,
  robot: '0x0000000000000000000000000000000000000000',
  rewardWei: '500000000000000000',
  rewardMSTC: '0.5',
  packageId: 'P04',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: TaskState.CREATED,
  stateLabel: 'CREATED',
  createdAt: 1700000000,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

const T004_FUNDED: ApiTask = {
  ...T004_CREATED,
  state: TaskState.FUNDED,
  stateLabel: 'FUNDED',
};

describe('TaskDetails — Escrow Funding Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Fund button visible for CREATED task
  it('displays Fund button for CREATED task when connected wallet is the creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_CREATED);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: CREATOR_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    const fundBtn = screen.getByTestId('fund-task-btn');
    expect(fundBtn).toHaveTextContent('Fund 0.5 MSTC');
    expect(fundBtn).not.toBeDisabled();
    expect(screen.getByTestId('ready-to-fund-info')).toHaveTextContent(
      'Fund 0.5 MSTC into smart-contract escrow?'
    );
  });

  // 2. Fund button hidden when already FUNDED
  it('hides Fund button and displays Escrow Active banner when task is already FUNDED', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: CREATOR_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('escrow-funded-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('fund-task-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('escrow-funded-card')).toHaveTextContent('Escrow funded: 0.5 MSTC');
  });

  // 3. Wallet disconnected state
  it('disables Fund button and displays warning when wallet is disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_CREATED);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: false,
            isCorrectNetwork: false,
            address: null,
            chainId: null,
            balanceMSTC: null,
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    const fundBtn = screen.getByTestId('fund-task-btn');
    expect(fundBtn).toBeDisabled();
    expect(screen.getByTestId('wallet-disconnected-warning')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-disconnected-warning')).toHaveTextContent(
      'Wallet not connected. Connect your BridgeKey wallet to fund this task.'
    );
  });

  // 4. Wallet connected but NOT creator
  it('disables Fund button when connected wallet is not the task creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_CREATED);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: OTHER_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    const fundBtn = screen.getByTestId('fund-task-btn');
    expect(fundBtn).toBeDisabled();
    expect(screen.getByTestId('wallet-not-creator-warning')).toHaveTextContent(
      'Connected wallet is not the task creator.'
    );
  });

  // 5. Successful transaction handling
  it('handles successful funding transaction, displays tx hash, and transitions to FUNDED', async () => {
    vi.mocked(api.getTask).mockResolvedValueOnce(T004_CREATED).mockResolvedValueOnce(T004_FUNDED);

    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const mockWait = vi.fn().mockResolvedValue({ status: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(contract.fundTask).mockResolvedValue({
      hash: mockTxHash,
      wait: mockWait,
    } as any);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: CREATOR_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    const fundBtn = screen.getByTestId('fund-task-btn');
    fireEvent.click(fundBtn);

    // Verify fundTask called with correct taskId and BigInt rewardWei
    await waitFor(() => {
      expect(contract.fundTask).toHaveBeenCalledWith('T004', 500000000000000000n);
    });

    // Verify confirmation and display of Escrow funded and transaction link
    await waitFor(() => {
      expect(screen.getByTestId('escrow-funded-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('escrow-funded-card')).toHaveTextContent('Escrow funded: 0.5 MSTC');
    expect(screen.getByTestId('escrow-funded-card')).toHaveTextContent('0xabcd');
    expect(screen.queryByTestId('fund-task-btn')).not.toBeInTheDocument();
  });

  // 6. Rejected transaction handling
  it('handles user rejection without changing state or fabricating success', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_CREATED);
    vi.mocked(contract.fundTask).mockRejectedValue(new Error('user rejected action'));

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: CREATOR_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('fund-task-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    // Must remain CREATED
    expect(screen.getByTestId('task-status')).toHaveTextContent('CREATED');
    expect(screen.queryByTestId('escrow-funded-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
  });

  // 7. Failed transaction handling
  it('handles contract or network failure without fabricating success', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_CREATED);
    vi.mocked(contract.fundTask).mockRejectedValue(
      new Error('insufficient funds for gas * price + value')
    );

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: true,
            address: CREATOR_ADDRESS,
            chainId: 91562037,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('fund-task-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tx-error')).toHaveTextContent(
      'Insufficient MST Testnet balance to fund escrow and pay for gas.'
    );
    // Must remain CREATED
    expect(screen.getByTestId('task-status')).toHaveTextContent('CREATED');
    expect(screen.queryByTestId('escrow-funded-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('fund-task-btn')).toBeInTheDocument();
  });
});
