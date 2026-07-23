import { getAddress, isHex, parseEventLogs, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import { POSITION_MANAGER_ADDRESS } from '@/lib/bot/constants'

const POSITION_OPENED_ABI = [
  {
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'botId', type: 'bytes32', indexed: true },
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'pool', type: 'address', indexed: false },
      { name: 'tickLower', type: 'int24', indexed: false },
      { name: 'tickUpper', type: 'int24', indexed: false },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'totalUsdc', type: 'uint256', indexed: false },
      { name: 'uniswapUsdc', type: 'uint256', indexed: false },
      { name: 'hyperliquidUsdc', type: 'uint256', indexed: false },
    ],
  },
] as const

export type OpenTxPrefill = {
  txHash: Hex
  user: string
  botIdBytes32: string
  tokenId: string
  positionId: string
  pool: string
  tickLower: number
  tickUpper: number
  note: string
  links: { tx: string }
}

/** Accept raw 0x hash or Basescan tx URL. */
export function normalizeTxHash(input: string): Hex {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/tx\/(0x[a-fA-F0-9]{64})/)
  const candidate = (fromUrl?.[1] ?? trimmed) as string
  if (!isHex(candidate) || candidate.length !== 66) {
    throw new Error('Enter a tx hash (0x…64 hex) or Basescan tx URL')
  }
  return candidate as Hex
}

/**
 * Read a vault open-position tx and extract custody user, botId, tokenId
 * from PositionManager PositionOpened.
 */
export async function fetchPrefillFromOpenTx(
  client: BasePublicClient,
  txHashInput: string,
): Promise<OpenTxPrefill> {
  const txHash = normalizeTxHash(txHashInput)

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain — cannot prefill from it')
    }

    const logs = parseEventLogs({
      abi: POSITION_OPENED_ABI,
      logs: receipt.logs,
      strict: false,
    }).filter(
      (log) => log.address.toLowerCase() === POSITION_MANAGER_ADDRESS.toLowerCase(),
    )

    if (logs.length === 0) {
      throw new Error(
        'No PositionOpened on this tx. Paste the open/mint vault tx (not close/rebalance).',
      )
    }

    // Last open in the tx if several (unusual).
    const opened = logs[logs.length - 1]!
    const args = opened.args

    const user = getAddress(args.owner as string)
    const botIdBytes32 = args.botId as Hex
    const tokenId = (args.tokenId as bigint).toString()
    const positionId = (args.positionId as bigint).toString()
    const pool = getAddress(args.pool as string)
    const tickLower = Number(args.tickLower)
    const tickUpper = Number(args.tickUpper)

    return {
      txHash,
      user,
      botIdBytes32,
      tokenId,
      positionId,
      pool,
      tickLower,
      tickUpper,
      note:
        'Filled from PositionOpened on the mint tx. Bot ID is on-chain bytes32 (paste as-is).',
      links: { tx: `https://basescan.org/tx/${txHash}` },
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Enter a tx')) throw err
    if (err instanceof Error && err.message.startsWith('No PositionOpened')) throw err
    if (err instanceof Error && err.message.startsWith('Transaction failed')) throw err
    throw new Error(formatRpcError(err, 'Failed to read open tx'))
  }
}
