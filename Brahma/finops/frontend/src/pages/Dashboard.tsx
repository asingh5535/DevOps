import { useEffect, useState } from 'react'
import { ReloadOutlined, DollarOutlined, CheckCircleOutlined, TeamOutlined, ApiOutlined } from '@ant-design/icons'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { api } from '../services/api'
import type { CostSummary, ComplianceReport } from '../types'

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2']

export default function Dashboard() {
  const [costs, setCosts] = useState<CostSummary | null>(null)
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = async () => {
    setLoading(true)
    try {
      const [c, comp] = await Promise.all([api.getCosts(), api.getCompliance()])
      setCosts(c)
      setCompliance(comp)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const fmt$ = (v: number) => `$${v.toFixed(2)}`

  const teamData = costs?.byTeam.map(t => ({
    name: t.team,
    cost: parseFloat(t.monthlyCost.toFixed(2)),
    pods: t.podCount,
  })) ?? []

  const ccData = costs?.byCostCenter.map(c => ({
    name: c.costCenter,
    value: parseFloat(c.monthlyCost.toFixed(2)),
  })) ?? []

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Overview Dashboard</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            Refreshed: {lastRefresh.toLocaleTimeString()}
          </span>
          <ReloadOutlined
            className="refresh-btn"
            spin={loading}
            onClick={load}
            style={{ fontSize: 16 }}
          />
        </div>
      </div>

      <div className="page">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label"><DollarOutlined /> Monthly Cost</div>
            <div className="value" style={{ color: '#1677ff' }}>
              {costs ? fmt$(costs.totalMonthlyCost) : '—'}
            </div>
            <div className="sub">{costs ? fmt$(costs.totalHourlyCost) + '/hr' : ''}</div>
          </div>

          <div className="stat-card">
            <div className="label"><ApiOutlined /> Total Pods</div>
            <div className="value">{costs?.totalPods ?? '—'}</div>
            <div className="sub">running workloads</div>
          </div>

          <div className="stat-card">
            <div className="label"><CheckCircleOutlined /> Label Compliance</div>
            <div
              className="value"
              style={{ color: (costs?.compliancePercent ?? 0) >= 80 ? '#52c41a' : '#ff4d4f' }}
            >
              {costs ? `${costs.compliancePercent}%` : '—'}
            </div>
            <div className="sub">{costs ? `${costs.compliantPods}/${costs.totalPods} pods` : ''}</div>
          </div>

          <div className="stat-card">
            <div className="label"><TeamOutlined /> Teams</div>
            <div className="value">{costs?.byTeam.length ?? '—'}</div>
            <div className="sub">active cost owners</div>
          </div>

          <div className="stat-card">
            <div className="label">Compliant Deployments</div>
            <div
              className="value"
              style={{ color: (compliance?.compliancePct ?? 0) >= 80 ? '#52c41a' : '#ff4d4f' }}
            >
              {compliance ? `${compliance.compliancePct}%` : '—'}
            </div>
            <div className="sub">
              {compliance ? `${compliance.compliant}/${compliance.totalDeployments}` : ''}
            </div>
          </div>

          <div className="stat-card">
            <div className="label">Non-Compliant</div>
            <div className="value" style={{ color: compliance?.nonCompliant ? '#ff4d4f' : '#52c41a' }}>
              {compliance?.nonCompliant ?? '—'}
            </div>
            <div className="sub">deployments missing labels</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header"><DollarOutlined /> Monthly Cost by Team</div>
            <div className="card-body chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Monthly Cost']} />
                  <Bar dataKey="cost" fill="#1677ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><DollarOutlined /> Cost by Cost-Center</div>
            <div className="card-body chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ccData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: $${value}`}
                  >
                    {ccData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {compliance && compliance.nonCompliant > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header" style={{ color: '#ff4d4f' }}>
              Non-Compliant Deployments
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={th}>Namespace</th>
                    <th style={th}>Deployment</th>
                    <th style={th}>Missing Labels</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.deployments.filter(d => !d.compliant).map(d => (
                    <tr key={`${d.namespace}/${d.name}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={td}>{d.namespace}</td>
                      <td style={td}>{d.name}</td>
                      <td style={td}>
                        {d.missingLabels.map(l => (
                          <span key={l} className="tag tag-red" style={{ marginRight: 4 }}>{l}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#595959',
  borderBottom: '1px solid #f0f0f0',
}

const td: React.CSSProperties = {
  padding: '10px 16px',
  color: '#262626',
}
