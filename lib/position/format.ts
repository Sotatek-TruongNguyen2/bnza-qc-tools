import { Q96 } from './constants'
import { formatPrice, formatTokenAmount } from '@/lib/format-token-amount'

export { formatPrice, formatTokenAmount }

export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick
  if (absTick > 887272) throw new Error(`tick ${tick} out of range`)

  let ratio =
    (absTick & 1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n

  const masks = [
    0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x100, 0x200, 0x400, 0x800, 0x1000,
    0x2000, 0x4000, 0x8000, 0x10000, 0x20000, 0x40000, 0x80000,
  ]
  const constants = [
    '0xfff97272373d413259a46990580e213a',
    '0xfff2e50f5f656932ef12357cf3c7fdcc',
    '0xffe5caca7e10e4e61c3624eaa0941cd0',
    '0xffcb9843d60f6159c9db58835c926644',
    '0xff973b41fa98c081472e6896dfb254c0',
    '0xff2ea16466c96a3843ec78b326b52861',
    '0xfe5dee046a99a2a811c461f1969c3053',
    '0xfcbe86c7900a88aedcffc83b479aa3a4',
    '0xf987a7253ac413176f2b074cf7815e54',
    '0xf3392b0822b70005940c7a398e4b70f3',
    '0xe7159475a2c29b7443b29c7fa6e889d9',
    '0xd097f3bdfd2022b8845ad8f792aa5825',
    '0xa9f746462d870fdf8a65dc1f90e061e5',
    '0x70d869a156d2a1b890bb3df62baf32f7',
    '0x31be135f97d08fd981231505542fcfa6',
    '0x9aa508b5b7a84e1c677de54f3e99bc9',
    '0x5d6af8dedb81196699c329225ee604',
    '0x2216e584f5fa1ea926041bedfe98',
    '0x48a170391f7dc42444e8fa2',
  ]

  for (let i = 0; i < masks.length; i += 1) {
    if ((absTick & masks[i]!) !== 0) {
      ratio = (ratio * BigInt(constants[i]!)) >> 128n
    }
  }

  if (tick > 0) {
    ratio = (2n ** 256n - 1n) / ratio
  }

  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n)
}

function getAmount0Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  let lower = sqrtA
  let upper = sqrtB
  if (lower > upper) [lower, upper] = [sqrtB, sqrtA]
  const numerator1 = liquidity << 96n
  const numerator2 = upper - lower
  return (numerator1 * numerator2) / upper / lower
}

function getAmount1Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  let lower = sqrtA
  let upper = sqrtB
  if (lower > upper) [lower, upper] = [sqrtB, sqrtA]
  return (liquidity * (upper - lower)) / Q96
}

export function getAmountsForLiquidity(
  sqrtCurrent: bigint,
  sqrtLower: bigint,
  sqrtUpper: bigint,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  let lower = sqrtLower
  let upper = sqrtUpper
  if (lower > upper) [lower, upper] = [sqrtUpper, sqrtLower]

  if (sqrtCurrent <= lower) {
    return { amount0: getAmount0Delta(lower, upper, liquidity), amount1: 0n }
  }
  if (sqrtCurrent < upper) {
    return {
      amount0: getAmount0Delta(sqrtCurrent, upper, liquidity),
      amount1: getAmount1Delta(lower, sqrtCurrent, liquidity),
    }
  }
  return { amount0: 0n, amount1: getAmount1Delta(lower, upper, liquidity) }
}

export function feeTierLabel(fee: number): string {
  return `${fee} (${fee / 10_000}%)`
}

export function tickToPriceRatio(tick: number, decimals0: number, decimals1: number): number {
  return 1.0001 ** tick * 10 ** (decimals0 - decimals1)
}

export function rangeStatus(
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): string {
  if (liquidity === 0n) return 'CLOSED (liquidity = 0)'
  if (currentTick < tickLower) return 'OUT OF RANGE (below range, 100% token0)'
  if (currentTick >= tickUpper) return 'OUT OF RANGE (above range, 100% token1)'
  return 'IN RANGE'
}

export function basescanLink(address: string, kind: 'address' | 'token' = 'address'): string {
  return `https://basescan.org/${kind}/${address}`
}
