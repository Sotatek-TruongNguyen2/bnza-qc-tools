'use client'

import { useState } from 'react'

type Props = {
  value: string
  /** Accessible name, e.g. "Copy bot ID". */
  label: string
  className?: string
}

/** Small icon-only clipboard control for inline mono fields. */
export function CopyIconButton({ value, label, className }: Props) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      className={['copy-icon-btn', className].filter(Boolean).join(' ')}
      onClick={() => void onCopy()}
      disabled={!value}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M9.55 17.3 4.8 12.55l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
          />
        </svg>
      )}
    </button>
  )
}
