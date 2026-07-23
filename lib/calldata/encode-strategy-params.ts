import { encodeAbiParameters, encodeFunctionData, type Hex } from 'viem'
import { resolveBotIdBytes32 } from '@/lib/bot/encode-bot-id'
import {
  CALLDATA_VAULT_ADDRESS,
  COLLECT_FEE_STRATEGY_ADDRESS,
  DEFAULT_CCTP_DESTINATION_DOMAIN,
  DEFAULT_DEADLINE_OFFSET_SECONDS,
  DEFAULT_MIN_EARNED_USDC,
  DEFAULT_OPEN_BNZA_TOKEN,
  DEFAULT_OPEN_LP_POOL_FEE,
  DEFAULT_OPEN_PAIRED_TOKEN,
  DEFAULT_OPERATION_FEE_BPS,
  DEFAULT_PERFORMANCE_FEE_BPS,
  DEFAULT_REBALANCE_SLIPPAGE_BPS,
  EXECUTE_STRATEGY_ABI,
  OPEN_STRATEGY_ADDRESS,
  REBALANCE_STRATEGY_ADDRESS,
  REDEEM_STRATEGY_ADDRESS,
  ZERO_BYTES32,
} from './constants'
import { defaultWethUsdcSwapPath } from './build-swap-path'

export type CalldataAction = 'open' | 'close' | 'rebalance' | 'collect'

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

export type OpenBuilderInput = {
  user: string
  botId: string
  pairedToken?: string
  bnzaToken?: string
  lpPoolFee?: string
  bnzaBuybackFee?: string
  tickLower: string
  tickUpper: string
  totalUsdc: string
  bnzaBuybackUsdc?: string
  swapAmount?: string
  amountOutMinimum?: string
  hlPortionUsdc?: string
  agentWallet: string
  bridgeHlPortionViaCctp?: boolean
  cctpDestinationDomain?: string
  deadlineUnix?: string
}

export type CollectBuilderInput = {
  user: string
  botId: string
  tokenId: string
  /** When true (default), encode shorthand abi.encode(tokenId) → SC defaults. */
  useDefaults?: boolean
  operationFeeBps?: string
  performanceFeeBps?: string
  minEarnedUsdc?: string
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

function encodeOpenParams(params: {
  pairedToken: `0x${string}`
  bnzaToken: `0x${string}`
  lpPoolFee: number
  bnzaBuybackFee: number
  tickLower: number
  tickUpper: number
  totalUsdc: bigint
  bnzaBuybackUsdc: bigint
  swapAmount: bigint
  amountOutMinimum: bigint
  hlPortionUsdc: bigint
  agentWallet: `0x${string}`
  bridgeHlPortionViaCctp: boolean
  cctpDestinationDomain: number
  deadline: bigint
}): Hex {
  return encodeAbiParameters(
    [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'pairedToken', type: 'address' },
          { name: 'bnzaToken', type: 'address' },
          { name: 'lpPoolFee', type: 'uint24' },
          { name: 'bnzaBuybackFee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'totalUsdc', type: 'uint256' },
          { name: 'bnzaBuybackUsdc', type: 'uint256' },
          { name: 'swapAmount', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'hlPortionUsdc', type: 'uint256' },
          { name: 'agentWallet', type: 'address' },
          { name: 'bridgeHlPortionViaCctp', type: 'bool' },
          { name: 'cctpDestinationDomain', type: 'uint32' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    [params],
  )
}

function encodeCollectParamsShorthand(tokenId: bigint): Hex {
  return encodeAbiParameters([{ name: 'tokenId', type: 'uint256' }], [tokenId])
}

function encodeCollectParamsFull(
  tokenId: bigint,
  params: {
    operationFeeBps: bigint
    performanceFeeBps: bigint
    minEarnedUsdc: bigint
  },
): Hex {
  return encodeAbiParameters(
    [
      { name: 'tokenId', type: 'uint256' },
      {
        name: 'collectParams',
        type: 'tuple',
        components: [
          { name: 'operationFeeBps', type: 'uint256' },
          { name: 'performanceFeeBps', type: 'uint256' },
          { name: 'minEarnedUsdc', type: 'uint256' },
        ],
      },
    ],
    [tokenId, params],
  )
}

function parseUint24Field(label: string, value: string | undefined, fallback: number): number {
  const raw = value == null || value.trim() === '' ? String(fallback) : value.trim()
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a non-negative integer`)
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 0xffffff) {
    throw new Error(`${label} must be a uint24`)
  }
  return n
}

function parseUint32Field(label: string, value: string | undefined, fallback: number): number {
  const raw = value == null || value.trim() === '' ? String(fallback) : value.trim()
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a non-negative integer`)
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new Error(`${label} must be a uint32`)
  }
  return n
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

export function buildOpenExecuteStrategy(input: OpenBuilderInput): ExecuteStrategyFields {
  const warnings: string[] = []
  const user = requireAddress('user', input.user)
  const botIdBytes32 = resolveBotIdBytes32(input.botId)
  const pairedToken = requireAddress('pairedToken', input.pairedToken || DEFAULT_OPEN_PAIRED_TOKEN)
  const bnzaToken = requireAddress('bnzaToken', input.bnzaToken || DEFAULT_OPEN_BNZA_TOKEN)
  const agentWallet = requireAddress('agentWallet', input.agentWallet)

  const tickLower = parseIntField('tickLower', input.tickLower)
  const tickUpper = parseIntField('tickUpper', input.tickUpper)
  if (tickLower >= tickUpper) {
    throw new Error('tickLower must be < tickUpper')
  }

  const lpPoolFee = parseUint24Field('lpPoolFee', input.lpPoolFee, DEFAULT_OPEN_LP_POOL_FEE)
  const bnzaBuybackFee = parseUint24Field('bnzaBuybackFee', input.bnzaBuybackFee, 0)
  const totalUsdc = parseBigIntField('totalUsdc', input.totalUsdc, 0n)
  if (totalUsdc === 0n) {
    throw new Error('totalUsdc must be > 0 (USDC raw, 6 decimals)')
  }

  const bnzaBuybackUsdc = parseBigIntField('bnzaBuybackUsdc', input.bnzaBuybackUsdc, 0n)
  const swapAmount = parseBigIntField('swapAmount', input.swapAmount, 0n)
  const amountOutMinimum = parseBigIntField('amountOutMinimum', input.amountOutMinimum, 0n)
  const hlPortionUsdc = parseBigIntField('hlPortionUsdc', input.hlPortionUsdc, 0n)
  if (amountOutMinimum === 0n && swapAmount > 0n) {
    warnings.push(
      'amountOutMinimum is 0 while swapAmount > 0 — open-side swap has no output floor.',
    )
  }
  if (hlPortionUsdc === 0n) {
    warnings.push('hlPortionUsdc is 0 — LP-only open (no HL hedge USDC).')
  }

  const bridgeHlPortionViaCctp = input.bridgeHlPortionViaCctp !== false
  const cctpDestinationDomain = parseUint32Field(
    'cctpDestinationDomain',
    input.cctpDestinationDomain,
    DEFAULT_CCTP_DESTINATION_DOMAIN,
  )

  const deadline =
    input.deadlineUnix?.trim()
      ? parseBigIntField('deadline', input.deadlineUnix, makeDeadline())
      : makeDeadline()

  warnings.push(
    'Open sim needs idle vault USDC ≥ totalUsdc for this user/botId, plus a valid agentWallet.',
  )

  const openParams = {
    pairedToken,
    bnzaToken,
    lpPoolFee,
    bnzaBuybackFee,
    tickLower,
    tickUpper,
    totalUsdc,
    bnzaBuybackUsdc,
    swapAmount,
    amountOutMinimum,
    hlPortionUsdc,
    agentWallet,
    bridgeHlPortionViaCctp,
    cctpDestinationDomain,
    deadline,
  }

  return wrapExecute(
    OPEN_STRATEGY_ADDRESS,
    'OpenPositionStrategyV1',
    user,
    botIdBytes32,
    encodeOpenParams(openParams),
    deadline,
    {
      pairedToken,
      bnzaToken,
      lpPoolFee,
      bnzaBuybackFee,
      tickLower,
      tickUpper,
      totalUsdc: totalUsdc.toString(),
      bnzaBuybackUsdc: bnzaBuybackUsdc.toString(),
      swapAmount: swapAmount.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      hlPortionUsdc: hlPortionUsdc.toString(),
      agentWallet,
      bridgeHlPortionViaCctp,
      cctpDestinationDomain,
      deadline: deadline.toString(),
    },
    warnings,
  )
}

export function buildCollectExecuteStrategy(input: CollectBuilderInput): ExecuteStrategyFields {
  const warnings: string[] = []
  const user = requireAddress('user', input.user)
  const botIdBytes32 = resolveBotIdBytes32(input.botId)
  const tokenId = requireTokenId(input.tokenId)
  const useDefaults = input.useDefaults !== false

  let params: Hex
  let decoded: Record<string, string | boolean | number>

  if (useDefaults) {
    params = encodeCollectParamsShorthand(tokenId)
    decoded = {
      tokenId: tokenId.toString(),
      encoding: 'shorthand (tokenId only)',
      operationFeeBps: String(DEFAULT_OPERATION_FEE_BPS),
      performanceFeeBps: String(DEFAULT_PERFORMANCE_FEE_BPS),
      minEarnedUsdc: String(DEFAULT_MIN_EARNED_USDC),
    }
    warnings.push(
      'Shorthand params — SC applies LpFeeOps defaults (op 50 bps, PF 3000 bps, min earned $10).',
    )
  } else {
    const operationFeeBps = parseBigIntField(
      'operationFeeBps',
      input.operationFeeBps,
      BigInt(DEFAULT_OPERATION_FEE_BPS),
    )
    const performanceFeeBps = parseBigIntField(
      'performanceFeeBps',
      input.performanceFeeBps,
      BigInt(DEFAULT_PERFORMANCE_FEE_BPS),
    )
    const minEarnedUsdc = parseBigIntField(
      'minEarnedUsdc',
      input.minEarnedUsdc,
      BigInt(DEFAULT_MIN_EARNED_USDC),
    )
    params = encodeCollectParamsFull(tokenId, {
      operationFeeBps,
      performanceFeeBps,
      minEarnedUsdc,
    })
    decoded = {
      tokenId: tokenId.toString(),
      encoding: 'full (tokenId + CollectFeeParams)',
      operationFeeBps: operationFeeBps.toString(),
      performanceFeeBps: performanceFeeBps.toString(),
      minEarnedUsdc: minEarnedUsdc.toString(),
    }
  }

  // Collect has no deadline in params; keep display field for UI consistency.
  const deadline = makeDeadline()

  return wrapExecute(
    COLLECT_FEE_STRATEGY_ADDRESS,
    'CollectFeeStrategyV1',
    user,
    botIdBytes32,
    params,
    deadline,
    decoded,
    warnings,
  )
}
