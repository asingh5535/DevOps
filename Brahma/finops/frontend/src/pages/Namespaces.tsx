import { useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../services/api'
import type { NamespaceInfo } from '../types'

export default function Namespaces() {
  const [data, setData] = useState<NamespaceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.getNamespaces()
      setData(r.namespaces ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const compliant = data.filter(n => n.compliant).length

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Namespaces</span>
        <ReloadOutlined className="refresh-btn" spin={loading} onClick={load} style={{ fontSize: 16 }} />
      </div>

      <div className="page">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total Namespaces</div>
            <div className="value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Compliant</div>
            <div className="value" style={{ color: '#52c41a' }}>{compliant}</div>
            <div className="sub">have team + cost-center + env</div>
          </div>
          <div className="stat-card">
            <div className="label">Non-Compliant</div>
            <div className="value" style={{ color: '#ff4d4f' }}>{data.length - compliant}</div>
            <div className="sub">missing required labels</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Namespace Label Inventory</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={th}>Namespace</th>
                  <th style={th}>Phase</th>
                  <th style={th}>team</th>
                  <th style={th}>cost-center</th>
                  <th style={th}>env</th>
                  <th style={th}>managed-by</th>
                  <th style={th}>Compliant</th>
                </tr>
              </thead>
              <tbody>
                {data.map(ns => (
                  <tr key={ns.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={td}><strong>{ns.name}</strong></td>
                    <td style={td}><span className="tag tag-green">{ns.phase}</span></td>
                    <td style={td}>
                      {ns.labels?.team
                        ? <span className="tag tag-blue">{ns.labels.team}</span>
                        : <span style={{ color: '#ff4d4f', fontSize: 12 }}>missing</span>}
                    </td>
                    <td style={td}>
                      {ns.labels?.['cost-center']
                        ? <span className="tag tag-blue">{ns.labels['cost-center']}</span>
                        : <span style={{ color: '#ff4d4f', fontSize: 12 }}>missing</span>}
                    </td>
                    <td style={td}>
                      {ns.labels?.env
                        ? <span className="tag tag-orange">{ns.labels.env}</span>
                        : <span style={{ color: '#ff4d4f', fontSize: 12 }}>missing</span>}
                    </td>
                    <td style={td}>
                      {ns.labels?.['managed-by'] || <span style={{ color: '#bfbfbf' }}>—</span>}
                    </td>
                    <td style={td}>
                      {ns.compliant
                        ? <span className="tag tag-green">Yes</span>
                        : <span className="tag tag-red">No</span>}
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
