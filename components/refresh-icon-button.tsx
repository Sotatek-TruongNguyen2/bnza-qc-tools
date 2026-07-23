'use client'

type RefreshIconButtonProps = {
  loading?: boolean
  disabled?: boolean
  onClick: () => void
  /** Shown when idle (default Refresh). */
  label?: string
  /** Shown while loading (default Refreshing…). */
  loadingLabel?: string
  className?: string
}

export function RefreshIconButton({
  loading = false,
  disabled = false,
  onClick,
  label = 'Refresh',
  loadingLabel = 'Refreshing…',
  className,
}: RefreshIconButtonProps) {
  const title = loading ? loadingLabel : label
  return (
    <button
      type="button"
      className={['icon-btn', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <svg
        className={loading ? 'refresh-icon is-spinning' : 'refresh-icon'}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
        />
      </svg>
    </button>
  )
}
