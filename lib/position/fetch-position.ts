import { getAddress } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import {
  CHAIN_ID,
  ERC20_ABI,
  FACTORY_ABI,
  FACTORY_ADDRESS,
  MAX_UINT128,
  NPM_ABI,
  NPM_ADDRESS,
  POOL_ABI,
} from './constants'
import {
  basescanLink,
  feeTierLabel,
  formatPrice,
  formatTokenAmount,
  getAmountsForLiquidity,
  getSqrtRatioAtTick,
  rangeStatus,
  tickToPriceRatio,
} from './format'
import type { PositionResult } from './types'

export async function fetchPosition(
  client: BasePublicClient,
  tokenId: string,
): Promise<PositionResult> {
  const id = BigInt(tokenId)

  const [position, owner] = await Promise.all([
    client.readContract({
      address: NPM_ADDRESS,
      abi: NPM_ABI,
      functionName: 'positions',
      args: [id],
    }),
    client.readContract({
      address: NPM_ADDRESS,
      abi: NPM_ABI,
      functionName: 'ownerOf',
      args: [id],
    }),
  ])

  const [
    nonce,
    operator,
    token0Raw,
    token1Raw,
    fee,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  ] = position

  const token0 = getAddress(token0Raw)
  const token1 = getAddress(token1Raw)

  const poolAddressRaw = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [token0, token1, fee],
  })

  if (poolAddressRaw === '0x0000000000000000000000000000000000000000') {
    throw new Error(`No pool found for ${token0}/${token1} fee=${fee}`)
  }

  const poolAddress = getAddress(poolAddressRaw)

  const [slot0, token0Symbol, token1Symbol, token0Decimals, token1Decimals] =
    await Promise.all([
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'slot0' }),
      client.readContract({ address: token0, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: token1, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: token0, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: token1, abi: ERC20_ABI, functionName: 'decimals' }),
    ])

  const [sqrtPriceX96, currentTick] = slot0

  let uncollected0 = tokensOwed0
  let uncollected1 = tokensOwed1
  let collectSimulation = 'positions().tokensOwed (snapshot)'

  try {
    const { result } = await client.simulateContract({
      address: NPM_ADDRESS,
      abi: NPM_ABI,
      functionName: 'collect',
      args: [
        {
          tokenId: id,
          recipient: getAddress(owner),
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        },
      ],
      account: getAddress(owner),
    })
    uncollected0 = result[0]
    uncollected1 = result[1]
    collectSimulation = 'collect() simulation (includes accrued fees since last touch)'
  } catch {
    // Keep snapshot values if simulation fails.
  }

  const sqrtLower = getSqrtRatioAtTick(Number(tickLower))
  const sqrtUpper = getSqrtRatioAtTick(Number(tickUpper))
  const { amount0, amount1 } = getAmountsForLiquidity(
    sqrtPriceX96,
    sqrtLower,
    sqrtUpper,
    liquidity,
  )

  const dec0 = Number(token0Decimals)
  const dec1 = Number(token1Decimals)

  const priceLower = tickToPriceRatio(Number(tickLower), dec0, dec1)
  const priceUpper = tickToPriceRatio(Number(tickUpper), dec0, dec1)
  const priceCurrent = tickToPriceRatio(Number(currentTick), dec0, dec1)

  const raw = {
    chainId: CHAIN_ID,
    network: 'Base mainnet',
    tokenId,
    owner: getAddress(owner),
    operator: getAddress(operator),
    nonce: nonce.toString(),
    token0,
    token1,
    token0Symbol,
    token1Symbol,
    token0Decimals: dec0,
    token1Decimals: dec1,
    pair: `${token0Symbol}/${token1Symbol}`,
    fee: Number(fee),
    feeLabel: feeTierLabel(Number(fee)),
    tickLower: Number(tickLower),
    tickUpper: Number(tickUpper),
    currentTick: Number(currentTick),
    rangeStatus: rangeStatus(Number(currentTick), Number(tickLower), Number(tickUpper), liquidity),
    liquidity: liquidity.toString(),
    poolAddress,
    sqrtPriceX96: sqrtPriceX96.toString(),
    feeGrowthInside0LastX128: feeGrowthInside0LastX128.toString(),
    feeGrowthInside1LastX128: feeGrowthInside1LastX128.toString(),
    tokensOwed0: tokensOwed0.toString(),
    tokensOwed1: tokensOwed1.toString(),
    uncollectedFees0: uncollected0.toString(),
    uncollectedFees1: uncollected1.toString(),
    uncollectedFeesSource: collectSimulation,
    principalAmount0: amount0.toString(),
    principalAmount1: amount1.toString(),
    priceToken1PerToken0AtLowerTick: priceLower,
    priceToken1PerToken0AtUpperTick: priceUpper,
    priceToken1PerToken0AtCurrentTick: priceCurrent,
    priceToken0PerToken1AtCurrentTick: priceCurrent > 0 ? 1 / priceCurrent : null,
    npmAddress: NPM_ADDRESS,
    factoryAddress: FACTORY_ADDRESS,
    basescan: {
      positionNft: basescanLink(NPM_ADDRESS),
      owner: basescanLink(getAddress(owner)),
      pool: basescanLink(poolAddress),
      token0: basescanLink(token0),
      token1: basescanLink(token1),
    },
  }

  const human = {
    summary: `${token0Symbol}/${token1Symbol} | fee ${feeTierLabel(Number(fee))} | tokenId #${tokenId}`,
    owner: getAddress(owner),
    status: raw.rangeStatus,
    tickRange: `[${tickLower}, ${tickUpper}) vs current ${currentTick}`,
    prices: {
      atLowerTick: formatPrice(`${token1Symbol} per ${token0Symbol}`, priceLower),
      atUpperTick: formatPrice(`${token1Symbol} per ${token0Symbol}`, priceUpper),
      atCurrentTick: formatPrice(`${token1Symbol} per ${token0Symbol}`, priceCurrent),
      inverseAtCurrentTick: formatPrice(
        `${token0Symbol} per ${token1Symbol}`,
        raw.priceToken0PerToken1AtCurrentTick ?? 0,
      ),
    },
    principal: {
      token0: formatTokenAmount(amount0, dec0, token0Symbol),
      token1: formatTokenAmount(amount1, dec1, token1Symbol),
    },
    uncollectedFees: {
      token0: formatTokenAmount(uncollected0, dec0, token0Symbol),
      token1: formatTokenAmount(uncollected1, dec1, token1Symbol),
      note: collectSimulation,
    },
    liquidity: liquidity.toString(),
    poolAddress,
    links: raw.basescan,
  }

  return { raw, human }
}
