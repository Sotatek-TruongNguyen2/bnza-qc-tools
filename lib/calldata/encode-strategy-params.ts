import { encodeAbiParameters, encodeFunctionData, type Hex } from 'viem'
import { resolveBotIdBytes32 } from '@/lib/bot/encode-bot-id'
import {
  CALLDATA_VAULT_ADDRESS,
  DEFAULT_DEADLINE_OFFSET_SECONDS,
  DEFAULT_PERFORMANCE_FEE_BPS,
  DEFAULT_REBALANCE_SLIPPAGE_BPS,
  EXECUTE_STRATEGY_ABI,
  REBALANCE_STRATEGY_ADDRESS,
  REDEEM_STRATEGY_ADDRESS,
  ZERO_BYTES32,
} from './constants'
import { defaultWethUsdcSwapPath } from './build-swap-path'

export type CalldataAction = 'close' | 'rebalance'

export type CloseBuilderInput = {
  user: string
  botId: string
  tokenId: string
  performanceFeeBps?: string
  hlPortionId?: string
  amountOutMinimum?: string
  swapPath?: string
  deadlineUnix?: string
  convertPrincipalToUsdc?: boolean
  /** Pool fee for default WETH→USDC path when swapPath empty. */
  defaultSwapFee?: string
}

export type RebalanceBuilderInput = {
  user: string
  botId: string
  tokenId: string
  newTickLower: string
  newTickUpper: string
  slippageBps?: string
  amountOutMinimum?: string
  deadlineUnix?: string
}

export type ExecuteStrategyFields = {
  vault: string
  strategy: string
  strategyLabel: string
  user: string
  botIdBytes32: string
  params: Hex
  /** Full executeStrategy calldata (optional paste into custom data). */
  executeStrategyCalldata: Hex
  deadlineUnix: string
  decoded: Record<string, string | boolean | number>
  warnings: string[]
}

function makeDeadline(offsetSeconds = DEFAULT_DEADLINE_OFFSET_SECONDS): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + offsetSeconds)
}

function requireAddress(label: string, value: string): `0x${string}` {
  const v = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
    throw new Error(`${label} must be a 0x address (40 hex chars)`)
  }
  return v as `0x${string}`
}

function requireTokenId(value: string): bigint {
  const v = value.trim()
  if (!/^\d+$/.test(v)) throw new Error('tokenId must be a positive integer')
  return BigInt(v)
}

function parseBigIntField(label: string, value: string | undefined, fallback: bigint): bigint {
  if (value == null || value.trim() === '') return fallback
  const v = value.trim()
  if (!/^\d+$/.test(v)) throw new Error(`${label} must be a non-negative integer`)
  return BigInt(v)
}

function parseIntField(label: string, value: string): number {
  const v = value.trim()
  if (!/^-?\d+$/.test(v)) throw new Error(`${label} must be an integer`)
  return Number(v)
}

function encodeRedeemParams(
  tokenId: bigint,
  params: {
    performanceFeeBps: bigint
    hlPortionId: Hex
    amountOutMinimum: bigint
    swapPath: Hex
    deadline: bigint
    convertPrincipalToUsdc: boolean
  },
): Hex {
  return encodeAbiParameters(
    [
      { name: 'tokenId', type: 'uint256' },
      {
        name: 'redeemParams',
        type: 'tuple',
        components: [
          { name: 'performanceFeeBps', type: 'uint256' },
          { name: 'hlPortionId', type: 'bytes32' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'swapPath', type: 'bytes' },
          { name: 'deadline', type: 'uint256' },
          { name: 'convertPrincipalToUsdc', type: 'bool' },
        ],
      },
    ],
    [tokenId, params],
  )
}

function encodeRebalanceParams(
  oldTokenId: bigint,
  params: {
    newTickLower: number
    newTickUpper: number
    slippageBps: bigint
    amountOutMinimum: bigint
    deadline: bigint
  },
): Hex {
  return encodeAbiParameters(
    [
      { name: 'oldTokenId', type: 'uint256' },
      {
        name: 'rebalanceParams',
        type: 'tuple',
        components: [
          { name: 'newTickLower', type: 'int24' },
          { name: 'newTickUpper', type: 'int24' },
          { name: 'slippageBps', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    [oldTokenId, params],
  )
}

function wrapExecute(
  strategy: `0x${string}`,
  strategyLabel: string,
  user: `0x${string}`,
  botIdBytes32: Hex,
  params: Hex,
  deadline: bigint,
  decoded: Record<string, string | boolean | number>,
  warnings: string[],
): ExecuteStrategyFields {
  const executeStrategyCalldata = encodeFunctionData({
    abi: EXECUTE_STRATEGY_ABI,
    functionName: 'executeStrategy',
    args: [strategy, user, botIdBytes32, params],
  })

  return {
    vault: CALLDATA_VAULT_ADDRESS,
    strategy,
    strategyLabel,
    user,
    botIdBytes32,
    params,
    executeStrategyCalldata,
    deadlineUnix: deadline.toString(),
    decoded,
    warnings,
  }
}

export function buildCloseExecuteStrategy(input: CloseBuilderInput): ExecuteStrategyFields {
  const warnings: string[] = []
  const user = requireAddress('user', input.user)
  const botIdBytes32 = resolveBotIdBytes32(input.botId)
  const tokenId = requireTokenId(input.tokenId)

  const performanceFeeBps = parseBigIntField(
    'performanceFeeBps',
    input.performanceFeeBps,
    BigInt(DEFAULT_PERFORMANCE_FEE_BPS),
  )
  const hlPortionId = (input.hlPortionId?.trim() || ZERO_BYTES32) as Hex
  if (!/^0x[a-fA-F0-9]{64}$/.test(hlPortionId)) {
    throw new Error('hlPortionId must be bytes32 (0x + 64 hex)')
  }

  const amountOutMinimum = parseBigIntField('amountOutMinimum', input.amountOutMinimum, 0n)
  if (amountOutMinimum === 0n) {
    warnings.push(
      'amountOutMinimum is 0 — close can accept any swap output (slippage risk). Prefer a non-zero floor for QC.',
    )
  }

  let swapPath = (input.swapPath?.trim() || '') as Hex
  if (!swapPath || swapPath === '0x') {
    const fee = Number(input.defaultSwapFee?.trim() || '500')
    swapPath = defaultWethUsdcSwapPath(fee)
    warnings.push(
      `swapPath was empty — filled default WETH→USDC single-hop (fee ${fee}). Override if the LP pair differs.`,
    )
  } else if (!/^0x[a-fA-F0-9]*$/.test(swapPath) || swapPath.length % 2 !== 0) {
    throw new Error('swapPath must be even-length hex bytes')
  }

  const deadline =
    input.deadlineUnix?.trim()
      ? parseBigIntField('deadline', input.deadlineUnix, makeDeadline())
      : makeDeadline()

  const convertPrincipalToUsdc = input.convertPrincipalToUsdc !== false

  const params = encodeRedeemParams(tokenId, {
    performanceFeeBps,
    hlPortionId,
    amountOutMinimum,
    swapPath,
    deadline,
    convertPrincipalToUsdc,
  })

  return wrapExecute(
    REDEEM_STRATEGY_ADDRESS,
    'RedeemStrategyV1 (close)',
    user,
    botIdBytes32,
    params,
    deadline,
    {
      tokenId: tokenId.toString(),
      performanceFeeBps: performanceFeeBps.toString(),
      hlPortionId,
      amountOutMinimum: amountOutMinimum.toString(),
      swapPath,
      deadline: deadline.toString(),
      convertPrincipalToUsdc,
    },
    warnings,
  )
}

export function buildRebalanceExecuteStrategy(input: RebalanceBuilderInput): ExecuteStrategyFields {
  const warnings: string[] = []
  const user = requireAddress('user', input.user)
  const botIdBytes32 = resolveBotIdBytes32(input.botId)
  const tokenId = requireTokenId(input.tokenId)
  const newTickLower = parseIntField('newTickLower', input.newTickLower)
  const newTickUpper = parseIntField('newTickUpper', input.newTickUpper)
  if (newTickLower >= newTickUpper) {
    throw new Error('newTickLower must be < newTickUpper')
  }

  const slippageBps = parseBigIntField(
    'slippageBps',
    input.slippageBps,
    BigInt(DEFAULT_REBALANCE_SLIPPAGE_BPS),
  )
  const amountOutMinimum = parseBigIntField('amountOutMinimum', input.amountOutMinimum, 0n)
  if (amountOutMinimum === 0n) {
    warnings.push(
      'amountOutMinimum is 0 — rebalance internal swap has no output floor. OK for smoke tests; set a floor for careful QC.',
    )
  }

  const deadline =
    input.deadlineUnix?.trim()
      ? parseBigIntField('deadline', input.deadlineUnix, makeDeadline())
      : makeDeadline()

  const params = encodeRebalanceParams(tokenId, {
    newTickLower,
    newTickUpper,
    slippageBps,
    amountOutMinimum,
    deadline,
  })

  return wrapExecute(
    REBALANCE_STRATEGY_ADDRESS,
    'RebalanceStrategyV1',
    user,
    botIdBytes32,
    params,
    deadline,
    {
      oldTokenId: tokenId.toString(),
      newTickLower,
      newTickUpper,
      slippageBps: slippageBps.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      deadline: deadline.toString(),
    },
    warnings,
  )
}
