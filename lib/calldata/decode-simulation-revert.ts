import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  formatUnits,
  type Hex,
} from 'viem'
import { OPERATOR_ROLE } from './constants'
import { SIMULATION_ERROR_ABI } from './simulation-error-abi'

export type DecodedSimulationRevert = {
  errorName: string
  /** Compact ErrorName(arg0, arg1, …) */
  signature: string
  /** QC-friendly explanation. */
  human: string
  /** Raw revert data if available. */
  raw: string | null
}

const EXEC_OPTION: Record<number, string> = {
  0: 'NONE',
  1: 'CALL',
  2: 'DELEGATE_CALL',
  3: 'STATIC_CALL',
}

function shortAddr(v: unknown): string {
  const s = String(v ?? '')
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

function shortBytes32(v: unknown): string {
  const s = String(v ?? '')
  if (!/^0x[a-fA-F0-9]{64}$/.test(s)) return s
  return `${s.slice(0, 10)}…${s.slice(-6)}`
}

function fmtUint(v: unknown): string {
  try {
    return BigInt(v as string | number | bigint).toString()
  } catch {
    return String(v)
  }
}

function fmtUsdc(v: unknown): string {
  try {
    const raw = BigInt(v as string | number | bigint)
    return `${formatUnits(raw, 6)} USDC (${raw.toString()} raw)`
  } catch {
    return String(v)
  }
}

function formatArg(value: unknown): string {
  if (typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)) return shortAddr(value)
  if (typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)) return shortBytes32(value)
  if (typeof value === 'string' && value.startsWith('0x') && value.length > 66) {
    return `${value.slice(0, 10)}… (${(value.length - 2) / 2} bytes)`
  }
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

function humanize(errorName: string, args: readonly unknown[] | undefined): string {
  const a = args ?? []

  switch (errorName) {
    case 'InsufficientBalance':
      return `Insufficient idle vault balance for this user/bot — available ${fmtUsdc(a[0])}, required ${fmtUsdc(a[1])}. Deposit more USDC or lower totalUsdc.`
    case 'SlippageExceeded':
      return `Swap output below floor — amountOut ${fmtUint(a[0])} < minAmountOut ${fmtUint(a[1])}. Raise amountOutMinimum tolerance or refresh quote.`
    case 'StrategyNotAllowed':
      return `Strategy ${shortAddr(a[0])} is not registered / allowed on the vault.`
    case 'VaultStrategyFailedToExec': {
      const op = EXEC_OPTION[Number(a[2])] ?? `op=${String(a[2])}`
      return `Strategy execution failed (${op}) at ${shortAddr(a[0])}. Vault wraps strategy failures as VaultStrategyFailedToExec and does not bubble the inner revert reason — check strategy params (ticks, amounts, path, deadline) and on-chain state.`
    }
    case 'AccessControlUnauthorizedAccount': {
      const role = String(a[1] ?? '')
      const roleHint =
        role.toLowerCase() === OPERATOR_ROLE.toLowerCase()
          ? 'OPERATOR_ROLE'
          : `role ${shortBytes32(role)}`
      return `Caller ${shortAddr(a[0])} is missing ${roleHint}. Simulation msg.sender must be an operator.`
    }
    case 'VaultPaused':
      return 'Vault is paused — executeStrategy is blocked until unpaused.'
    case 'PositionNotFound':
      return `Position tokenId ${fmtUint(a[0])} not found on the position manager.`
    case 'PositionOwnerMismatch':
      return `tokenId ${fmtUint(a[0])} owner mismatch — expected ${shortAddr(a[1])}, actual ${shortAddr(a[2])}.`
    case 'PositionNotTrackedForUser':
      return `tokenId ${fmtUint(a[1])} is not tracked for user ${shortAddr(a[0])} / this bot.`
    case 'NoActivePosition':
      return `No active position for user ${shortAddr(a[0])}.`
    case 'ZeroLiquidity':
      return 'Position has zero liquidity (already closed / empty).'
    case 'InvalidBotId':
      return 'botId is invalid (bytes32 zero or malformed for this vault context).'
    case 'BotIdMismatch':
      return `botId mismatch — expected ${shortBytes32(a[0])}, actual ${shortBytes32(a[1])}.`
    case 'InvalidParameter':
      return 'Invalid strategy parameter (ticks, fees, amounts, or flags failed validation).'
    case 'NotOperator':
      return 'Caller is not an operator.'
    case 'Unauthorized':
      return `Unauthorized caller ${shortAddr(a[0])}.`
    case 'ZeroAddress':
      return 'A required address argument was address(0).'
    case 'CctpNotConfigured':
      return 'CCTP bridge is not configured on this deployment — disable bridgeHlPortionViaCctp or set CCTP.'
    case 'DepositTokenNotAllowed':
      return `Deposit token ${shortAddr(a[0])} is not allowed.`
    case 'DepositTokenMismatch':
      return `Deposit token mismatch — expected ${shortAddr(a[0])}, got ${shortAddr(a[1])}.`
    case 'CapitalAlreadyDeployed':
      return `Capital already deployed for user ${shortAddr(a[0])}.`
    case 'UserAlreadyHasPosition':
      return `User ${shortAddr(a[0])} already has a position in this context.`
    case 'NftOwnershipLost':
      return `NPM no longer holds tokenId ${fmtUint(a[0])} (NFT ownership lost).`
    case 'RedemptionQueueEmpty':
      return 'Redemption queue is empty.'
    case 'RedemptionNotFound':
      return `Redemption request ${fmtUint(a[0])} not found.`
    case 'RedemptionAlreadyFulfilled':
      return `Redemption request ${fmtUint(a[0])} already fulfilled.`
    case 'Error':
      return `Revert: ${String(a[0] ?? '')}`
    case 'Panic':
      return `Solidity panic code ${fmtUint(a[0])} (often arithmetic overflow / assert).`
    default:
      return a.length > 0
        ? `${errorName}(${a.map(formatArg).join(', ')})`
        : `${errorName}()`
  }
}

function signatureOf(errorName: string, args: readonly unknown[] | undefined): string {
  if (!args || args.length === 0) return `${errorName}()`
  return `${errorName}(${args.map(formatArg).join(', ')})`
}

function tryDecodeRaw(data: Hex): DecodedSimulationRevert | null {
  try {
    const decoded = decodeErrorResult({ abi: SIMULATION_ERROR_ABI, data })
    const args = decoded.args as readonly unknown[] | undefined
    return {
      errorName: decoded.errorName,
      signature: signatureOf(decoded.errorName, args),
      human: humanize(decoded.errorName, args),
      raw: data,
    }
  } catch {
    return null
  }
}

/** Extract a decoded EXBOT / OZ revert from a viem simulateContract failure. */
export function decodeSimulationRevert(err: unknown): DecodedSimulationRevert | null {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      if (reverted.data?.errorName) {
        const args = reverted.data.args as readonly unknown[] | undefined
        return {
          errorName: reverted.data.errorName,
          signature: signatureOf(reverted.data.errorName, args),
          human: humanize(reverted.data.errorName, args),
          raw: reverted.raw ?? null,
        }
      }
      if (reverted.raw && reverted.raw !== '0x') {
        const fromRaw = tryDecodeRaw(reverted.raw)
        if (fromRaw) return fromRaw
        return {
          errorName: 'UnknownRevert',
          signature: reverted.signature
            ? `selector ${reverted.signature}`
            : `raw ${reverted.raw.slice(0, 10)}…`,
          human: reverted.reason
            ? `Execution reverted: ${reverted.reason}`
            : `Unrecognized revert selector ${reverted.signature ?? reverted.raw.slice(0, 10)}. Inner strategy failures are wrapped as VaultStrategyFailedToExec without the original reason.`,
          raw: reverted.raw,
        }
      }
      if (reverted.reason) {
        return {
          errorName: 'Error',
          signature: `Error(${JSON.stringify(reverted.reason)})`,
          human: `Revert: ${reverted.reason}`,
          raw: null,
        }
      }
    }
  }

  // Fallback: scan message for 0x revert data
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const hex = msg.match(/0x[a-fA-F0-9]{8,}/)?.[0] as Hex | undefined
  if (hex && hex.length >= 10) {
    const fromRaw = tryDecodeRaw(hex.length % 2 === 0 ? hex : (`${hex}0` as Hex))
    if (fromRaw) return fromRaw
  }

  return null
}
