import type { ReactNode } from 'react'

/** Longer / more specific phrases first so they match before shorter ones. */
const KEYWORDS = [
  'PositionLiquidated.principalUsdc',
  'PositionLiquidated',
  'PositionOpened',
  'CloseFeesCollected',
  'closeTxHash',
  'hyperliquidUsdc',
  'uniswapUsdc',
  'totalUsdc',
  'close tx',
  'open tx',
  'Close tx',
  'Open tx',
  'Hyperliquid',
  'Uniswap',
  'EXBOT',
  'USDC',
  'WETH',
  'HL',
  'NFT',
  'NPM',
  'op/PF',
  'BNZA',
] as const

/**
 * Wrap known technical keywords in <code> / <strong> for QC readability.
 */
export function highlightKeywords(text: string): ReactNode[] {
  if (!text) return [text]

  const pattern = new RegExp(
    `(${KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  )

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const word = match[1]!
    const isEventOrField = /[A-Z]/.test(word[0]!) || word.includes('.') || word.includes('Usdc')
    if (isEventOrField || word.includes('tx') || word === 'closeTxHash') {
      nodes.push(
        <code key={`k-${key++}`} className="caveat-kw">
          {word}
        </code>,
      )
    } else {
      nodes.push(
        <strong key={`k-${key++}`} className="caveat-kw-strong">
          {word}
        </strong>,
      )
    }
    lastIndex = match.index + word.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}
