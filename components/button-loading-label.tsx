'use client'

import type { ReactNode } from 'react'

/** Compact CSS spinner for primary query buttons (replaces Lottie). */
export function ButtonLoadingLabel({ children }: { children: ReactNode }) {
  return (
    <span className="btn-loading-label">
      <span className="btn-loading-spinner" aria-hidden>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle
            className="btn-loading-spinner-track"
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <circle
            className="btn-loading-spinner-arc"
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="14 44"
          />
        </svg>
      </span>
      <span>{children}</span>
    </span>
  )
}
