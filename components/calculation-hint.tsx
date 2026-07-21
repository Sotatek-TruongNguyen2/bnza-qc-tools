'use client'

import { useEffect, useRef } from 'react'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'

type Props = {
  section: CloseEstimateCalcSection
  hintId: string
  isOpen: boolean
  onToggle: (hintId: string) => void
  onClose: () => void
}

export function CalculationHint({ section, hintId, isOpen, onToggle, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen, onClose])

  return (
    <div className="calc-hint" ref={rootRef}>
      <button
        type="button"
        className="calc-hint-btn"
        onClick={() => onToggle(hintId)}
        aria-expanded={isOpen}
        aria-label={`How ${section.title} is calculated`}
        title="Show formula and inputs"
      >
        ?
      </button>

      {isOpen && (
        <div className="calc-hint-panel" role="region" aria-label={`${section.title} calculation`}>
          <p className="calc-hint-summary">{section.summary}</p>
          <p className="mono calc-hint-formula">{section.formula}</p>

          <h4>Inputs</h4>
          <dl className="calc-hint-kv">
            {section.inputs.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd className="mono">{row.value}</dd>
              </div>
            ))}
          </dl>

          <h4>Steps</h4>
          <dl className="calc-hint-kv">
            {section.steps.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd className="mono">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="calc-hint-result">
            <strong>Result:</strong> <span className="mono">{section.result}</span>
          </p>
        </div>
      )}
    </div>
  )
}
