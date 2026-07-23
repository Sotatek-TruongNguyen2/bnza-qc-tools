type Props = {
  showDensity: boolean
}

export function PositionRangeLegend({ showDensity }: Props) {
  return (
    <ul className="range-legend" aria-label="Chart legend">
      {showDensity && (
        <li>
          <span className="range-legend-swatch density" aria-hidden="true" />
          <span>
            <strong>Pink</strong> — pool liquidity density (`liquidityGross` at sampled ticks)
          </span>
        </li>
      )}
      <li>
        <span className="range-legend-swatch band" aria-hidden="true" />
        <span>
          <strong>Blue band</strong> — this position’s min→max price range
        </span>
      </li>
      <li>
        <span className="range-legend-swatch current" aria-hidden="true" />
        <span>
          <strong>Gray line</strong> — current pool price
        </span>
      </li>
    </ul>
  )
}
