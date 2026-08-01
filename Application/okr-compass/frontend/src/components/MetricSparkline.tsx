import type { MetricSample } from '@/types'

// Deliberately dependency-free: a small inline SVG polyline rather than pulling
// in a charting library for what is just a KR trend indicator.
export default function MetricSparkline({ samples, width = 200, height = 40, color = '#1677ff' }: {
  samples: MetricSample[]
  width?: number
  height?: number
  color?: string
}) {
  if (samples.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', color: '#8b949e', fontSize: 12 }}>Not enough data yet</div>
  }

  const ordered = [...samples].sort((a, b) => new Date(a.sampledAt).getTime() - new Date(b.sampledAt).getTime())
  const values = ordered.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = ordered.map((s, i) => {
    const x = (i / (ordered.length - 1)) * width
    const y = height - ((s.value - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
