/**
 * Wallet abstraction for BridgeKey / EVM-compatible browser wallet.
 *
 * BridgeKey is EVM-compatible and injects window.ethereum just like MetaMask.
 * We use the standard window.ethereum provider interface — no undocumented SDK.
 *
 * Security: We NEVER request or store private keys. All signing is done by the
 * wallet itself. The frontend only holds the connected address and chain info.
 */

import { ethers } from 'ethers';
import {
  MST_TESTNET_CHAIN_ID,
  MST_TESTNET_CHAIN_ID_HEX,
  MST_TESTNET_CHAIN_PARAMS,
} from './config';

/** Standard EIP-1193 provider interface injected by BridgeKey / MetaMask */
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isBridgeKey?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export interface WalletState {
  address: string | null;
  balanceMSTC: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

const INITIAL_STATE: WalletState = {
  address: null,
  balanceMSTC: null,
  chainId: null,
  isConnected: false,
  isCorrectNetwork: false,
};

/** Returns the injected EIP-1193 provider or null if none is installed */
function getInjectedProvider(): NonNullable<Window['ethereum']> | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

/** Returns true if a browser wallet (BridgeKey or compatible) is installed */
export function isWalletInstalled(): boolean {
  return getInjectedProvider() !== null;
}

/**
 * Connects to the injected browser wallet.
 * - Requests accounts (triggers wallet popup)
 * - Detects current chain
 * - Switches/adds MST Testnet if needed
 * - Returns connected WalletState
 */
export async function connectWallet(): Promise<WalletState> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      'BridgeKey or a compatible browser wallet was not detected. ' +
        'Please install BridgeKey and try again.'
    );
  }

  // Request accounts — triggers wallet popup
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts returned from wallet.');
  }

  const address = accounts[0];

  // Get current chain ID
  const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
  const chainId = parseInt(chainIdHex, 16);

  // Switch to MST Testnet if needed
  if (chainId !== MST_TESTNET_CHAIN_ID) {
    await switchToMSTTestnet();
  }

  // Get balance
  const balanceMSTC = await getBalance(address);

  return {
    address,
    balanceMSTC,
    chainId: MST_TESTNET_CHAIN_ID,
    isConnected: true,
    isCorrectNetwork: true,
  };
}

/**
 * Requests the wallet to switch to MST Testnet.
 * If the network is not yet added to the wallet, adds it first.
 */
export async function switchToMSTTestnet(): Promise<void> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error('No wallet provider detected.');

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MST_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (switchError: unknown) {
    // Error code 4902 = chain not added to wallet yet
    const code = (switchError as { code?: number })?.code;
    if (code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [MST_TESTNET_CHAIN_PARAMS],
        });
      } catch {
        throw new Error(
          'Could not add MST Testnet to your wallet. ' +
            'Please add it manually: Chain ID 91562037, RPC https://testnetrpc.mstblockchain.com'
        );
      }
    } else {
      throw new Error('Please switch your wallet to MST Testnet.');
    }
  }
}

/**
 * Gets the native MSTC balance for an address.
 * Returns formatted string like "100.5" (in MSTC, not wei).
 */
export async function getBalance(address: string): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) return '0.0';

  try {
    const balanceHex = (await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })) as string;
    const balanceWei = BigInt(balanceHex);
    return ethers.formatEther(balanceWei);
  } catch {
    return '0.0';
  }
}

/**
 * Returns an ethers.js BrowserProvider wrapping the injected wallet.
 * Used for creating signers for contract write operations.
 */
export function getBrowserProvider(): ethers.BrowserProvider | null {
  const provider = getInjectedProvider();
  if (!provider) return null;
  // ethers v6: BrowserProvider accepts Eip1193Provider — cast explicitly
  return new ethers.BrowserProvider(provider as ethers.Eip1193Provider);
}

/**
 * Returns a signer from the connected wallet.
 * All transaction signing happens inside the user's wallet — never on the server.
 */
export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  const browserProvider = getBrowserProvider();
  if (!browserProvider) return null;
  return browserProvider.getSigner();
}

/**
 * Registers listeners for account and chain changes.
 * Call this after connecting to keep state in sync.
 */
export function watchWalletEvents(
  onAccountChange: (address: string | null) => void,
  onChainChange: (chainId: number) => void
): () => void {
  const provider = getInjectedProvider();
  if (!provider) return () => {};

  const handleAccounts = (accounts: unknown) => {
    const accs = accounts as string[];
    onAccountChange(accs.length > 0 ? accs[0] : null);
  };

  const handleChain = (chainIdHex: unknown) => {
    onChainChange(parseInt(chainIdHex as string, 16));
  };

  provider.on('accountsChanged', handleAccounts);
  provider.on('chainChanged', handleChain);

  return () => {
    provider.removeListener('accountsChanged', handleAccounts);
    provider.removeListener('chainChanged', handleChain);
  };
}

export { INITIAL_STATE };
