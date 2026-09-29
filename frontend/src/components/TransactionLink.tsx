import { MST_EXPLORER_URL } from '../blockchain/config';

interface TransactionLinkProps {
  hash: string;
  label?: string;
  className?: string;
}

function shortenHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-5)}`;
}

export default function TransactionLink({ hash, label, className = '' }: TransactionLinkProps) {
  if (!hash) return null;

  const url = `${MST_EXPLORER_URL}/tx/${hash}`;
  const display = label ?? shortenHash(hash);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`tx-link ${className}`}
      title={hash}
      data-testid="tx-link"
    >
      {display}
      <span className="tx-link__icon">↗</span>
    </a>
  );
}
