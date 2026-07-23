'use client'

import type { ReactNode } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

/**
 * Compact Lottie spinner for primary query buttons.
 * Animation: "White Cropped Loading Spinner" (LottieFiles / Camber Construction)
 * https://lottiefiles.com/free-animation/white-cropped-loading-spinner-T0zG1fKGHP
 */
export function ButtonLoadingLabel({ children }: { children: ReactNode }) {
  return (
    <span className="btn-loading-label">
      <span className="btn-loading-lottie" aria-hidden>
        <DotLottieReact
          src="/lottie/button-loading.json"
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </span>
      <span>{children}</span>
    </span>
  )
}
