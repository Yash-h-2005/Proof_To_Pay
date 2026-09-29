import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { WalletState } from './blockchain/wallet';
import { INITIAL_STATE, watchWalletEvents, getBalance } from './blockchain/wallet';
import { MST_TESTNET_CHAIN_ID } from './blockchain/config';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CreateTask from './pages/CreateTask';
import TaskDetails from './pages/TaskDetails';

export default function App() {
  const [wallet, setWallet] = useState<WalletState>(INITIAL_STATE);
  const [walletError, setWalletError] = useState<string | null>(null);

  const handleWalletConnect = (state: WalletState) => {
    setWallet(state);
    setWalletError(null);
  };

  const handleWalletDisconnect = () => {
    setWallet(INITIAL_STATE);
    setWalletError(null);
  };

  const handleWalletError = (msg: string) => {
    setWalletError(msg);
  };

  // Listen for wallet account/chain changes
  useEffect(() => {
    if (!wallet.isConnected) return;

    const cleanup = watchWalletEvents(
      async (address) => {
        if (!address) {
          setWallet(INITIAL_STATE);
          return;
        }
        const balance = await getBalance(address);
        setWallet((prev) => ({
          ...prev,
          address,
          balanceMSTC: balance,
        }));
      },
      (chainId) => {
        setWallet((prev) => ({
          ...prev,
          chainId,
          isCorrectNetwork: chainId === MST_TESTNET_CHAIN_ID,
        }));
      }
    );

    return cleanup;
  }, [wallet.isConnected]);

  return (
    <BrowserRouter>
      <Navbar
        wallet={wallet}
        onWalletConnect={handleWalletConnect}
        onWalletDisconnect={handleWalletDisconnect}
        onWalletError={handleWalletError}
      />

      {/* Global wallet error banner */}
      {walletError && (
        <div
          className="alert alert--error"
          style={{
            position: 'fixed',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            maxWidth: '560px',
            width: 'calc(100% - 32px)',
            boxShadow: 'var(--shadow-lg)',
          }}
          role="alert"
        >
          <span>⚠️</span>
          <span style={{ flex: 1 }}>{walletError}</span>
          <button
            onClick={() => setWalletError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Dashboard wallet={wallet} />} />
        <Route
          path="/create"
          element={<CreateTask wallet={wallet} onWalletError={handleWalletError} />}
        />
        <Route
          path="/task/:taskId"
          element={
            <TaskDetails
              wallet={wallet}
              onWalletConnect={handleWalletConnect}
              onWalletError={handleWalletError}
            />
          }
        />
        <Route
          path="*"
          element={
            <div className="main-content">
              <div className="page-container">
                <div className="empty-state" style={{ marginTop: '48px' }}>
                  <div className="empty-state__icon">404</div>
                  <div className="empty-state__title">Page not found</div>
                  <div className="empty-state__desc">
                    <a href="/" style={{ color: 'var(--orange-500)' }}>Return to Dashboard</a>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
