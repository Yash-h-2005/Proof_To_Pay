import { useNavigate } from 'react-router-dom';
import type { ApiTask } from '../types/task';
import { KNOWN_TXS } from '../blockchain/config';
import TaskStatus from './TaskStatus';
import TransactionLink from './TransactionLink';

interface TaskCardProps {
  task: ApiTask;
}

export default function TaskCard({ task }: TaskCardProps) {
  const navigate = useNavigate();

  // For T001, we know its creation tx hash
  const txHash = task.taskId === 'T001' ? KNOWN_TXS.createTask : undefined;

  const shortAddress = (addr: string) =>
    addr && addr !== '0x0000000000000000000000000000000000000000'
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : '—';

  return (
    <div className="task-card" data-testid="task-card">
      <div className="task-card__header">
        <span className="task-card__id">#{task.taskId}</span>
        <TaskStatus state={task.state} />
      </div>

      <div className="task-card__meta">
        <div className="task-card__field">
          <span className="task-card__field-label">Package</span>
          <span className="task-card__field-value">{task.packageId}</span>
        </div>
        <div className="task-card__field">
          <span className="task-card__field-label">Reward</span>
          <span className="task-card__reward">{task.rewardMSTC} MSTC</span>
        </div>
        <div className="task-card__field">
          <span className="task-card__field-label">From</span>
          <span className="task-card__field-value">{task.source}</span>
        </div>
        <div className="task-card__field">
          <span className="task-card__field-label">To</span>
          <span className="task-card__field-value">{task.destination}</span>
        </div>
        <div className="task-card__field">
          <span className="task-card__field-label">Creator</span>
          <span className="task-card__field-value text-mono">{shortAddress(task.creator)}</span>
        </div>
        <div className="task-card__field">
          <span className="task-card__field-label">Robot</span>
          <span className="task-card__field-value text-mono">{shortAddress(task.robot)}</span>
        </div>
      </div>

      {txHash && (
        <div style={{ marginBottom: '8px' }}>
          <span className="task-card__field-label" style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Creation Transaction</span>
          <TransactionLink hash={txHash} />
        </div>
      )}

      <div className="task-card__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => navigate(`/task/${task.taskId}`)}
        >
          View Task →
        </button>
        {txHash && (
          <a
            href={`https://testnet.mstscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary btn--sm"
          >
            View on MSTScan ↗
          </a>
        )}
      </div>
    </div>
  );
}
