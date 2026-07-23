/** Small line icons for QC tool tab pills. */
export function ToolNavIcon({ toolId }: { toolId: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (toolId) {
    case 'bot':
      // Bot / agent
      return (
        <svg {...common}>
          <rect x="5" y="8" width="14" height="11" rx="3" />
          <path d="M12 8V5" />
          <circle cx="12" cy="4" r="1" />
          <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
          <path d="M9 16.5h6" />
        </svg>
      )
    case 'position':
      // LP / layered range
      return (
        <svg {...common}>
          <path d="M4 8h16" />
          <path d="M7 12h10" />
          <path d="M4 16h16" />
          <path d="M8 6v4" />
          <path d="M16 10v4" />
        </svg>
      )
    case 'quote':
      // Swap arrows
      return (
        <svg {...common}>
          <path d="M7 8h11" />
          <path d="M15 5l3 3-3 3" />
          <path d="M17 16H6" />
          <path d="M9 13l-3 3 3 3" />
        </svg>
      )
    case 'tx-pnl':
      // PnL trend
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M7 15l4-5 3 3 5-7" />
        </svg>
      )
    case 'gas':
      // Flame / gas
      return (
        <svg {...common}>
          <path d="M12 3c2.5 3 4 5.2 4 8a4 4 0 1 1-8 0c0-2.8 1.5-5 4-8z" />
          <path d="M10.5 15.5c0 1.2.9 2 1.5 2s1.5-.8 1.5-2c0-1-.8-1.6-1.5-2.2-.7.6-1.5 1.2-1.5 2.2z" />
        </svg>
      )
    case 'calldata':
      // Code / params
      return (
        <svg {...common}>
          <path d="M8 7L3 12l5 5" />
          <path d="M16 7l5 5-5 5" />
          <path d="M13 5l-2 14" />
        </svg>
      )
    case 'addresses':
      // Contract / book-mark
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h3" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
