# Phase 3 — MST Testnet Deployment & Live Verification

## 1. Pre-Deployment Checks
- **Security Check**: Verified that `.env` is ignored by `.gitignore` and no private keys or seed phrases were committed.
- **RPC Availability**: Checked `https://testnetrpc.mstblockchain.com` via read-only `eth_chainId` and `eth_blockNumber`.
- **Live Chain ID**: Re-confirmed as `91562037` (`0x5752035`).

---

## 2. Wallet Used
- **Wallet Name**: Yash (BridgeKey)
- **Deployer Public Address**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302`
- **Initial Testnet Balance**: `10.0 tMSTC` (Verified via JSON-RPC query `eth_getBalance`)
- **Post-Execution Balance**: `9.997528603 tMSTC`

---

## 3. Network Configuration
- **Network Name**: MST Testnet
- **Chain ID**: `91562037`
- **RPC Endpoint**: `https://testnetrpc.mstblockchain.com`
- **Explorer**: `https://testnet.mstscan.com`
- **Hardhat Network**: `mstTestnet` in `hardhat.config.js`

---

## 4. Contract Compilation & Test Suite
- **Compiler**: Solidity `0.8.20`
- **Compilation Output**: 5 Solidity files compiled successfully (`evm target: paris`).
- **Test Results**: All 17 automated tests passing in `test/ProofToPay.js`.

---

## 5. Deployment
- **Command**: `npx hardhat run scripts/deploy.js --network mstTestnet`
- **Designated Verifier**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302` (Deployer designated for bootstrap MVP testing)

---

## 6. Contract Address
- **ProofToPay Address**: `0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`

---

## 7. Deployment Transaction
- **Transaction Hash**: `0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c`
- **Block Number**: `5789102`
- **Gas Used**: `2,206,142`

---

## 8. First Contract Interaction
- **Function Called**: `createTask("T001", 100 MSTC, "P01", "Zone A", "Zone B")`
- **Script Used**: `scripts/createTask.js`
- **Caller**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302`

---

## 9. Transaction Hash (Interaction)
- **Transaction Hash**: `0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f`
- **Block Number**: `5789120`
- **Gas Used**: `265,255`

---

## 10. MSTScan Verification
Both transactions have been independently verified via MSTScan Blockscout API:
- **Contract on MSTScan**: [https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347](https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
- **Deployment Tx on MSTScan**: [https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c](https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c)
- **Task Creation Tx on MSTScan**: [https://testnet.mstscan.com/tx/0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f](https://testnet.mstscan.com/tx/0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f)
- **On-Chain State Verified**: Directly called `getTask("T001")` via JSON-RPC, verifying `taskId="T001"`, `packageId="P01"`, `source="Zone A"`, `destination="Zone B"`, `state=0 (CREATED)`.

---

## 11. Problems Encountered
- **Chain ID Validation**: Some external documentation referenced chain ID `4545`, but the live RPC requires `91562037`.

---

## 12. Resolution
- Live JSON-RPC queries confirmed `eth_chainId: 0x5752035` (`91562037`). Configuring Hardhat with `91562037` allowed transactions to be accepted, mined, and confirmed cleanly without transaction rejection.
