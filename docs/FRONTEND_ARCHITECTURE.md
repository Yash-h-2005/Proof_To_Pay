# Frontend Architecture

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router DOM v6
- **Blockchain**: ethers.js v6
- **Tests**: Vitest + Testing Library

---

## Directory Structure

```
frontend/src/
├── blockchain/
│   ├── abi.ts          # ProofToPay ABI (from Hardhat artifact)
│   ├── config.ts       # MST Testnet constants + contract address
│   ├── contract.ts     # Read/write contract interactions
│   └── wallet.ts       # BridgeKey wallet abstraction
├── components/
│   ├── LoadingState.tsx
│   ├── Navbar.tsx
│   ├── NetworkBadge.tsx
│   ├── TaskCard.tsx
│   ├── TaskStatus.tsx
│   ├── TransactionLink.tsx
│   ├── WalletButton.tsx
│   └── WalletInfo.tsx
├── pages/
│   ├── CreateTask.tsx
│   ├── Dashboard.tsx
│   └── TaskDetails.tsx
├── services/
│   └── api.ts          # Backend API service (Phase 4 gateway)
├── types/
│   └── task.ts         # TypeScript types + TaskState enum
├── test/
│   ├── setup.ts
│   └── components.test.tsx
├── App.tsx
├── main.tsx
└── index.css
```

---

## Wallet Integration (BridgeKey)

BridgeKey is EVM-compatible and injects `window.ethereum` following EIP-1193, exactly like MetaMask.

**We do NOT use any undocumented BridgeKey-specific SDK methods.** Instead, we use the standard `window.ethereum` interface.

### Wallet Flow

```
User clicks "Connect BridgeKey"
        ↓
isWalletInstalled()
  → checks window.ethereum !== undefined
        ↓
connectWallet()
  → eth_requestAccounts   (triggers wallet popup)
  → eth_chainId           (detect current chain)
  → wallet_switchEthereumChain  (if not MST Testnet)
  → wallet_addEthereumChain     (if chain not in wallet)
  → eth_getBalance        (get MSTC balance)
        ↓
WalletState stored in App.tsx (React state)
  { address, balanceMSTC, chainId, isConnected, isCorrectNetwork }
        ↓
watchWalletEvents()
  → accountsChanged event → update address + balance
  → chainChanged event → update chainId + isCorrectNetwork
```

### Security

- **No private keys** are ever requested, stored, or transmitted.
- Signing happens inside the user's BridgeKey wallet — not on the server.
- `BACKEND_PRIVATE_KEY` is a backend-only secret — never exposed to frontend.
- All sensitive env vars are server-side only; VITE_ vars are public blockchain config only.

---

## MST Testnet Configuration

| Variable | Value |
|----------|-------|
| Chain ID | 91562037 |
| Chain ID (hex) | 0x5752035 |
| RPC URL | https://testnetrpc.mstblockchain.com |
| Explorer | https://testnet.mstscan.com |
| Contract | 0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347 |

---

## Smart Contract Interaction

### Read Operations (No Wallet Required)

The frontend reads task data directly from MST Testnet using a static `JsonRpcProvider`:

```typescript
const provider = new ethers.JsonRpcProvider(MST_RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
const task = await contract.getTask('T001');
```

### Write Operations (BridgeKey Signed)

Write operations use the user's connected wallet signer:

```typescript
const signer = await getSigner(); // from BridgeKey via window.ethereum
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const tx = await contract.createTask(taskId, rewardWei, packageId, source, destination);
await tx.wait(1); // wait for 1 block confirmation
```

### createTask Signature

```solidity
function createTask(
    string calldata taskId,
    uint256 reward,        // in wei — use ethers.parseEther() to convert MSTC
    string calldata packageId,
    string calldata source,
    string calldata destination
) external
```

---

## Backend API Integration

The Phase 4 backend (port 3001) is used as a proxy to the blockchain:

| Endpoint | Usage |
|----------|-------|
| GET /api/health | Health check |
| GET /api/blockchain | Network info + block number |
| GET /api/tasks | All tasks |
| GET /api/tasks/:id | Single task |
| POST /api/tasks/:id/proof | Generate proof hash |

The frontend also reads directly from the blockchain via `blockchain/contract.ts` for write operations.

---

## Transaction Lifecycle (CreateTask)

```
1. idle           → User fills form
2. preparing      → Validating inputs
3. awaiting-approval → Wallet popup shown to user
4. submitted      → tx.hash available
5. confirming     → waiting for block
6. confirmed      → task is on-chain
     OR
6. failed         → display error to user
```

---

## Environment Variables

Only public blockchain configuration is exposed via `VITE_` vars:

```env
VITE_MST_CHAIN_ID=91562037
VITE_MST_RPC_URL=https://testnetrpc.mstblockchain.com
VITE_MST_EXPLORER_URL=https://testnet.mstscan.com
VITE_PROOF_TO_PAY_CONTRACT=0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347
VITE_BACKEND_URL=http://localhost:3001
```

**Never** put `BACKEND_PRIVATE_KEY` or any sensitive secret in frontend env vars.
