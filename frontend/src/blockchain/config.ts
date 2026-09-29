/**
 * MST Blockchain & ProofToPay contract configuration.
 * All values sourced from Vite environment variables (VITE_ prefix).
 * Never put private keys or backend secrets in this file.
 */

export const MST_TESTNET_CHAIN_ID = 91562037;
export const MST_TESTNET_CHAIN_ID_HEX = '0x5752035';

export const MST_RPC_URL =
  import.meta.env.VITE_MST_RPC_URL ?? 'https://testnetrpc.mstblockchain.com';

export const MST_EXPLORER_URL =
  import.meta.env.VITE_MST_EXPLORER_URL ?? 'https://testnet.mstscan.com';

export const PROOF_TO_PAY_CONTRACT =
  import.meta.env.VITE_PROOF_TO_PAY_CONTRACT ??
  '0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347';

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

/** MST Testnet chain params — used when requesting wallet to add/switch network */
export const MST_TESTNET_CHAIN_PARAMS = {
  chainId: MST_TESTNET_CHAIN_ID_HEX,
  chainName: 'MST Testnet',
  nativeCurrency: {
    name: 'MSTC',
    symbol: 'MSTC',
    decimals: 18,
  },
  rpcUrls: [MST_RPC_URL],
  blockExplorerUrls: [MST_EXPLORER_URL],
} as const;

/** Known real transactions for reference */
export const KNOWN_TXS = {
  deployment:
    '0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c',
  createTask:
    '0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f',
} as const;

/** Designated autonomous robot for deliveries */
export const DEFAULT_ROBOT = {
  id: 'NR-001',
  address: '0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302',
} as const;

