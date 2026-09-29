import { MST_TESTNET_CHAIN_ID } from '../blockchain/config';

interface NetworkBadgeProps {
  chainId: number | null;
  connected: boolean;
}

export default function NetworkBadge({ chainId, connected }: NetworkBadgeProps) {
  if (!connected) {
    return (
      <span className="network-badge network-badge--disconnected" data-testid="network-badge">
        <span className="network-badge__dot" />
        Not Connected
      </span>
    );
  }

  const isCorrect = chainId === MST_TESTNET_CHAIN_ID;

  if (!isCorrect) {
    return (
      <span className="network-badge network-badge--wrong" data-testid="network-badge">
        <span className="network-badge__dot" style={{ background: '#ef4444', animation: 'none' }} />
        Wrong Network
      </span>
    );
  }

  return (
    <span className="network-badge" data-testid="network-badge">
      <span className="network-badge__dot" />
      MST Testnet
    </span>
  );
}
