/** Derive QC-friendly vault capital state from on-chain balances. */
export function formatBotCapitalState(args: {
  unspent: bigint
  deployed: bigint
  positionCount: number
}): string {
  const { unspent, deployed, positionCount } = args
  const hasUnspent = unspent > 0n
  const hasDeployed = deployed > 0n
  const hasPositions = positionCount > 0

  if (!hasUnspent && !hasDeployed && !hasPositions) {
    return 'Empty — no vault balance or positions for this (user, botId)'
  }
  if (hasUnspent && !hasDeployed && !hasPositions) {
    return 'Idle — USDC deposited, not deployed to LP yet'
  }
  if (hasUnspent && (hasDeployed || hasPositions)) {
    return 'Partially deployed — unspent balance + active LP position(s)'
  }
  if (!hasUnspent && (hasDeployed || hasPositions)) {
    return 'Fully deployed — no unspent vault balance'
  }
  return 'Unknown'
}
