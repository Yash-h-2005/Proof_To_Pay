import { useState } from 'react';
import { isWalletInstalled, connectWallet } from '../blockchain/wallet';
import type { WalletState } from '../blockchain/wallet';

interface WalletButtonProps {
  wallet: WalletState;
  onConnect: (state: WalletState) => void;
  onError: (msg: string) => void;
}

export default function WalletButton({ wallet, onConnect, onError }: WalletButtonProps) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!isWalletInstalled()) {
      onError(
        'BridgeKey or a compatible browser wallet was not detected. ' +
          'Please install BridgeKey to connect.'
      );
      return;
    }

    setConnecting(true);
    try {
      const state = await connectWallet();
      onConnect(state);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect wallet.';
      onError(msg);
    } finally {
      setConnecting(false);
    }
  };

  if (wallet.isConnected) return null;

  return (
    <button
      className="wallet-btn"
      onClick={handleConnect}
      disabled={connecting}
      data-testid="wallet-connect-btn"
    >
      {connecting ? (
        <>
          <div className="spinner spinner--sm spinner--white" />
          Connecting...
        </>
      ) : (
        <>
          <span>🔑</span>
          Connect BridgeKey
        </>
      )}
    </button>
  );
}
