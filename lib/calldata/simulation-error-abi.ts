/**
 * Custom errors for decoding vault.executeStrategy simulation reverts.
 * Includes EXBOT Errors.sol + common OpenZeppelin AccessControl.
 */
export const SIMULATION_ERROR_ABI = [
  // EXBOT Errors.sol
  { type: 'error', name: 'Unauthorized', inputs: [{ name: 'caller', type: 'address' }] },
  { type: 'error', name: 'NotMultiSig', inputs: [{ name: 'caller', type: 'address' }] },
  { type: 'error', name: 'StrategyNotAllowed', inputs: [{ name: 'strategy', type: 'address' }] },
  { type: 'error', name: 'VaultStrategyExecUnsupportedOperation', inputs: [] },
  { type: 'error', name: 'VaultStrategyExecStaticOperationViolated', inputs: [] },
  {
    type: 'error',
    name: 'VaultStrategyFailedToExec',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
    ],
  },
  { type: 'error', name: 'PositionNotFound', inputs: [{ name: 'tokenId', type: 'uint256' }] },
  {
    type: 'error',
    name: 'PositionOwnerMismatch',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'expected', type: 'address' },
      { name: 'actual', type: 'address' },
    ],
  },
  { type: 'error', name: 'NftOwnershipLost', inputs: [{ name: 'tokenId', type: 'uint256' }] },
  { type: 'error', name: 'VaultPaused', inputs: [] },
  { type: 'error', name: 'UserAlreadyHasPosition', inputs: [{ name: 'user', type: 'address' }] },
  { type: 'error', name: 'NoActivePosition', inputs: [{ name: 'user', type: 'address' }] },
  { type: 'error', name: 'CapitalAlreadyDeployed', inputs: [{ name: 'user', type: 'address' }] },
  {
    type: 'error',
    name: 'PositionNotTrackedForUser',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'SlippageExceeded',
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'ZeroLiquidity', inputs: [] },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      { name: 'available', type: 'uint256' },
      { name: 'required', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'InsufficientWithdrawTokens', inputs: [] },
  {
    type: 'error',
    name: 'RedemptionAlreadyFulfilled',
    inputs: [{ name: 'requestId', type: 'uint256' }],
  },
  { type: 'error', name: 'RedemptionNotFound', inputs: [{ name: 'requestId', type: 'uint256' }] },
  { type: 'error', name: 'RedemptionQueueEmpty', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'SameAddress', inputs: [] },
  {
    type: 'error',
    name: 'ActiveTokenIdMismatch',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'expected', type: 'uint256' },
      { name: 'actual', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'InvalidBotId', inputs: [] },
  {
    type: 'error',
    name: 'BotIdMismatch',
    inputs: [
      { name: 'expected', type: 'bytes32' },
      { name: 'actual', type: 'bytes32' },
    ],
  },
  { type: 'error', name: 'InvalidParameter', inputs: [] },
  { type: 'error', name: 'NotVault', inputs: [] },
  { type: 'error', name: 'NotOperator', inputs: [] },
  { type: 'error', name: 'FeeRecipientNotSet', inputs: [] },
  {
    type: 'error',
    name: 'NothingToRecover',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'botId', type: 'bytes32' },
    ],
  },
  {
    type: 'error',
    name: 'DepositTokenNotAllowed',
    inputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'error',
    name: 'DepositTokenMismatch',
    inputs: [
      { name: 'expected', type: 'address' },
      { name: 'actual', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidScalePercentage',
    inputs: [{ name: 'scaleDownBps', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'ScaleWouldZeroPosition',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  { type: 'error', name: 'CctpNotConfigured', inputs: [] },

  // OpenZeppelin AccessControl
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  {
    type: 'error',
    name: 'AccessControlBadConfirmation',
    inputs: [],
  },

  // Generic Solidity
  { type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] },
  { type: 'error', name: 'Panic', inputs: [{ name: 'code', type: 'uint256' }] },
] as const
