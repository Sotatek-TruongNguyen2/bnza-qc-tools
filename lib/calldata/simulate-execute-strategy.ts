import { getAddress, isAddress, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  CALLDATA_VAULT_ADDRESS,
  DEFAULT_OPERATOR_ADDRESS,
  EXECUTE_STRATEGY_ABI,
  OPERATOR_ROLE,
  VAULT_OPERATOR_VIEW_ABI,
} from './constants'
import {
  decodeSimulationRevert,
  type DecodedSimulationRevert,
} from './decode-simulation-revert'
import { SIMULATION_ERROR_ABI } from './simulation-error-abi'

export type SimulateExecuteStrategyInput = {
  strategy: string
  user: string
  botIdBytes32: string
  params: string
  executeStrategyCalldata: string
  /** Simulation msg.sender + OPERATOR_ROLE check. Defaults to deployer operator. */
  operator?: string
}

export type SimulateExecuteStrategyResult = {
  ok: boolean
  vault: string
  operator: string
  operatorHasRole: boolean | null
  gasEstimate: string | null
  gasEstimateBuffered: string | null
  /** eth_call / simulateContract success or revert message. */
  message: string
  /** Decoded custom error when the simulation reverted. */
  revert: DecodedSimulationRevert | null
  warnings: string[]
}

const GAS_BUFFER = 1.2

function requireAddress(label: string, value: string): `0x${string}` {
  const v = value.trim()
  if (!isAddress(v)) throw new Error(`${label} must be a valid 0x address`)
  return getAddress(v)
}

function requireBytes32(label: string, value: string): Hex {
  const v = value.trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(v)) throw new Error(`${label} must be bytes32`)
  return v as Hex
}

function requireHexBytes(label: string, value: string): Hex {
  const v = value.trim()
  if (!/^0x([a-fA-F0-9]{2})*$/.test(v)) throw new Error(`${label} must be hex bytes`)
  return v as Hex
}

/**
 * eth_call simulate + eth_estimateGas for vault.executeStrategy.
 * `operator` is both msg.sender for simulation and the OPERATOR_ROLE check address.
 */
export async function simulateExecuteStrategy(
  client: BasePublicClient,
  input: SimulateExecuteStrategyInput,
): Promise<SimulateExecuteStrategyResult> {
  const warnings: string[] = []
  const vault = CALLDATA_VAULT_ADDRESS
  const strategy = requireAddress('strategy', input.strategy)
  const user = requireAddress('user', input.user)
  const botId = requireBytes32('botId', input.botIdBytes32)
  const params = requireHexBytes('params', input.params)
  const calldata = requireHexBytes('executeStrategyCalldata', input.executeStrategyCalldata)
  const operator = requireAddress(
    'operator',
    input.operator?.trim() || DEFAULT_OPERATOR_ADDRESS,
  )

  let operatorHasRole: boolean | null = null
  try {
    operatorHasRole = await client.readContract({
      address: vault,
      abi: VAULT_OPERATOR_VIEW_ABI,
      functionName: 'hasRole',
      args: [OPERATOR_ROLE, operator],
    })
    if (!operatorHasRole) {
      warnings.push(
        `Address ${operator} does not currently hold OPERATOR_ROLE on the vault — simulation may revert with AccessControl.`,
      )
    }
  } catch (err) {
    warnings.push(formatRpcError(err, 'Could not verify OPERATOR_ROLE'))
  }

  // Merge executeStrategy + known custom errors so viem can decode reverts.
  const simulateAbi = [...EXECUTE_STRATEGY_ABI, ...SIMULATION_ERROR_ABI]

  try {
    await client.simulateContract({
      address: vault,
      abi: simulateAbi,
      functionName: 'executeStrategy',
      args: [strategy, user, botId, params],
      account: operator,
    })
  } catch (err) {
    const decoded = decodeSimulationRevert(err)
    return {
      ok: false,
      vault,
      operator,
      operatorHasRole,
      gasEstimate: null,
      gasEstimateBuffered: null,
      message: decoded?.human ?? formatRpcError(err, 'Simulation reverted'),
      revert: decoded,
      warnings,
    }
  }

  let gasEstimate: string | null = null
  let gasEstimateBuffered: string | null = null
  try {
    const gas = await client.estimateGas({
      to: vault,
      data: calldata,
      account: operator,
    })
    gasEstimate = gas.toString()
    gasEstimateBuffered = BigInt(Math.ceil(Number(gas) * GAS_BUFFER)).toString()
  } catch (err) {
    warnings.push(formatRpcError(err, 'eth_call ok but estimateGas failed'))
  }

  return {
    ok: true,
    vault,
    operator,
    operatorHasRole,
    gasEstimate,
    gasEstimateBuffered,
    message:
      'eth_call succeeded — executeStrategy would not revert at current state (as this operator).',
    revert: null,
    warnings,
  }
}
