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
  assignRobot: vi.fn(),
  startTask: vi.fn(),
  createTask: vi.fn(),
  fetchTask: vi.fn(),
  fetchAllTaskIds: vi.fn(),
  fetchAllTasks: vi.fn(),
  refundTask: vi.fn(),
}));

const CREATOR_ADDRESS = '0xBFe5A4c2a3e4D7Fc9A12B3f6789012345678e302';
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111';
const ROBOT_ADDRESS = '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302';

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

const T004_ASSIGNED: ApiTask = {
  ...T004_CREATED,
  robot: ROBOT_ADDRESS,
  state: TaskState.ASSIGNED,
  stateLabel: 'ASSIGNED',
};

const T004_WORKING: ApiTask = {
  ...T004_CREATED,
  robot: ROBOT_ADDRESS,
  state: TaskState.WORKING,
  stateLabel: 'WORKING',
};

describe('TaskDetails — Start Task Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Start button visible for ASSIGNED task
  it('displays Start Task button and ready status for ASSIGNED task when connected as creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);

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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    const startBtn = screen.getByTestId('start-task-btn');
    expect(startBtn).toHaveTextContent('Start Task');
    expect(startBtn).not.toBeDisabled();
    expect(screen.getByTestId('start-task-card')).toHaveTextContent('Task ready to start');
    expect(screen.getByTestId('start-task-card')).toHaveTextContent('NR-001');
  });

  // 2. Start button hidden for FUNDED task
  it('hides Start Task section for FUNDED task', async () => {
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
      expect(screen.getByTestId('assign-robot-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('start-task-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('start-task-card')).not.toBeInTheDocument();
  });

  // 3. Start button hidden for CREATED task
  it('hides Start Task section for CREATED task', async () => {
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
      expect(screen.getByTestId('escrow-funding-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('start-task-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('start-task-card')).not.toBeInTheDocument();
  });

  // 4. Start button hidden/disabled for WORKING task
  it('hides Start button and shows Task Working card for WORKING task', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_WORKING);

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
      expect(screen.getByTestId('task-working-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('start-task-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-working-card')).toHaveTextContent('TASK STATE: WORKING');
    expect(screen.getByTestId('task-working-card')).toHaveTextContent(
      'Task started. Robot is now authorized to perform the physical task.'
    );
  });

  // 5. Wallet disconnected
  it('disables Start button and shows warning when wallet is disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);

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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    const startBtn = screen.getByTestId('start-task-btn');
    expect(startBtn).toBeDisabled();
    expect(screen.getByTestId('start-wallet-disconnected-warning')).toBeInTheDocument();
    expect(screen.getByTestId('start-wallet-disconnected-warning')).toHaveTextContent(
      'Wallet not connected. Connect your BridgeKey wallet to start this task.'
    );
  });

  // 6. Non-creator wallet
  it('disables Start button when connected wallet is not the task creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);

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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    const startBtn = screen.getByTestId('start-task-btn');
    expect(startBtn).toBeDisabled();
    expect(screen.getByTestId('start-not-creator-warning')).toBeInTheDocument();
    expect(screen.getByTestId('start-not-creator-warning')).toHaveTextContent(
      'Connected wallet is not the task creator.'
    );
  });

  // 7. Wrong network
  it('disables Start button when connected to wrong network', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);

    render(
      <MemoryRouter>
        <TaskDetails
          wallet={{
            isConnected: true,
            isCorrectNetwork: false,
            address: CREATOR_ADDRESS,
            chainId: 1,
            balanceMSTC: '10.0',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    const startBtn = screen.getByTestId('start-task-btn');
    expect(startBtn).toBeDisabled();
    expect(screen.getByTestId('start-wrong-network-warning')).toBeInTheDocument();
    expect(screen.getByTestId('start-wrong-network-warning')).toHaveTextContent(
      'Please switch your wallet to MST Testnet (Chain ID 91562037).'
    );
  });

  // 8. Successful start
  it('handles successful start, calls contract startTask, and transitions to WORKING', async () => {
    vi.mocked(api.getTask).mockResolvedValueOnce(T004_ASSIGNED).mockResolvedValueOnce(T004_WORKING);

    const mockTxHash = '0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff';
    const mockWait = vi.fn().mockResolvedValue({ status: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(contract.startTask).mockResolvedValue({
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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-task-btn'));

    // Verify contract call
    await waitFor(() => {
      expect(contract.startTask).toHaveBeenCalledWith('T004');
    });

    // Verify confirmation and display of Task Working card
    await waitFor(() => {
      expect(screen.getByTestId('task-working-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('task-working-card')).toHaveTextContent('TASK STATE: WORKING');
    expect(screen.getByTestId('task-working-card')).toHaveTextContent(
      'Task started. Robot is now authorized to perform the physical task.'
    );
    expect(screen.getByTestId('task-working-card')).toHaveTextContent('0x9999');
    expect(screen.queryByTestId('start-task-btn')).not.toBeInTheDocument();
  });

  // 9. Wallet rejection
  it('handles user rejection without changing state or fabricating WORKING state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);
    vi.mocked(contract.startTask).mockRejectedValue(new Error('user rejected action'));

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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-task-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('start-tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('start-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    // State remains ASSIGNED
    expect(screen.getByTestId('task-status')).toHaveTextContent('ASSIGNED');
    expect(screen.queryByTestId('task-working-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
  });

  // 10. Contract failure
  it('handles contract or network failure without fabricating WORKING state', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_ASSIGNED);
    vi.mocked(contract.startTask).mockRejectedValue(
      new Error('execution reverted: Task must be in ASSIGNED state')
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
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-task-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('start-tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('start-tx-error')).toHaveTextContent(
      'Task must be in ASSIGNED state to start.'
    );
    // State remains ASSIGNED
    expect(screen.getByTestId('task-status')).toHaveTextContent('ASSIGNED');
    expect(screen.queryByTestId('task-working-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
  });
});
