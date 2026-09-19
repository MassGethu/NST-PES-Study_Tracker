import React from 'react';

/**
 * Circular SVG ring showing a percentage with colour coding.
 * size: pixel diameter of the ring
 */
export default function ConfidenceGauge({ pct = 0, size = 80, label = 'Confidence' }) {
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const offset = circumference - (clampedPct / 100) * circumference;

  let strokeColor;
  if (clampedPct >= 70) strokeColor = 'var(--green)';
  else if (clampedPct >= 40) strokeColor = 'var(--yellow)';
  else strokeColor = 'var(--red)';

  return (
    <div className="confidence-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--bg-elevated)" strokeWidth="6"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div className="cr-text" style={{ color: strokeColor }}>{clampedPct}%</div>
        <div className="cr-label">{label}</div>
      </div>
    </div>
  );
}
