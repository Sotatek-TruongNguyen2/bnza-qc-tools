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

export const BASESCAN_QUEUE = `https://basescan.org/address/${REDEMPTION_QUEUE_ADDRESS}`
