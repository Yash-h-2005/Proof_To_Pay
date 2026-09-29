import { NavLink } from 'react-router-dom';
import type { WalletState } from '../blockchain/wallet';
import NetworkBadge from './NetworkBadge';
import WalletButton from './WalletButton';
import WalletInfo from './WalletInfo';

interface NavbarProps {
  wallet: WalletState;
  onWalletConnect: (state: WalletState) => void;
  onWalletDisconnect: () => void;
  onWalletError: (msg: string) => void;
}

export default function Navbar({
  wallet,
  onWalletConnect,
  onWalletDisconnect,
  onWalletError,
}: NavbarProps) {
  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar__inner">
        {/* Logo */}
        <NavLink to="/" className="navbar__logo">
          <div className="navbar__logo-icon">⚙️</div>
          <span>Proof-to-Pay</span>
        </NavLink>

        {/* Navigation */}
        <div className="navbar__nav">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `navbar__link${isActive ? ' navbar__link--active' : ''}`
            }
            end
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `navbar__link${isActive ? ' navbar__link--active' : ''}`
            }
          >
            Create Task
          </NavLink>
        </div>

        {/* Right side */}
        <div className="navbar__right">
          <NetworkBadge
            chainId={wallet.chainId}
            connected={wallet.isConnected}
          />

          {wallet.isConnected ? (
            <WalletInfo wallet={wallet} onDisconnect={onWalletDisconnect} />
          ) : (
            <WalletButton
              wallet={wallet}
              onConnect={onWalletConnect}
              onError={onWalletError}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
