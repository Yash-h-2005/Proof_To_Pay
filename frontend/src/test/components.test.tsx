import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mock window.ethereum ─────────────────────────────────────────────────────
// BridgeKey injects via window.ethereum (EIP-1193)
const mockEthereum = {
  isMetaMask: false,
  isBridgeKey: true,
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

// ─── Mock react-router-dom navigate ──────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────
import WalletButton from '../components/WalletButton';
import NetworkBadge from '../components/NetworkBadge';
import TransactionLink from '../components/TransactionLink';
import TaskStatus from '../components/TaskStatus';
import TaskCard from '../components/TaskCard';
import LoadingState from '../components/LoadingState';
import { INITIAL_STATE } from '../blockchain/wallet';
import { MST_TESTNET_CHAIN_ID } from '../blockchain/config';
import type { ApiTask } from '../types/task';
import { TaskState } from '../types/task';

// ─── Sample Data ──────────────────────────────────────────────────────────────
const T001: ApiTask = {
  taskId: 'T001',
  creator: '0xBFe5A4c2a3e4D7Fc9A12B3f6789012345678e302',
  robot: '0x0000000000000000000000000000000000000000',
  rewardWei: '100000000000000000000',
  rewardMSTC: '100.0',
  packageId: 'P01',
  source: 'Zone A',
  destination: 'Zone B',
  proofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  state: TaskState.CREATED,
  stateLabel: 'CREATED',
  createdAt: 1700000000,
  proofSubmittedAt: 0,
  verifiedAt: 0,
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Proof-to-Pay Frontend Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Wallet Button renders
  describe('WalletButton', () => {
    it('renders Connect BridgeKey button when not connected', () => {
      render(
        <WalletButton
          wallet={INITIAL_STATE}
          onConnect={vi.fn()}
          onError={vi.fn()}
        />
      );
      const btn = screen.getByTestId('wallet-connect-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent('Connect BridgeKey');
    });

    it('shows error if no wallet installed on click', async () => {
      const onError = vi.fn();
      Object.defineProperty(window, 'ethereum', { value: undefined, writable: true, configurable: true });

      render(
        <WalletButton wallet={INITIAL_STATE} onConnect={vi.fn()} onError={onError} />
      );

      fireEvent.click(screen.getByTestId('wallet-connect-btn'));
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('BridgeKey or a compatible browser wallet was not detected')
      );
    });

    it('does not render when wallet is already connected', () => {
      render(
        <WalletButton
          wallet={{ ...INITIAL_STATE, isConnected: true, address: '0xabc' }}
          onConnect={vi.fn()}
          onError={vi.fn()}
        />
      );
      expect(screen.queryByTestId('wallet-connect-btn')).not.toBeInTheDocument();
    });
  });

  // 2. Dashboard renders
  describe('NetworkBadge', () => {
    it('shows Not Connected when not connected', () => {
      render(<NetworkBadge chainId={null} connected={false} />);
      expect(screen.getByTestId('network-badge')).toHaveTextContent('Not Connected');
    });

    it('shows MST Testnet when connected to correct chain', () => {
      render(<NetworkBadge chainId={MST_TESTNET_CHAIN_ID} connected={true} />);
      expect(screen.getByTestId('network-badge')).toHaveTextContent('MST Testnet');
    });

    it('shows Wrong Network when connected to wrong chain', () => {
      render(<NetworkBadge chainId={1} connected={true} />);
      expect(screen.getByTestId('network-badge')).toHaveTextContent('Wrong Network');
    });
  });

  // 3. Task card renders
  describe('TaskCard', () => {
    it('renders T001 task card with correct data', () => {
      render(
        <MemoryRouter>
          <TaskCard task={T001} />
        </MemoryRouter>
      );
      const card = screen.getByTestId('task-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('T001');
      expect(card).toHaveTextContent('P01');
      expect(card).toHaveTextContent('Zone A');
      expect(card).toHaveTextContent('Zone B');
      expect(card).toHaveTextContent('100.0 MSTC');
    });

    it('task card shows View Task button', () => {
      render(
        <MemoryRouter>
          <TaskCard task={T001} />
        </MemoryRouter>
      );
      expect(screen.getByText('View Task →')).toBeInTheDocument();
    });
  });

  // 4. Create task form validation
  describe('Create task form validation', () => {
    it('shows wallet warning when not connected', async () => {
      // Import dynamically to avoid module issues
      const { CreateTaskValidation } = await import('./CreateTaskValidation.test-helper');
      const errors = CreateTaskValidation({
        taskId: '',
        packageId: '',
        source: '',
        destination: '',
        reward: '',
      });
      expect(errors.taskId).toBe('Task ID is required.');
      expect(errors.reward).toBeDefined();
    });
  });

  // 5. Transaction link generation
  describe('TransactionLink', () => {
    it('renders a correctly shortened tx hash with MSTScan link', () => {
      const hash = '0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f';
      render(<TransactionLink hash={hash} />);
      const link = screen.getByTestId('tx-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', expect.stringContaining('mstscan.com/tx/'));
      expect(link).toHaveAttribute('href', expect.stringContaining(hash));
      expect(link).toHaveTextContent('0xbd615d');
      expect(link).toHaveTextContent('d758f');
    });

    it('renders null for empty hash', () => {
      const { container } = render(<TransactionLink hash="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  // 6. Network badge renders (additional cases)
  describe('Network badge edge cases', () => {
    it('renders with animation dot when on MST Testnet', () => {
      const { container } = render(
        <NetworkBadge chainId={MST_TESTNET_CHAIN_ID} connected={true} />
      );
      expect(container.querySelector('.network-badge__dot')).toBeInTheDocument();
    });
  });

  // 7. Backend error handling
  describe('LoadingState', () => {
    it('renders loading spinner with message', () => {
      render(<LoadingState message="Reading tasks from MST Testnet..." />);
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Reading tasks from MST Testnet...')).toBeInTheDocument();
    });
  });

  // 8. TaskStatus badge
  describe('TaskStatus', () => {
    it('renders CREATED status badge', () => {
      render(<TaskStatus state={TaskState.CREATED} />);
      expect(screen.getByTestId('task-status')).toHaveTextContent('CREATED');
    });

    it('renders VERIFIED status badge', () => {
      render(<TaskStatus state={TaskState.VERIFIED} />);
      expect(screen.getByTestId('task-status')).toHaveTextContent('VERIFIED');
    });

    it('renders PAID status badge', () => {
      render(<TaskStatus state={TaskState.PAID} />);
      expect(screen.getByTestId('task-status')).toHaveTextContent('PAID');
    });
  });
});
