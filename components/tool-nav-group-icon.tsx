/** Small line icons for QC tool-nav group headers. */
export function ToolNavGroupIcon({ groupId }: { groupId: string }) {
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

  if (groupId === 'lookup') {
    // Magnifying glass — find / inspect
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    )
  }

  if (groupId === 'analyze') {
    // Chart bars — measure / analyze
    return (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M12 19V5" />
        <path d="M20 19v-7" />
      </svg>
    )
  }

  // Ops — wrench / gear hybrid (simple wrench)
  return (
    <svg {...common}>
      <path d="M14.7 6.3a4.5 4.5 0 0 0-6.1 6.1L3 18l3 3 5.6-5.6a4.5 4.5 0 0 0 6.1-6.1l-2.5 2.5-2.5-2.5 2.5-2.5z" />
    </svg>
  )
}
