/**
 * ProofToPay ABI — sourced from Hardhat artifact:
 * artifacts/contracts/ProofToPay.sol/ProofToPay.json
 *
 * Deployed contract: 0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347 (MST Testnet)
 * Only functions needed by the frontend are included.
 */
export const PROOF_TO_PAY_ABI = [
  // ── Read Functions ──────────────────────────────────────────────────────────
  {
    inputs: [{ internalType: 'string', name: 'taskId', type: 'string' }],
    name: 'getTask',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'taskId', type: 'string' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'address', name: 'robot', type: 'address' },
          { internalType: 'uint256', name: 'reward', type: 'uint256' },
          { internalType: 'string', name: 'packageId', type: 'string' },
          { internalType: 'string', name: 'source', type: 'string' },
          { internalType: 'string', name: 'destination', type: 'string' },
          { internalType: 'bytes32', name: 'proofHash', type: 'bytes32' },
          { internalType: 'enum ProofToPay.TaskState', name: 'state', type: 'uint8' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'uint256', name: 'proofSubmittedAt', type: 'uint256' },
          { internalType: 'uint256', name: 'verifiedAt', type: 'uint256' },
        ],
        internalType: 'struct ProofToPay.Task',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllTaskIds',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTaskCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifier',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ── Write Functions ─────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: 'string', name: 'taskId', type: 'string' },
      { internalType: 'uint256', name: 'reward', type: 'uint256' },
      { internalType: 'string', name: 'packageId', type: 'string' },
      { internalType: 'string', name: 'source', type: 'string' },
      { internalType: 'string', name: 'destination', type: 'string' },
    ],
    name: 'createTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'taskId', type: 'string' }],
    name: 'fundTask',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'taskId', type: 'string' },
      { internalType: 'address', name: 'robot', type: 'address' },
    ],
    name: 'assignRobot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'taskId', type: 'string' }],
    name: 'startTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'taskId', type: 'string' },
      { internalType: 'bytes32', name: 'proofHash', type: 'bytes32' },
    ],
    name: 'submitProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'taskId', type: 'string' },
      { internalType: 'bool', name: 'success', type: 'bool' },
    ],
    name: 'verifyTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'taskId', type: 'string' }],
    name: 'releasePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'taskId', type: 'string' }],
    name: 'refundTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ── Events ──────────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'taskId', type: 'string' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'reward', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'packageId', type: 'string' },
      { indexed: false, internalType: 'string', name: 'source', type: 'string' },
      { indexed: false, internalType: 'string', name: 'destination', type: 'string' },
    ],
    name: 'TaskCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'taskId', type: 'string' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'TaskFunded',
    type: 'event',
  },
] as const;
