import { useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { api } from '../services/api'
import type { CostSummary } from '../types'

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96']

export default function Costs() {
  const [data, setData] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'team' | 'namespace' | 'costcenter'>('team')

  const load = async () => {
    setLoading(true)
    try { setData(await api.getCosts()) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const teamRows = data?.byTeam.sort((a, b) => b.monthlyCost - a.monthlyCost) ?? []
  const nsRows = data?.byNamespace.sort((a, b) => b.cost.monthlyCost - a.cost.monthlyCost) ?? []
  const ccRows = data?.byCostCenter.sort((a, b) => b.monthlyCost - a.monthlyCost) ?? []

  const chartData = view === 'team'
    ? teamRows.map(t => ({ name: t.team, cost: parseFloat(t.monthlyCost.toFixed(4)) }))
    : view === 'namespace'
    ? nsRows.map(n => ({ name: n.namespace, cost: parseFloat(n.cost.monthlyCost.toFixed(4)) }))
    : ccRows.map(c => ({ name: c.costCenter, cost: parseFloat(c.monthlyCost.toFixed(4)) }))

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Cost Analysis</span>
        <ReloadOutlined className="refresh-btn" spin={loading} onClick={load} style={{ fontSize: 16 }} />
      </div>

      <div className="page">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total Monthly Cost</div>
            <div className="value" style={{ color: '#1677ff' }}>${data?.totalMonthlyCost.toFixed(2) ?? '—'}</div>
            <div className="sub">Simulated (CPU + Memory)</div>
          </div>
          <div className="stat-card">
            <div className="label">Hourly Burn Rate</div>
            <div className="value">${data?.totalHourlyCost.toFixed(4) ?? '—'}</div>
            <div className="sub">per hour</div>
          </div>
          <div className="stat-card">
            <div className="label">CPU Cost (monthly)</div>
            <div className="value" style={{ fontSize: 20 }}>
              ${data ? (data.byNamespace.reduce((s, n) => s + n.cost.cpuRequestCores, 0) * 0.048 * 730).toFixed(2) : '—'}
            </div>
            <div className="sub">$0.048/vCPU/hr × 730h</div>
          </div>
          <div className="stat-card">
            <div className="label">Memory Cost (monthly)</div>
            <div className="value" style={{ fontSize: 20 }}>
              ${data ? (data.byNamespace.reduce((s, n) => s + n.cost.memRequestGB, 0) * 0.006 * 730).toFixed(2) : '—'}
            </div>
            <div className="sub">$0.006/GB/hr × 730h</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            Cost Breakdown —
            {(['team', 'namespace', 'costcenter'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  marginLeft: 8,
                  padding: '2px 10px',
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: view === v ? '#1677ff' : '#d9d9d9',
                  background: view === v ? '#1677ff' : '#fff',
                  color: view === v ? '#fff' : '#595959',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {v === 'costcenter' ? 'Cost Center' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="card-body chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Monthly Cost']} />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Namespace Cost Details</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={th}>Namespace</th>
                  <th style={th}>Team</th>
                  <th style={th}>Cost Center</th>
                  <th style={th}>Pods</th>
                  <th style={th}>CPU (cores)</th>
                  <th style={th}>Memory (GB)</th>
                  <th style={th}>Monthly Cost</th>
                </tr>
              </thead>
              <tbody>
                {nsRows.map(n => (
                  <tr key={n.namespace} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={td}><strong>{n.namespace}</strong></td>
                    <td style={td}>{n.labels?.team || <span style={{ color: '#bfbfbf' }}>—</span>}</td>
                    <td style={td}>{n.labels?.['cost-center'] || <span style={{ color: '#bfbfbf' }}>—</span>}</td>
                    <td style={td}>{n.podCount}</td>
                    <td style={td}>{n.cost.cpuRequestCores.toFixed(3)}</td>
                    <td style={td}>{n.cost.memRequestGB.toFixed(3)}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#1677ff' }}>
                      ${n.cost.monthlyCost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#595959', borderBottom: '1px solid #f0f0f0' }
const td: React.CSSProperties = { padding: '10px 16px', color: '#262626' }
