import { TASK_STATE_COLORS, TASK_STATE_LABELS } from '../types/task';

interface TaskStatusProps {
  state: number;
  size?: 'sm' | 'md';
}

const STATE_ICONS: Record<number, string> = {
  0: '📋',
  1: '💰',
  2: '🤖',
  3: '⚙️',
  4: '📡',
  5: '✅',
  6: '💳',
  7: '↩️',
};

export default function TaskStatus({ state, size = 'md' }: TaskStatusProps) {
  const label = TASK_STATE_LABELS[state] ?? 'UNKNOWN';
  const color = TASK_STATE_COLORS[state] ?? '#94a3b8';
  const icon = STATE_ICONS[state] ?? '?';

  const bg = `${color}20`;
  const border = `${color}40`;

  return (
    <span
      className="status-badge"
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontSize: size === 'sm' ? '10px' : '11px',
      }}
      data-testid="task-status"
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
