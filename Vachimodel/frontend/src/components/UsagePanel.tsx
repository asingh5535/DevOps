import { useEffect, useState } from 'react'
import { api, type UsageSummary } from '../api'
import { formatPrice, formatTokens, formatUsd } from '../format'

interface Props {
  fallback: string[]
  onClose: () => void
}

export function UsagePanel({ fallback, onClose }: Props) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<UsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .usage(days)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [days])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const maxDayCost = Math.max(...(data?.by_day.map((d) => d.cost_usd) ?? [0]), 0)
  const maxDayTokens = Math.max(...(data?.by_day.map((d) => d.tokens) ?? [0]), 1)
  const unpriced = data?.by_model.filter((m) => m.unpriced_calls > 0) ?? []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Usage and cost" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Usage and cost</h2>
          <select className="input days-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}
        {!data && !error && <p className="muted">Loading…</p>}

        {data && (
          <>
            <div className="stat-row">
              <BudgetStat label="Today" spent={data.today_usd} limit={data.budget.daily_usd} />
              <BudgetStat label="This month" spent={data.month_usd} limit={data.budget.monthly_usd} />
              <div className="stat">
                <div className="stat-label">Backup models</div>
                <div className="stat-small">{fallback.length ? fallback.join(' → ') : 'none set'}</div>
              </div>
            </div>

            {unpriced.length > 0 && (
              <p className="notice">
                No price is set for {unpriced.map((m) => m.model).join(', ')}, so their cost isn't counted and budgets
                don't limit them. Add them under <code>pricing:</code> in vachi.yaml.
              </p>
            )}

            <h3>By model</h3>
            {data.by_model.length === 0 ? (
              <p className="muted">No usage yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th className="num">Calls</th>
                      <th className="num">Tokens in</th>
                      <th className="num">Tokens out</th>
                      <th className="num">Cost</th>
                      <th className="num">First token</th>
                      <th className="num">As backup</th>
                      <th className="num">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_model.map((m) => (
                      <tr key={m.model}>
                        <td>
                          <div>{m.model}</div>
                          <div className="muted small">{formatPrice(m.price) ?? 'no price set'}</div>
                        </td>
                        <td className="num">{m.calls}</td>
                        <td className="num">{formatTokens(m.input_tokens)}</td>
                        <td className="num">{formatTokens(m.output_tokens)}</td>
                        <td className="num">{m.price ? formatUsd(m.cost_usd) : '—'}</td>
                        <td className="num">
                          {m.avg_first_token_ms != null ? `${(m.avg_first_token_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="num">{m.fallback_calls || ''}</td>
                        <td className="num">{m.errors || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3>By day</h3>
            {data.by_day.length === 0 ? (
              <p className="muted">No usage yet.</p>
            ) : (
              <div className="day-bars">
                {data.by_day.map((d) => {
                  // Bar length shows cost when anything cost money, otherwise tokens.
                  const share = maxDayCost > 0 ? d.cost_usd / maxDayCost : d.tokens / maxDayTokens
                  return (
                    <div className="day-row" key={d.date}>
                      <span className="day-date">{d.date.slice(5)}</span>
                      <span className="day-bar-track">
                        <span className="day-bar" style={{ width: `${Math.max(2, share * 100)}%` }} />
                      </span>
                      <span className="day-value">
                        {formatUsd(d.cost_usd)} · {formatTokens(d.tokens)} tokens · {d.calls} calls
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BudgetStat({ label, spent, limit }: { label: string; spent: number; limit: number | null }) {
  const share = limit ? Math.min(1, spent / limit) : 0
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{formatUsd(spent)}</div>
      {limit ? (
        <>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={spent}>
            <span className={share >= 1 ? 'over' : share >= 0.8 ? 'near' : ''} style={{ width: `${share * 100}%` }} />
          </div>
          <div className="stat-small">of {formatUsd(limit)} budget</div>
        </>
      ) : (
        <div className="stat-small">no budget set</div>
      )}
    </div>
  )
}
