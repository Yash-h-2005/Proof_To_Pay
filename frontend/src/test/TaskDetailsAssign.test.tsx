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

describe('TaskDetails — Assign Robot Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Assign button visible for FUNDED task
  it('displays Assign Robot button and robot info for FUNDED task when connected as creator', async () => {
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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    const assignBtn = screen.getByTestId('assign-robot-btn');
    expect(assignBtn).toHaveTextContent('Assign Robot NR-001');
    expect(assignBtn).not.toBeDisabled();
    expect(screen.getByTestId('assign-robot-card')).toHaveTextContent('NR-001');
    expect(screen.getByTestId('assign-robot-card')).toHaveTextContent(ROBOT_ADDRESS);
  });

  // 2. Assign button hidden for CREATED task
  it('hides Assign Robot section for CREATED task', async () => {
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

    expect(screen.queryByTestId('assign-robot-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assign-robot-card')).not.toBeInTheDocument();
  });

  // 3. Assign button hidden/disabled for ASSIGNED task
  it('hides Assign button and shows Robot Assigned card for ASSIGNED task', async () => {
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
      expect(screen.getByTestId('robot-assigned-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('assign-robot-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent('Robot Assigned');
    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent('NR-001');
    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent(ROBOT_ADDRESS);
  });

  // 4. Wallet disconnected
  it('disables Assign button and shows warning when wallet is disconnected', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);

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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    const assignBtn = screen.getByTestId('assign-robot-btn');
    expect(assignBtn).toBeDisabled();
    expect(screen.getByTestId('assign-wallet-disconnected-warning')).toBeInTheDocument();
    expect(screen.getByTestId('assign-wallet-disconnected-warning')).toHaveTextContent(
      'Wallet not connected. Connect your BridgeKey wallet to assign a robot.'
    );
  });

  // 5. Non-creator wallet
  it('disables Assign button when connected wallet is not the task creator', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);

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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    const assignBtn = screen.getByTestId('assign-robot-btn');
    expect(assignBtn).toBeDisabled();
    expect(screen.getByTestId('assign-not-creator-warning')).toBeInTheDocument();
    expect(screen.getByTestId('assign-not-creator-warning')).toHaveTextContent(
      'Connected wallet is not the task creator.'
    );
  });

  // 6. Wrong network
  it('disables Assign button when connected to wrong network', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);

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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    const assignBtn = screen.getByTestId('assign-robot-btn');
    expect(assignBtn).toBeDisabled();
    expect(screen.getByTestId('assign-wrong-network-warning')).toBeInTheDocument();
    expect(screen.getByTestId('assign-wrong-network-warning')).toHaveTextContent(
      'Please switch your wallet to MST Testnet (Chain ID 91562037).'
    );
  });

  // 7. Successful assignment
  it('handles successful assignment, calls contract with robot address, and transitions to ASSIGNED', async () => {
    vi.mocked(api.getTask).mockResolvedValueOnce(T004_FUNDED).mockResolvedValueOnce(T004_ASSIGNED);

    const mockTxHash = '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
    const mockWait = vi.fn().mockResolvedValue({ status: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(contract.assignRobot).mockResolvedValue({
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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('assign-robot-btn'));

    // Verify contract call
    await waitFor(() => {
      expect(contract.assignRobot).toHaveBeenCalledWith('T004', ROBOT_ADDRESS);
    });

    // Verify confirmation and display of Robot Assigned
    await waitFor(() => {
      expect(screen.getByTestId('robot-assigned-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent('Robot Assigned');
    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent(ROBOT_ADDRESS);
    expect(screen.getByTestId('robot-assigned-card')).toHaveTextContent('0x1111');
    expect(screen.queryByTestId('assign-robot-btn')).not.toBeInTheDocument();
  });

  // 8. Wallet rejection
  it('handles user rejection without changing state or fabricating assignment', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);
    vi.mocked(contract.assignRobot).mockRejectedValue(new Error('user rejected action'));

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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('assign-robot-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('assign-tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('assign-tx-error')).toHaveTextContent('Transaction was rejected in the wallet.');
    // State remains FUNDED
    expect(screen.getByTestId('task-status')).toHaveTextContent('FUNDED');
    expect(screen.queryByTestId('robot-assigned-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
  });

  // 9. Contract failure
  it('handles contract or network failure without fabricating assignment', async () => {
    vi.mocked(api.getTask).mockResolvedValue(T004_FUNDED);
    vi.mocked(contract.assignRobot).mockRejectedValue(
      new Error('execution reverted: Only task creator can assign robot')
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
      expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('assign-robot-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('assign-tx-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('assign-tx-error')).toHaveTextContent('Only the task creator can assign a robot.');
    // State remains FUNDED
    expect(screen.getByTestId('task-status')).toHaveTextContent('FUNDED');
    expect(screen.queryByTestId('robot-assigned-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('assign-robot-btn')).toBeInTheDocument();
  });
});
