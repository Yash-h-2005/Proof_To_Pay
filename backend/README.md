# Proof-to-Pay Backend

Node.js + TypeScript Express API gateway connecting the frontend to the **ProofToPay** smart contract on MST Blockchain.

## Architecture

```
Frontend (React + BridgeKey)
         ↓
Backend API (Express, port 3001)
         ↓
MST Testnet RPC (ethers.js provider)
         ↓
ProofToPay Smart Contract
         ↓
         (future)
         ↓
Robot Service → NEURICK / Simulator
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in your values in .env
npm run dev
```

## API Endpoints

### Implemented (Read-Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/blockchain` | Live MST Testnet connection info |
| GET | `/api/tasks` | All tasks from deployed contract |
| GET | `/api/tasks/:taskId` | Single task from deployed contract |
| GET | `/api/robot/:robotId/status` | Robot connectivity status |

### Proof Hash Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks/:id/proof` | Generate keccak256 hash from sensor evidence |

### Write Stubs (BridgeKey — Phase 5)

| Method | Endpoint | Signs Via | Status |
|--------|----------|-----------|--------|
| POST | `/api/tasks` | BridgeKey | Stub |
| POST | `/api/tasks/:id/fund` | BridgeKey | Stub |
| POST | `/api/tasks/:id/assign` | BridgeKey | Stub |
| POST | `/api/tasks/:id/start` | Robot wallet | Stub |
| POST | `/api/tasks/:id/verify` | Verifier wallet | Stub |
| POST | `/api/tasks/:id/release` | Any / BridgeKey | Stub |
| POST | `/api/tasks/:id/refund` | BridgeKey | Stub |

## Testing

```bash
npm test
```
