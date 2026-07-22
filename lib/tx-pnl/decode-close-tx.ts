import { decodeEventLog, getAddress, isHash, parseAbiItem } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'

const POSITION_LIQUIDATED_EVENT = parseAbiItem(
  'event PositionLiquidated(address indexed user, uint256 indexed tokenId, uint256 principalUsdc)',
)

const POSITION_CLOSED_EVENT = parseAbiItem(
  'event PositionClosed(address indexed owner, bytes32 indexed botId, uint256 indexed positionId, uint256 tokenId, uint256 totalUsdc)',
)

const CLOSE_FEES_COLLECTED_EVENT = parseAbiItem(
  'event CloseFeesCollected(address indexed user, uint256 indexed tokenId, address token0, address token1, uint256 gross0, uint256 gross1, uint256 operationFee0, uint256 operationFee1, uint256 performanceFee0, uint256 performanceFee1)',
)

export type DecodedCloseTx = {
  closeTxHash: string
  tokenId: bigint
  principalUsdc: bigint
  /** Net earned fees in token0/token1 after op/PF (pair currency). */
  feeNet0: bigint
  feeNet1: bigint
  token0: `0x${string}` | null
  token1: `0x${string}` | null
  entryTotalUsdcFromCloseEvent: bigint | null
}

/**
 * Decode an EXBOT redeem/close tx.
 * Authoritative Uniswap exit principal = PositionLiquidated.principalUsdc.
 */
export async function decodeCloseTx(
  client: BasePublicClient,
  closeTxHash: string,
): Promise<DecodedCloseTx> {
  const trimmed = closeTxHash.trim()
  if (!isHash(trimmed)) throw new Error('closeTxHash must be a valid 0x transaction hash')

  const receipt = await client.getTransactionReceipt({ hash: trimmed as `0x${string}` })

  let liquidated:
    | { user: `0x${string}`; tokenId: bigint; principalUsdc: bigint }
    | null = null
  let closed: { tokenId: bigint; totalUsdc: bigint } | null = null
  let fees: {
    tokenId: bigint
    token0: `0x${string}`
    token1: `0x${string}`
    feeNet0: bigint
    feeNet1: bigint
  } | null = null

  for (const log of receipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: [POSITION_LIQUIDATED_EVENT],
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'PositionLiquidated') {
        liquidated = {
          user: getAddress(parsed.args.user),
          tokenId: parsed.args.tokenId,
          principalUsdc: parsed.args.principalUsdc,
        }
      }
    } catch {
      // not this event
    }

    try {
      const parsed = decodeEventLog({
        abi: [POSITION_CLOSED_EVENT],
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'PositionClosed') {
        closed = {
          tokenId: parsed.args.tokenId,
          totalUsdc: parsed.args.totalUsdc,
        }
      }
    } catch {
      // not this event
    }

    try {
      const parsed = decodeEventLog({
        abi: [CLOSE_FEES_COLLECTED_EVENT],
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'CloseFeesCollected') {
        const feeNet0 =
          parsed.args.gross0 - parsed.args.operationFee0 - parsed.args.performanceFee0
        const feeNet1 =
          parsed.args.gross1 - parsed.args.operationFee1 - parsed.args.performanceFee1
        fees = {
          tokenId: parsed.args.tokenId,
          token0: getAddress(parsed.args.token0),
          token1: getAddress(parsed.args.token1),
          feeNet0,
          feeNet1,
        }
      }
    } catch {
      // not this event
    }
  }

  if (!liquidated) {
    throw new Error(
      'No PositionLiquidated event in this tx. Paste the EXBOT close/redeem transaction hash.',
    )
  }

  if (fees && fees.tokenId !== liquidated.tokenId) {
    throw new Error('CloseFeesCollected tokenId does not match PositionLiquidated tokenId')
  }
  if (closed && closed.tokenId !== liquidated.tokenId) {
    throw new Error('PositionClosed tokenId does not match PositionLiquidated tokenId')
  }

  return {
    closeTxHash: trimmed,
    tokenId: liquidated.tokenId,
    principalUsdc: liquidated.principalUsdc,
    feeNet0: fees?.feeNet0 ?? 0n,
    feeNet1: fees?.feeNet1 ?? 0n,
    token0: fees?.token0 ?? null,
    token1: fees?.token1 ?? null,
    entryTotalUsdcFromCloseEvent: closed?.totalUsdc ?? null,
  }
}
