'use client'

import { useState } from 'react'

type Props = {
  value: string
  label?: string
}

/** Copy a plain string (Basescan paste fields). */
export function CopyTextButton({ value, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" className="btn-secondary" onClick={() => void onCopy()} disabled={!value}>
      {copied ? 'Copied' : label}
    </button>
  )
}
