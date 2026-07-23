/** Base mainnet RedemptionQueue proxy — same as Addresses tab. */
export const REDEMPTION_QUEUE_ADDRESS =
  '0x7b50B1F6ee14919b6d967EBA4D57d0c67Fa841a0' as const

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
  {
    type: 'event',
    name: 'RequestFulfilled',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'hlPortionId', type: 'bytes32', indexed: true },
      { name: 'operator', type: 'address', indexed: false },
      { name: 'botId', type: 'bytes32', indexed: false },
      { name: 'positionId', type: 'uint256', indexed: false },
      { name: 'wlRecipient', type: 'address', indexed: false },
      { name: 'tokens', type: 'address[]', indexed: false },
      { name: 'principalAmounts', type: 'uint256[]', indexed: false },
      { name: 'profitAmounts', type: 'uint256[]', indexed: false },
    ],
  },
] as const

export const BASESCAN_QUEUE = `https://basescan.org/address/${REDEMPTION_QUEUE_ADDRESS}`

/** ~7 days on Base (~2s blocks) for recent fulfill stats. */
export const FULFILL_LOOKBACK_BLOCKS = 300_000n

/** Stay under Base public RPC’s 10_000 inclusive getLogs range. */
export const LOGS_CHUNK_BLOCKS = 9_999n
