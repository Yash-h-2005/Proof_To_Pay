import { useEffect, useState } from 'react';
import { getAllTasks } from '../services/api';
import type { ApiTask } from '../types/task';
import { computeTaskSummary, TaskState } from '../types/task';
import type { WalletState } from '../blockchain/wallet';
import { KNOWN_TXS, MST_EXPLORER_URL, PROOF_TO_PAY_CONTRACT } from '../blockchain/config';
import TaskCard from '../components/TaskCard';
import LoadingState from '../components/LoadingState';

interface DashboardProps {
  wallet: WalletState;
}

export default function Dashboard({ wallet }: DashboardProps) {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAllTasks()
      .then((data) => {
        setTasks(data);
        setError(null);
      })
      .catch(() => {
        setError(
          'Backend API is currently unavailable. Make sure the backend server is running on port 3001.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = computeTaskSummary(
    tasks.map((t) => ({
      ...t,
      rewardWei: BigInt(t.rewardWei),
      state: t.state as TaskState,
      stateLabel: t.stateLabel,
    }))
  );

  return (
    <div className="main-content">
      <div className="page-container">
        {/* Hero */}
        <div className="page-hero">
          <h1 className="page-hero__title">Proof-to-Pay</h1>
          <p className="page-hero__subtitle">
            Blockchain-powered robot task marketplace on MST Testnet
          </p>
          <div className="page-hero__tagline">
            Work → Proof → Verification → Payment
          </div>
        </div>

        {/* Wallet prompt */}
        {!wallet.isConnected && (
          <div className="alert alert--info mb-24" role="alert">
            <span>🔑</span>
            <span>
              Connect your BridgeKey wallet to create tasks and interact with the smart contract.
              Task data is publicly readable from the blockchain without a wallet.
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="section">
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__icon" style={{ background: '#f0f4fb', color: 'var(--navy-700)' }}>📋</div>
              <div className="stat-card__label">Total Tasks</div>
              <div className="stat-card__value">{loading ? '—' : summary.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon" style={{ background: 'var(--orange-100)', color: 'var(--orange-500)' }}>⚙️</div>
              <div className="stat-card__label">Active Tasks</div>
              <div className="stat-card__value">{loading ? '—' : summary.active}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon" style={{ background: 'var(--blue-100)', color: 'var(--blue-600)' }}>💰</div>
              <div className="stat-card__label">Escrowed</div>
              <div className="stat-card__value">
                {loading ? '—' : parseFloat(summary.escrowedMSTC).toFixed(2)}
                <span className="stat-card__unit">MSTC</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>✅</div>
              <div className="stat-card__label">Verified / Paid</div>
              <div className="stat-card__value">{loading ? '—' : summary.verified + summary.paid}</div>
            </div>
          </div>
        </div>

        {/* Contract info */}
        <div className="section">
          <div className="card">
            <div className="card__header">
              <div>
                <div className="card__title">🔗 Deployed Contract</div>
                <div className="card__subtitle">ProofToPay — MST Testnet (Chain ID 91562037)</div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-field">
                <div className="detail-field__label">Contract Address</div>
                <div className="detail-field__value detail-field__value--mono">
                  <a
                    href={`${MST_EXPLORER_URL}/address/${PROOF_TO_PAY_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--blue-600)' }}
                  >
                    {PROOF_TO_PAY_CONTRACT}
                  </a>
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-field__label">Deployment Transaction</div>
                <div className="detail-field__value detail-field__value--mono">
                  <a
                    href={`${MST_EXPLORER_URL}/tx/${KNOWN_TXS.deployment}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--blue-600)' }}
                  >
                    {KNOWN_TXS.deployment.slice(0, 14)}...{KNOWN_TXS.deployment.slice(-8)}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Recent Tasks</h2>
          </div>

          {error && (
            <div className="alert alert--error mb-16" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <LoadingState message="Reading tasks from MST Testnet..." />
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <div className="empty-state__title">No tasks found</div>
              <div className="empty-state__desc">
                Create the first task on the blockchain using the Create Task page.
              </div>
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <TaskCard key={task.taskId} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
