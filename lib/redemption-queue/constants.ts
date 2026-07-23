/** Base mainnet RedemptionQueue proxy — same as Addresses tab. */
export const REDEMPTION_QUEUE_ADDRESS =
  '0x7b50B1F6ee14919b6d967EBA4D57d0c67Fa841a0' as const

/** Views only — pending FIFO is fully enumerable on-chain. */
export const REDEMPTION_QUEUE_ABI = [
  {
    type: 'function',
    name: 'pendingQueueLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextPendingRequestId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'pendingRequestAt',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getRequest',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'requestId', type: 'uint256' },
          { name: 'user', type: 'address' },
          { name: 'botId', type: 'bytes32' },
          { name: 'positionId', type: 'uint256' },
          { name: 'hlPortionId', type: 'bytes32' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'fulfilled', type: 'bool' },
        ],
      },
    ],
  },
] as const

/** Emitted in the redeem/close executeStrategy tx when HL portion is enqueued. */
export const REQUEST_CREATED_EVENT =
  'event RequestCreated(uint256 indexed requestId, address indexed user, bytes32 indexed botId, uint256 positionId, bytes32 hlPortionId)' as const

export const REDEMPTION_CLOSE_TX_LOOKUP_CONCURRENCY = 6

export const BASESCAN_QUEUE = `https://basescan.org/address/${REDEMPTION_QUEUE_ADDRESS}`
