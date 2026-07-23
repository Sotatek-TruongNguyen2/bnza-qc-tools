import { knownTokenSymbol } from '@/lib/base-known-tokens'

const ICON_BY_SYMBOL: Record<string, string> = {
  USDC: '/tokens/usdc.svg',
  USDBC: '/tokens/usdbc.svg',
  USDT: '/tokens/usdt.svg',
  DAI: '/tokens/dai.svg',
  WETH: '/tokens/weth.svg',
  ETH: '/tokens/weth.svg',
  CBETH: '/tokens/cbeth.svg',
  WSTETH: '/tokens/wsteth.svg',
  CBBTC: '/tokens/cbbtc.svg',
}

function resolveIconSymbol(symbol?: string | null, address?: string | null): string | null {
  const fromSymbol = symbol?.trim().toUpperCase()
  if (fromSymbol && ICON_BY_SYMBOL[fromSymbol]) return fromSymbol

  const fromAddress = address ? knownTokenSymbol(address)?.toUpperCase() : null
  if (fromAddress && ICON_BY_SYMBOL[fromAddress]) return fromAddress

  return null
}

type TokenIconProps = {
  symbol?: string | null
  address?: string | null
  size?: number
  className?: string
}

/** Circular token logo for known Base hubs (USDC, WETH, DAI, USDT, …). */
export function TokenIcon({ symbol, address, size = 20, className }: TokenIconProps) {
  const resolved = resolveIconSymbol(symbol, address)
  if (!resolved) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local static SVG assets
    <img
      src={ICON_BY_SYMBOL[resolved]}
      alt={resolved}
      width={size}
      height={size}
      className={['token-icon', className].filter(Boolean).join(' ')}
      loading="lazy"
      decoding="async"
    />
  )
}

type TokenSymbolProps = {
  symbol: string
  address?: string | null
  size?: number
  className?: string
}

/** Token logo + symbol label (e.g. pair headers, deposit token). */
export function TokenSymbol({ symbol, address, size = 20, className }: TokenSymbolProps) {
  return (
    <span className={['token-inline', className].filter(Boolean).join(' ')}>
      <TokenIcon symbol={symbol} address={address} size={size} />
      <span>{symbol}</span>
    </span>
  )
}

type TokenAmountLineProps = {
  symbol: string
  address?: string | null
  amount: string
  prefix?: string
  size?: number
}

/** Icon + optional prefix + amount line for principal/fee rows. */
export function TokenAmountLine({ symbol, address, amount, prefix, size = 18 }: TokenAmountLineProps) {
  const label = prefix ? `${prefix} (${symbol})` : symbol

  return (
    <span className="token-amount-line">
      <TokenIcon symbol={symbol} address={address} size={size} />
      <span>
        {label}: {amount}
      </span>
    </span>
  )
}
