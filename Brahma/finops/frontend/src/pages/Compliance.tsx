import { useEffect, useState } from 'react'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../services/api'
import type { ComplianceReport } from '../types'

export default function Compliance() {
  const [data, setData] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'compliant' | 'non-compliant'>('all')

  const load = async () => {
    setLoading(true)
    try { setData(await api.getCompliance()) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const rows = (data?.deployments ?? []).filter(d =>
    filter === 'all' ? true : filter === 'compliant' ? d.compliant : !d.compliant
  )

  const gaugeData = [{ name: 'Compliance', value: data?.compliancePct ?? 0, fill: '#52c41a' }]

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Label Compliance</span>
        <ReloadOutlined className="refresh-btn" spin={loading} onClick={load} style={{ fontSize: 16 }} />
      </div>

      <div className="page">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Compliance Rate</div>
            <div className="value" style={{ color: (data?.compliancePct ?? 0) >= 80 ? '#52c41a' : '#ff4d4f' }}>
              {data ? `${data.compliancePct}%` : '—'}
            </div>
            <div className="sub">of all deployments</div>
          </div>
          <div className="stat-card">
            <div className="label"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Compliant</div>
            <div className="value" style={{ color: '#52c41a' }}>{data?.compliant ?? '—'}</div>
            <div className="sub">deployments</div>
          </div>
          <div className="stat-card">
            <div className="label"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Non-Compliant</div>
            <div className="value" style={{ color: '#ff4d4f' }}>{data?.nonCompliant ?? '—'}</div>
            <div className="sub">deployments</div>
          </div>
          <div className="stat-card">
            <div className="label">Required Labels</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(data?.requiredLabels ?? []).map(l => (
                <span key={l} className="tag tag-blue">{l}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">Compliance Gauge</div>
            <div className="card-body" style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={gaugeData}>
                  <RadialBar background dataKey="value" cornerRadius={8} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ fontWeight: 700, fontSize: 24, color: (data?.compliancePct ?? 0) >= 80 ? '#52c41a' : '#ff4d4f' }}>
                {data?.compliancePct ?? 0}%
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              Deployment Status
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {(['all', 'compliant', 'non-compliant'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '2px 10px',
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: filter === f ? '#1677ff' : '#d9d9d9',
                      background: filter === f ? '#1677ff' : '#fff',
                      color: filter === f ? '#fff' : '#595959',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0, maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={th}>Namespace</th>
                    <th style={th}>Deployment</th>
                    <th style={th}>Status</th>
                    <th style={th}>Missing Labels</th>
                    <th style={th}>Present Labels</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(d => (
                    <tr key={`${d.namespace}/${d.name}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={td}>{d.namespace}</td>
                      <td style={td}><strong>{d.name}</strong></td>
                      <td style={td}>
                        {d.compliant
                          ? <span className="tag tag-green">Compliant</span>
                          : <span className="tag tag-red">Non-Compliant</span>}
                      </td>
                      <td style={td}>
                        {d.missingLabels.length === 0
                          ? <span style={{ color: '#8c8c8c' }}>none</span>
                          : d.missingLabels.map(l => (
                            <span key={l} className="tag tag-red" style={{ marginRight: 4 }}>{l}</span>
                          ))}
                      </td>
                      <td style={td}>
                        {Object.entries(d.labels ?? {}).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="tag tag-blue" style={{ marginRight: 4, marginBottom: 2 }}>{k}={v}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#595959', borderBottom: '1px solid #f0f0f0' }
const td: React.CSSProperties = { padding: '10px 16px', color: '#262626' }
