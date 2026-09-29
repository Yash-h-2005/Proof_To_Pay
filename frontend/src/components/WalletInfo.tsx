import { useState, useRef, useEffect } from 'react';
import type { WalletState } from '../blockchain/wallet';
import { getBalance } from '../blockchain/wallet';

interface WalletInfoProps {
  wallet: WalletState;
  onDisconnect: () => void;
}

export default function WalletInfo({ wallet, onDisconnect }: WalletInfoProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState(wallet.balanceMSTC ?? '0.0');
  const ref = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Refresh balance when panel opens
  useEffect(() => {
    if (open && wallet.address) {
      getBalance(wallet.address).then(setBalance).catch(() => {});
    }
  }, [open, wallet.address]);

  const shortAddress = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : '';

  const handleCopy = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref} data-testid="wallet-info">
      <button
        className="wallet-btn wallet-btn--connected"
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ fontSize: '16px' }}>🟠</span>
        {shortAddress}
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="wallet-panel" data-testid="wallet-panel">
          <div style={{ marginBottom: '12px' }}>
            <div className="detail-field__label" style={{ marginBottom: '6px' }}>Connected Wallet</div>
            <div className="wallet-panel__address">{wallet.address}</div>
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : '⧉ Copy Address'}
            </button>
          </div>

          <div className="divider" style={{ margin: '12px 0' }} />

          <div style={{ marginBottom: '16px' }}>
            <div className="detail-field__label" style={{ marginBottom: '4px' }}>Balance</div>
            <div>
              <span className="wallet-panel__balance">
                {parseFloat(balance).toFixed(4)}
              </span>
              <span className="wallet-panel__unit">MSTC</span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div className="detail-field__label" style={{ marginBottom: '4px' }}>Network</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: 'var(--orange-500)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--orange-500)', display: 'inline-block' }} />
              MST Testnet
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>
                (Chain {wallet.chainId})
              </span>
            </div>
          </div>

          <button
            className="btn btn--danger btn--sm btn--full"
            onClick={() => { setOpen(false); onDisconnect(); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
