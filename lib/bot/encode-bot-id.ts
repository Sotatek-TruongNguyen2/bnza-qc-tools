import { isHex, keccak256, toBytes } from 'viem'

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

/** UUID / string bot id → bytes32 (keccak256 UTF-8), matching EXBOT runtime. */
export function botIdToBytes32(botId: string): `0x${string}` {
  const trimmed = botId.trim()
  if (!trimmed) throw new Error('botId must be non-empty')

  const encoded = keccak256(toBytes(trimmed)) as `0x${string}`
  if (encoded === ZERO_BYTES32) {
    throw new Error('encoded botId is zero bytes32')
  }
  return encoded
}

/** Accept UUID string or raw 32-byte hex (advanced QC). */
export function resolveBotIdBytes32(botIdInput: string): `0x${string}` {
  const trimmed = botIdInput.trim()
  if (isHex(trimmed) && trimmed.length === 66) {
    return trimmed as `0x${string}`
  }
  return botIdToBytes32(trimmed)
}
