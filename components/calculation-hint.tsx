'use client'

import { useState } from 'react'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'

type Props = {
  section: CloseEstimateCalcSection
}

export function CalculationHint({ section }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="calc-hint">
      <button
        type="button"
        className="calc-hint-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`How ${section.title} is calculated`}
        title="Show formula and inputs"
      >
        ?
      </button>

      {open && (
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
