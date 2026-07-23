import { formatUnits, getAddress, zeroAddress } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatTokenLabel, knownTokenSymbol } from '@/lib/base-known-tokens'
import { ERC20_ABI } from '@/lib/position/constants'
import { basescanLink } from '@/lib/position/format'
import {
  BASE_USDC_ADDRESS,
  CHAIN_ID,
  POSITION_MANAGER_ABI,
  POSITION_MANAGER_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
} from './constants'
import { resolveBotIdBytes32 } from './encode-bot-id'
import { formatBotCapitalState } from './format-bot-capital'
import type { BotPositionSummary, BotResult } from './types'

function formatUsdc(raw: bigint): string {
  return `${Number(formatUnits(raw, 6)).toLocaleString('en-US', { maximumFractionDigits: 6 })} USDC`
}

function formatTimestamp(seconds: bigint): { label: string; iso: string | null } {
  if (seconds === 0n) return { label: 'n/a', iso: null }
  const ms = Number(seconds) * 1000
  if (!Number.isFinite(ms)) return { label: String(seconds), iso: null }
  const date = new Date(ms)
  return { label: date.toISOString(), iso: date.toISOString() }
}

async function fetchPositionSummaries(
  client: BasePublicClient,
  user: `0x${string}`,
  botIdBytes32: `0x${string}`,
  tokenIds: readonly bigint[],
): Promise<BotPositionSummary[]> {
  return Promise.all(
    tokenIds.map(async (tokenId) => {
      const positionInfo = await client.readContract({
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: 'getPosition',
        args: [tokenId],
      })

      const [deployment, deployedForPosition] = await Promise.all([
        client.readContract({
          address: POSITION_MANAGER_ADDRESS,
          abi: POSITION_MANAGER_ABI,
          functionName: 'getPositionDeployment',
          args: [user, botIdBytes32, positionInfo.positionId],
        }),
        client.readContract({
          address: POSITION_MANAGER_ADDRESS,
          abi: POSITION_MANAGER_ABI,
          functionName: 'deployedCapitalForPosition',
          args: [tokenId],
        }),
      ])

      const opened = formatTimestamp(positionInfo.openedAt)

      return {
        tokenId: tokenId.toString(),
        positionId: positionInfo.positionId.toString(),
        active: deployment.active,
        totalUsdc: deployment.totalUsdc.toString(),
        uniswapUsdc: deployment.uniswapUsdc.toString(),
        hyperliquidUsdc: deployment.hyperliquidUsdc.toString(),
        deployedCapitalForPosition: deployedForPosition.toString(),
        pool: getAddress(positionInfo.pool),
        tickLower: Number(positionInfo.tickLower),
        tickUpper: Number(positionInfo.tickUpper),
        liquidity: positionInfo.liquidity.toString(),
        openedAt: opened.label,
        openedAtIso: opened.iso,
      }
    }),
  )
}

export async function fetchBot(
  client: BasePublicClient,
  userInput: string,
  botIdInput: string,
): Promise<BotResult> {
  const user = getAddress(userInput) as `0x${string}`
  const botIdBytes32 = resolveBotIdBytes32(botIdInput)

  const [
    usdcAddress,
    depositTokenRaw,
    unspent,
    deployed,
    wlMaster,
    vaultPaused,
    positionCount,
    positionOpenCount,
    tokenIds,
  ] = await Promise.all([
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'usdc',
    }),
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'botDepositToken',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'unspentBalance',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'deployedCapital',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'wlMasterOf',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'paused',
    }),
    client.readContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getBotPositionCount',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getBotPositionOpenCount',
      args: [user, botIdBytes32],
    }),
    client.readContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getBotPositionIds',
      args: [user, botIdBytes32],
    }),
  ])

  const depositToken =
    depositTokenRaw === zeroAddress ? getAddress(usdcAddress) : getAddress(depositTokenRaw)

  const depositTokenSymbol =
    knownTokenSymbol(depositToken) ??
    (await client.readContract({
      address: depositToken,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }))

  const positions = await fetchPositionSummaries(client, user, botIdBytes32, tokenIds)
  const capitalState = formatBotCapitalState({
    unspent,
    deployed,
    positionCount: tokenIds.length,
  })

  const totalTracked = unspent + deployed
  const wlMasterAddr = wlMaster === zeroAddress ? null : getAddress(wlMaster)

  const raw = {
    network: 'Base mainnet',
    chainId: CHAIN_ID,
    user,
    botIdInput: botIdInput.trim(),
    botIdBytes32,
    vaultAddress: VAULT_ADDRESS,
    positionManagerAddress: POSITION_MANAGER_ADDRESS,
    depositToken,
    depositTokenSymbol,
    usdcAddress: getAddress(usdcAddress),
    unspentBalance: unspent.toString(),
    deployedCapital: deployed.toString(),
    wlMaster: wlMasterAddr ?? zeroAddress,
    vaultPaused,
    positionCount: positionCount.toString(),
    positionOpenCount: positionOpenCount.toString(),
    tokenIds: tokenIds.map((id) => id.toString()),
    positions,
  }

  return {
    raw,
    human: {
      summary: `EXBOT bot · ${capitalState}`,
      capitalState,
      user,
      botIdInput: botIdInput.trim(),
      botIdBytes32,
      depositToken,
      depositTokenSymbol,
      depositTokenLabel: formatTokenLabel(depositToken, depositTokenSymbol),
      unspentUsdc: formatUsdc(unspent),
      deployedUsdc: formatUsdc(deployed),
      totalTrackedUsdc: formatUsdc(totalTracked),
      wlMaster: wlMasterAddr,
      vaultPaused,
      positionCount: tokenIds.length,
      positions: positions.map((p) => ({
        tokenId: p.tokenId,
        positionId: p.positionId,
        active: p.active,
        totalUsdc: formatUsdc(BigInt(p.totalUsdc)),
        uniswapUsdc: formatUsdc(BigInt(p.uniswapUsdc)),
        hyperliquidUsdc: formatUsdc(BigInt(p.hyperliquidUsdc)),
        tickRange: `[${p.tickLower}, ${p.tickUpper})`,
        liquidity: p.liquidity,
        openedAt: p.openedAt,
        openedAtIso: p.openedAtIso,
        positionLink: `/?tool=position&tokenId=${p.tokenId}`,
      })),
      links: {
        user: basescanLink(user),
        vault: basescanLink(VAULT_ADDRESS),
        positionManager: basescanLink(POSITION_MANAGER_ADDRESS),
        depositToken: basescanLink(depositToken, 'token'),
      },
    },
  }
}
