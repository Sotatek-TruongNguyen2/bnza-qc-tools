'use client'

import { useState } from 'react'

type Props = {
  value: unknown
  label?: string
}

export function CopyJsonButton({ value, label = 'Copy JSON' }: Props) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" className="btn-secondary" onClick={onCopy}>
      {copied ? 'Copied' : label}
    </button>
  )
}
